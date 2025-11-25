// src/components/AfrodexStaking.jsx - FIXED VERSION
// FIXED: Badge tier thresholds now correctly compare against human-readable staked balance
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

import { STAKING_ABI, AFROX_PROXY_ABI } from '../lib/abis';
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';
import AmbassadorDashboard from './AmbassadorDashboard';
import LPMiningDashboard from './LPMiningDashboard';
import GovernanceDashboard from './GovernanceDashboard';
import { getAfroxPriceUSD, formatUSD, calculateUSDValue } from '../lib/priceUtils';

const TOKEN_LOGO = '/afrodex_token.png';
const DEFAULT_DECIMALS = 4;

const REWARD_RATE = 60n;
const BONUS_RATE = 6n;
const STAKE_REWARD_PERIOD = 86400;
const STAKE_BONUS_PERIOD = 2592000;

const DAILY_RATE_DEC = Number(REWARD_RATE) / 10000;
const BONUS_DAILY_DEC = Number(BONUS_RATE) / 10000;
const FIRST_30_DAYS = 30;
const REMAINING_DAYS = 365 - 30;

// FIXED: Badge tier thresholds - these are in HUMAN READABLE format (after dividing by decimals)
// So 1B AfroX staked = 1,000,000,000 in human readable format
const BADGE_TIERS = [
  { name: 'Diamond Custodian', emoji: '❇️', minStake: 10e12, threshold: '≥10T AfroX' },
  { name: 'Platinum Sentinel', emoji: '💠', minStake: 1e12, threshold: '≥1T AfroX' },
  { name: 'Marshal', emoji: '〽️', minStake: 500e9, threshold: '≥500B AfroX' },
  { name: 'General', emoji: '⭐', minStake: 100e9, threshold: '≥100B AfroX' },
  { name: 'Commander', emoji: '⚜️', minStake: 50e9, threshold: '≥50B AfroX' },
  { name: 'Captain', emoji: '🔱', minStake: 10e9, threshold: '≥10B AfroX' },
  { name: 'Cadet', emoji: '🔰', minStake: 1e9, threshold: '≥1B AfroX' },
  { name: 'Starter', emoji: '✳️', minStake: 0, threshold: 'Stake to unlock' }
];

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewardsAccum, setRewardsAccum] = useState('0');
  const [allowance, setAllowance] = useState('0');

  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  const [maximumSupply, setMaximumSupply] = useState(null);
  const [totalSupply, setTotalSupply] = useState(null);
  const [totalStakeRewardMinted, setTotalStakeRewardMinted] = useState(null);

  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);
  const [afroxPrice, setAfroxPrice] = useState(null);

  const [activeTab, setActiveTab] = useState('staking');

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '—');
  const showAlert = (m, t = 6000) => {
    setAlertMsg(String(m));
    setTimeout(() => setAlertMsg(null), t);
  };

  const toHuman = useCallback((raw) => {
    try {
      if (raw === null || raw === undefined) return '0';
      return formatUnits(raw, decimals);
    } catch (e) {
      try {
        const n = Number(raw ?? 0) / 10 ** decimals;
        return String(n);
      } catch {
        return '0';
      }
    }
  }, [decimals]);

  const toRaw = useCallback((human) => {
    try {
      return parseUnits(String(human || '0'), decimals);
    } catch {
      return 0n;
    }
  }, [decimals]);

  function prettyNumber(humanStr, precision = 2) {
    try {
      const n = Number(humanStr || '0');
      if (!Number.isFinite(n)) return String(humanStr);
      
      const absN = Math.abs(n);
      
      if (absN >= 1e15) return (n / 1e15).toFixed(precision) + 'Q';
      else if (absN >= 1e12) return (n / 1e12).toFixed(precision) + 'T';
      else if (absN >= 1e9) return (n / 1e9).toFixed(precision) + 'B';
      else if (absN >= 1e6) return (n / 1e6).toFixed(precision) + 'M';
      else if (absN >= 1e3) return (n / 1e3).toFixed(precision) + 'K';
      
      return n.toLocaleString(undefined, { maximumFractionDigits: precision });
    } catch {
      return String(humanStr);
    }
  }

  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;

    try {
      // Fetch AfroX price
      const priceData = await getAfroxPriceUSD(publicClient, process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS);
      if (priceData) {
        setAfroxPrice(priceData.priceUSD);
      }

      const decRaw = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'decimals',
        args: [],
      });
      const d = decRaw !== null && decRaw !== undefined ? Number(decRaw) : DEFAULT_DECIMALS;
      setDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);

      if (address) {
        const walletBal = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_PROXY_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        
        if (walletBal !== null) {
          setWalletBalance(toHuman(walletBal));
        } else {
          setWalletBalance('0');
        }
      } else {
        setWalletBalance('0');
      }

      if (address) {
        const stakeInfo = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [address],
        });

        if (stakeInfo) {
          const stakeBalRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
          const rewardValRaw = stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n;
          const lastUnstakeRaw = stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n;
          const lastRewardRaw = stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n;

          setStakedBalance(toHuman(stakeBalRaw ?? 0n));
          setRewardsAccum(toHuman(rewardValRaw ?? 0n));
          setLastUnstakeTs(Number(lastUnstakeRaw ?? 0n));
          setLastRewardTs(Number(lastRewardRaw ?? 0n));
        } else {
          setStakedBalance('0');
          setRewardsAccum('0');
          setLastUnstakeTs(0);
          setLastRewardTs(0);
        }
      } else {
        setStakedBalance('0');
        setRewardsAccum('0');
        setLastUnstakeTs(0);
        setLastRewardTs(0);
      }

      const maxS = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'maximumSupply',
      });
      setMaximumSupply(maxS !== null ? toHuman(maxS) : null);

      const totalS = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'totalSupply',
      });
      setTotalSupply(totalS !== null ? toHuman(totalS) : null);

      const totalMinted = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'totalStakeRewardMinted',
      });
      setTotalStakeRewardMinted(totalMinted !== null ? toHuman(totalMinted) : null);
    } catch (err) {
      console.error('fetchOnChain error', err);
    }
  }, [publicClient, address, toHuman]);

  useEffect(() => {
    fetchOnChain();
    let t;
    if (isConnected) t = setInterval(fetchOnChain, 30_000);
    return () => clearInterval(t);
  }, [fetchOnChain, isConnected]);

  const stakedDays = useMemo(() => {
    const ref = lastUnstakeTs && lastUnstakeTs > 0 ? lastUnstakeTs : lastRewardTs;
    if (!ref || ref <= 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - ref) / 86400);
  }, [lastUnstakeTs, lastRewardTs]);

  const calcProjections = useCallback((principalHuman) => {
    const p = Number(principalHuman || stakedBalance || '0');
    if (!p || p <= 0) return { daily: 0, monthly: 0, yearly: 0 };

    const baseDaily = p * DAILY_RATE_DEC;
    const bonusActive = stakedDays >= FIRST_30_DAYS;
    const bonusDaily = bonusActive ? p * BONUS_DAILY_DEC : 0;

    const daily = baseDaily + bonusDaily;
    const monthly = daily * 30;
    const yearly = (p * DAILY_RATE_DEC * FIRST_30_DAYS) + (p * (DAILY_RATE_DEC + BONUS_DAILY_DEC) * REMAINING_DAYS);

    return { daily, monthly, yearly };
  }, [stakedBalance, stakedDays]);

  // FIXED: Badge tier calculation - now properly compares against human-readable staked balance
  const getBadgeTier = useCallback(() => {
    const staked = Number(stakedBalance || '0');
    
    // Find the first tier where staked amount meets the minimum
    for (const tier of BADGE_TIERS) {
      if (staked >= tier.minStake) {
        return tier;
      }
    }
    
    // Fallback to Starter
    return BADGE_TIERS[BADGE_TIERS.length - 1];
  }, [stakedBalance]);

  const projections = useMemo(() => calcProjections(stakedBalance), [calcProjections, stakedBalance]);
  const badgeTier = useMemo(() => getBadgeTier(), [getBadgeTier]);

  const ensureClient = () => {
    if (!walletClient) throw new Error('Wallet client not available');
    return walletClient;
  };

  async function doApprove(amountHuman) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      const client = ensureClient();
      setLoading(true);
      setTxHash(null);

      const raw = toRaw(amountHuman);
      const tx = await writeContractSafe(client, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, raw],
      });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      
      try {
        if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
        else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      } catch {}
      
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) {
      console.error('approve err', err);
      showAlert('Approve failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function doStake(humanAmount) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      const client = ensureClient();
      if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to stake'); return; }
      setLoading(true);
      setTxHash(null);

      const raw = toRaw(humanAmount);

      const candidates = [
        { addr: STAKING_ADDRESS, fn: 'stake', args: [raw] },
        { addr: STAKING_ADDRESS, fn: 'depositToken', args: [TOKEN_ADDRESS, raw] },
        { addr: TOKEN_ADDRESS, fn: 'stake', args: [raw] }
      ];

      let executed = false;
      for (const c of candidates) {
        try {
          const tx = await writeContractSafe(client, {
            address: c.addr,
            abi: STAKING_ABI,
            functionName: c.fn,
            args: c.args,
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          
          try {
            if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch {}
          
          executed = true;
          break;
        } catch (e) {
          // try next
        }
      }

      if (!executed) {
        const allowRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_PROXY_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });
        
        const allowBig = (allowRaw ?? 0n);
        if (allowBig < raw) {
          showAlert('Allowance low — approving first');
          await doApprove('1000000000000000000');
        }

        try {
          const tx2 = await writeContractSafe(client, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [raw],
          });
          setTxHash(tx2?.hash ?? tx2?.request?.hash ?? null);
          
          try {
            if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
            else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
          } catch {}
          
          executed = true;
        } catch (e) {
          // final failure
        }
      }

      if (!executed) throw new Error('Stake failed after attempts');

      showAlert('Stake confirmed');
      setStakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake err', err);
      showAlert('Stake failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function doUnstake(humanAmount) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      const client = ensureClient();
      if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to unstake'); return; }
      setLoading(true);
      setTxHash(null);

      const raw = toRaw(humanAmount);

      try {
        const tx = await writeContractSafe(client, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'unstake',
          args: [raw],
        });
        setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
        
        try {
          if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
          else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
        } catch {}
      } catch (err1) {
        const tx2 = await writeContractSafe(client, {
          address: TOKEN_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'unstake',
          args: [raw],
        });
        setTxHash(tx2?.hash ?? tx2?.request?.hash ?? null);
        
        try {
          if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
          else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
        } catch {}
      }

      showAlert('Unstake confirmed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake err', err);
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function doClaim() {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      const client = ensureClient();
      setLoading(true);
      setTxHash(null);

      const candidates = ['claim', 'claimReward', 'claimRewards', 'withdrawReward', 'getReward', 'withdraw'];
      let executed = false;

      for (const fn of candidates) {
        try {
          const tx = await writeContractSafe(client, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: fn,
            args: [],
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          
          try {
            if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch {}
          
          executed = true;
          break;
        } catch (e) {
          // try next
        }
      }

      if (!executed) {
        try {
          const tiny = parseUnits('0.0001', decimals);
          
          const tx1 = await writeContractSafe(client, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'unstake',
            args: [tiny],
          });
          
          try {
            if (tx1?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx1.request.hash });
            else if (tx1?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx1.hash });
          } catch {}
          
          const tx2 = await writeContractSafe(client, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [tiny],
          });
          
          try {
            if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
            else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
          } catch {}
          
          executed = true;
        } catch (e) {
          // fallback failed
        }
      }

      if (!executed) {
        showAlert('Claim not available via contract functions or fallbacks.');
      } else {
        showAlert('Claim executed (via contract).');
        await fetchOnChain();
      }
    } catch (err) {
      console.error('claim err', err);
      showAlert('Claim failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  function fillMaxStake() {
    setStakeAmount(walletBalance || '0');
  }
  
  function fillMaxUnstake() {
    setUnstakeAmount(stakedBalance || '0');
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      <header className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">AfroX Staking Dashboard</h1>
          <p className="text-sm text-orange-300/80">Stake AfroX and earn rewards</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-400 mr-2 hidden md:block">Connected:</div>
          <div className="text-xs text-gray-300">{isConnected ? shortAddr(address) : 'Not connected'}</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-12">
        <div className="flex gap-4 mb-6 flex-wrap">
          <button onClick={() => setActiveTab('staking')} className={`px-3 py-2 rounded ${activeTab === 'staking' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>AfroX Staking Dashboard</button>
          <button onClick={() => setActiveTab('lp-mining')} className={`px-3 py-2 rounded ${activeTab === 'lp-mining' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>LP Token Lock-Mining Dashboard</button>
          <a href="https://dex.afrox.one/" target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded bg-gray-900 text-gray-300 hover:bg-orange-600 hover:text-black transition-colors">AfroSwap</a>
          <button onClick={() => setActiveTab('ambassador')} className={`px-3 py-2 rounded ${activeTab === 'ambassador' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>Ambassador Dashboard</button>
          <button onClick={() => setActiveTab('governance')} className={`px-3 py-2 rounded ${activeTab === 'governance' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>Community of Trust Dashboard</button>
        </div>

        {activeTab === 'staking' && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" style={{ boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.02)' }} whileHover={{ ...cardGlow }}>
                <div className="text-sm text-gray-300">Wallet Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  <span>{prettyNumber(walletBalance, 2)} AfroX</span>
                </div>
                {afroxPrice && (
                  <div className="text-xs text-gray-500 mt-1">
                    ≈ {formatUSD(calculateUSDValue(walletBalance, afroxPrice))}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-2">Available in your wallet</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ ...cardGlow }}>
                <div className="text-sm text-gray-300">Staked Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  <span>{prettyNumber(stakedBalance, 2)} AfroX</span>
                </div>
                {afroxPrice && (
                  <div className="text-xs text-gray-500 mt-1">
                    ≈ {formatUSD(calculateUSDValue(stakedBalance, afroxPrice))}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-2">Last reward update: {lastRewardTs ? new Date(lastRewardTs * 1000).toLocaleString() : '—'}</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ ...cardGlow }}>
                <div className="text-sm text-gray-300">Accumulated Rewards</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  <span className="text-green-300">{prettyNumber(rewardsAccum, 2)} AfroX</span>
                </div>
                {afroxPrice && (
                  <div className="text-xs text-gray-500 mt-1">
                    ≈ {formatUSD(calculateUSDValue(rewardsAccum, afroxPrice))}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-2">Last unstake: {lastUnstakeTs ? new Date(lastUnstakeTs * 1000).toLocaleString() : '—'}</div>
              </motion.div>

              {/* FIXED: Badge Tier Card - Now shows correctly */}
              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10 flex flex-col justify-between" whileHover={{ ...cardGlow }}>
                <div>
                  <div className="text-sm text-gray-300">Badge Tier</div>
                  <div className="text-2xl font-semibold text-orange-300 flex items-center gap-2 mt-1">
                    <span className="text-3xl">{badgeTier.emoji}</span>
                    <span>{badgeTier.name}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-gray-300 font-semibold">{badgeTier.threshold}</div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Staked: {prettyNumber(stakedBalance)} AfroX
                  </div>
                </div>
              </motion.div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30" whileHover={{ scale: 1.01 }}>
                <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
                <div className="text-sm text-gray-400 mb-4">Approve Afrox (only if required) then stake.</div>

                <label className="block text-xs text-gray-300 mb-1">Amount (AfroX)</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    step={1 / (10 ** decimals)}
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.0"
                    className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
                  />
                  <button onClick={fillMaxStake} className="px-3 rounded bg-gray-800 border border-gray-700 text-sm">MAX</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => doApprove(stakeAmount || '1000000')} disabled={!isConnected || loading} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium shadow">Approve</button>
                  <button onClick={() => doStake(stakeAmount)} disabled={!isConnected || loading} className="py-3 rounded-xl bg-orange-500 text-black font-semibold">Stake</button>
                </div>

                <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-400 mb-2 font-semibold">Badge Tier Requirements:</div>
                  <div className="text-[10px] text-gray-300 leading-relaxed space-y-1">
                    <div>🔰Cadet ≥1B | 🔱Captain ≥10B | ⚜️Commander ≥50B | ⭐General ≥100B</div>
                    <div>〽️Marshal ≥500B | 💠Platinum Sentinel ≥1T | ❇️Diamond Custodian ≥10T</div>
                  </div>
                </div>
                {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
              </motion.div>

              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30" whileHover={{ scale: 1.01 }}>
                <h2 className="text-xl font-bold mb-3">Unstake & Claim</h2>
                <div className="text-sm text-gray-400 mb-4">Unstake tokens (this also auto-claims rewards). Alternatively use Claim to run a tiny unstake/restake claim if contract has no claim fn.</div>

                <label className="block text-xs text-gray-300 mb-1">Amount to Unstake</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    step={1 / (10 ** decimals)}
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="0.0"
                    className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
                  />
                  <button onClick={fillMaxUnstake} className="px-3 rounded bg-gray-800 border border-gray-700 text-sm">MAX</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => doUnstake(unstakeAmount)} disabled={!isConnected || loading} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium">Unstake</button>
                  <button onClick={() => doClaim()} disabled={!isConnected || loading} className="py-3 rounded-xl bg-orange-500 text-black font-semibold">Claim Rewards</button>
                </div>

                <div className="mt-4 text-xs text-gray-400">Note: your proxy auto-claims rewards on stake/unstake. To manually trigger claim without separate claim function, stake/unstake a tiny amount (e.g. 0.0001 AfroX).</div>
              </motion.div>
            </section>

            {/* Reward Projections */}
            <section className="mb-6">
              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10" whileHover={{ ...cardGlow }}>
                <h2 className="text-xl font-bold mb-4">Reward Projections</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-800 rounded-xl text-center">
                    <div className="text-sm text-gray-400">Daily</div>
                    <div className="text-xl font-bold text-green-400 mt-1">{prettyNumber(projections.daily)} AfroX</div>
                    {afroxPrice && (
                      <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(projections.daily, afroxPrice))}</div>
                    )}
                  </div>
                  <div className="p-4 bg-gray-800 rounded-xl text-center">
                    <div className="text-sm text-gray-400">Monthly</div>
                    <div className="text-xl font-bold text-green-400 mt-1">{prettyNumber(projections.monthly)} AfroX</div>
                    {afroxPrice && (
                      <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(projections.monthly, afroxPrice))}</div>
                    )}
                  </div>
                  <div className="p-4 bg-gray-800 rounded-xl text-center">
                    <div className="text-sm text-gray-400">Yearly</div>
                    <div className="text-xl font-bold text-green-400 mt-1">{prettyNumber(projections.yearly)} AfroX</div>
                    {afroxPrice && (
                      <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(projections.yearly, afroxPrice))}</div>
                    )}
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500 text-center">
                  Base: 0.6%/day {stakedDays >= 30 && '+ 0.06% bonus'} | Days staked: {stakedDays}
                </div>
              </motion.div>
            </section>

            <div className="mt-4">
              <div className="p-4 bg-[#0b0b0b] rounded border border-gray-800 text-sm text-gray-300">
                ⚠️ <strong>Important Disclaimer:</strong> By using this platform you confirm you are of legal age, live in a jurisdiction where staking crypto is permitted, and accept all liability and risk.
              </div>

              <footer className="border-t border-gray-800 py-6 mt-6">
                <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">
                  © 2019-2025 AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
                </div>
              </footer>
            </div>
          </>
        )}

        {activeTab === 'lp-mining' && <LPMiningDashboard />}

        {activeTab === 'ambassador' && <AmbassadorDashboard />}

        {activeTab === 'governance' && <GovernanceDashboard />}
      </main>

      {alertMsg && <div className="fixed right-4 bottom-4 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg z-50">{alertMsg}</div>}
    </div>
  );
}
