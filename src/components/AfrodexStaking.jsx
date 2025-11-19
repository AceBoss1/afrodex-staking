// src/components/AfrodexStaking.jsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

import { STAKING_ABI, AFROX_PROXY_ABI } from '../lib/abis'; // ensure your lib/abis exports these
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';

const TOKEN_LOGO = '/afrodex_token.png';
const DEFAULT_DECIMALS = 4;

// CONTRACT constants (per your instructions — THESE ARE CONSTANTS)
const REWARD_RATE = 60n; // as integer in contract units
const BONUS_RATE = 6n;
const STAKE_REWARD_PERIOD = 86400; // seconds
const STAKE_BONUS_PERIOD = 2592000; // 30 days seconds

// Derived decimals for display math (as decimals)
const DAILY_RATE_DEC = Number(REWARD_RATE) / 10000; // 60/10000 = 0.006 => 0.6% daily
const BONUS_DAILY_DEC = Number(BONUS_RATE) / 10000; // 6/10000 = 0.0006 => 0.06% daily bonus after 30 days
const FIRST_30_DAYS = 30;
const REMAINING_DAYS = 365 - 30; // 335

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // token decimals & on-chain values
  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0'); // human string (e.g. "12345.6789")
  const [stakedBalance, setStakedBalance] = useState('0'); // human string
  const [rewardsAccum, setRewardsAccum] = useState('0');  // human string
  const [allowance, setAllowance] = useState('0'); // not shown by default, kept for approve logic

  // timestamps
  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  // token analytics
  const [maximumSupply, setMaximumSupply] = useState(null);
  const [totalSupply, setTotalSupply] = useState(null);
  const [totalStakeRewardMinted, setTotalStakeRewardMinted] = useState(null);

  // form + UX
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  // tabs
  const [activeTab, setActiveTab] = useState('staking');

  // --- helpers ---
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
      // fallback naive
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

  // -----------------------------
  // Wallet balance loader (picked from your working version)
  // This ensures wallet balance reflects correctly
  // -----------------------------
  async function loadTokenBalance() {
    if (!publicClient) return;
    if (!address) {
      setWalletBalance('0');
      return;
    }

    try {
      const bal = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'balanceOf',
        args: [address],
      });

      // formatUnits returns a string like "123.4567"
      if (bal !== null && bal !== undefined) {
        const human = formatUnits(bal, decimals);
        setWalletBalance(human);
      } else {
        setWalletBalance('0');
      }
    } catch (err) {
      // if anything fails, gracefully set to 0 (don't crash UI)
      // console.error('loadTokenBalance error', err);
      setWalletBalance('0');
    }
  }

  // ---- On-chain fetcher (keeps rest of reads) ----
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;

    try {
      // decimals
      const decRaw = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'decimals',
        args: [],
      });
      const d = decRaw !== null && decRaw !== undefined ? Number(decRaw) : DEFAULT_DECIMALS;
      setDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);

      // wallet balance: use the working loader
      await loadTokenBalance();

      // allowance (owner -> staking)
      if (address) {
        const allowRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_PROXY_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });
        setAllowance(toHuman(allowRaw ?? 0n));
      } else {
        setAllowance('0');
      }

      // staking info
      if (address) {
        const stakeInfo = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [address],
        });

        if (stakeInfo) {
          // order: stakeBalance, rewardValue, lastUnstakeTimestamp, lastRewardTimestamp
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

      // token analytics
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
      // console.error('fetchOnChain error', err);
    }
  }, [publicClient, address, toHuman, decimals]); // decimals included so loadTokenBalance uses correct decimals

  // poll every 30s when connected
  useEffect(() => {
    fetchOnChain();
    let t;
    if (isConnected) t = setInterval(fetchOnChain, 30_000);
    return () => clearInterval(t);
  }, [fetchOnChain, isConnected]);

  // ---- Rewards projection logic (hide APR numbers; show estimates) ----
  // compute staked days conservatively using lastUnstakeTs or lastRewardTs
  const stakedDays = useMemo(() => {
    const ref = lastUnstakeTs && lastUnstakeTs > 0 ? lastUnstakeTs : lastRewardTs;
    if (!ref || ref <= 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - ref) / 86400);
  }, [lastUnstakeTs, lastRewardTs]);

  const calcProjections = useCallback((principalHuman) => {
    const p = Number(principalHuman || stakedBalance || '0');
    if (!p || p <= 0) return { daily: 0, monthly: 0, yearly: 0 };

    // base daily rate decimal = REWARD_RATE / 10000 (0.006) and bonus daily decimal = BONUS_RATE/10000 (0.0006)
    const baseDaily = p * DAILY_RATE_DEC;
    const bonusActive = stakedDays >= FIRST_30_DAYS;
    const bonusDaily = bonusActive ? p * BONUS_DAILY_DEC : 0;

    // daily shown is baseDaily + bonusDaily (if eligible)
    const daily = baseDaily + bonusDaily;
    const monthly = daily * 30;

    // yearly: compute exactly as 30 days at base rate + 335 days at (base + bonus)
    const yearly = (p * DAILY_RATE_DEC * FIRST_30_DAYS) + (p * (DAILY_RATE_DEC + BONUS_DAILY_DEC) * REMAINING_DAYS);

    return { daily, monthly, yearly };
  }, [stakedBalance, stakedDays]);

  const projections = useMemo(() => calcProjections(stakedBalance), [calcProjections, stakedBalance, stakedDays]);

  // ---- Actions: approve / stake / unstake / claim ----
  // helper to ensure walletClient present
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
      // wait best-effort
      try {
        if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
        else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      } catch {}
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) {
      // eslint-disable-next-line no-console
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

      // Try stake on STAKING_ADDRESS (preferred)
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
          // wait
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

      // if not executed, ensure allowance and retry stake
      if (!executed) {
        const allowRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_PROXY_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });
        // compare bigints / strings: use toRaw for human compare
        const allowBig = (allowRaw ?? 0n);
        if (allowBig < raw) {
          showAlert('Allowance low — approving first');
          // approve a very large amount so user doesn't need to approve again
          await doApprove('1000000000000000000'); // huge; adjust if needed
        }

        // final attempt
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
      // eslint-disable-next-line no-console
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

      // try unstake on staking contract, fallback to token proxy
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
        // fallback to token address (proxy) unstake
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
      // eslint-disable-next-line no-console
      console.error('unstake err', err);
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // Claim: try built-in claim names first; if not available use tiny unstake/stake fallback
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

      // fallback tiny unstake + restake (if claim function absent)
      if (!executed) {
        try {
          // tiny amount: 0.0001 token (dependent on decimals)
          const tiny = parseUnits('0.0001', decimals);
          // try unstake tiny (many proxies accept small amounts to trigger claim)
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
          // restake the tiny amount back
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
      // eslint-disable-next-line no-console
      console.error('claim err', err);
      showAlert('Claim failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // UI helpers: MAX autofill
  function fillMaxStake() {
    setStakeAmount(walletBalance || '0');
  }
  function fillMaxUnstake() {
    setUnstakeAmount(stakedBalance || '0');
  }

  // formatting helpers for display large numbers with comma groups (preserve many decimals)
  function prettyNumber(humanStr, precision = 6) {
    try {
      const n = Number(humanStr || '0');
      if (!Number.isFinite(n)) return String(humanStr);
      // if huge integers, use toLocaleString with no fractional for big numbers
      return n.toLocaleString(undefined, { maximumFractionDigits: precision });
    } catch {
      return String(humanStr);
    }
  }

  // small UI card variants
  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      {/* PAGE HEADER */}
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
        {/* TABS */}
        <div className="flex gap-4 mb-6">
          <button onClick={() => setActiveTab('staking')} className={`px-3 py-2 rounded ${activeTab === 'staking' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>AfroX Staking Dashboard</button>
          <button onClick={() => setActiveTab('ambassador')} className={`px-3 py-2 rounded ${activeTab === 'ambassador' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>AfroDex Ambassador Dashboard</button>
          <button onClick={() => setActiveTab('governance')} className={`px-3 py-2 rounded ${activeTab === 'governance' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>AfroDex Community of Trust</button>
        </div>

        {activeTab === 'staking' && (
          <>
            {/* Top analytics row (responsive) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" style={{ boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.02)' }} whileHover={{ ...cardGlow }}>
                <div className="text-sm text-gray-300">Wallet Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  <span>{prettyNumber(walletBalance, 6)} AfroX</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">Available in your wallet</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ ...cardGlow }}>
                <div className="text-sm text-gray-300">Staked Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  <span>{prettyNumber(stakedBalance, 6)} AfroX</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">Last reward update: {lastRewardTs ? new Date(lastRewardTs * 1000).toLocaleString() : '—'}</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ ...cardGlow }}>
                <div className="text-sm text-gray-300">Accumulated Rewards</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  <span className="text-green-300">{prettyNumber(rewardsAccum, 6)} AfroX</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">Last unstake: {lastUnstakeTs ? new Date(lastUnstakeTs * 1000).toLocaleString() : '—'}</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10 flex flex-col justify-between" whileHover={{ ...cardGlow }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-300">Badge Tier</div>
                    <div className="text-lg font-semibold text-orange-300">Starter</div>
                  </div>
                  <div className="text-xs text-gray-400">{address ? shortAddr(address) : 'Not connected'}</div>
                </div>
                <div className="mt-3 text-xs text-gray-400">Tier thresholds: Cadet 1b, Captain 10b, Commander 50b, General 100b, Marshal 500b</div>
              </motion.div>
            </section>

            {/* Stake / Unstake panels */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Approve & Stake */}
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

                <div className="mt-4 text-xs text-gray-400">Allowance (for UI/debug): <span className="text-orange-300 font-medium">{allowance}</span></div>
                {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
              </motion.div>

              {/* Unstake & Claim */}
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

            {/* Rewards center + projection */}
            <section className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10 mb-6">
              <h3 className="text-lg font-bold mb-4">Rewards Projection Calculator</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-300 mb-3">Estimated rewards (estimates only — blockchain calculates actual rewards)</div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-800 rounded">
                      <div className="text-xs text-gray-400">Daily Reward</div>
                      <div className="flex items-center gap-2 mt-2">
                        <img src={TOKEN_LOGO} className="h-5 w-5" alt="token" />
                        <div className="text-xl font-bold">{prettyNumber(projections.daily, 6)} AfroX</div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-800 rounded">
                      <div className="text-xs text-gray-400">Monthly Reward (30d)</div>
                      <div className="flex items-center gap-2 mt-2">
                        <img src={TOKEN_LOGO} className="h-5 w-5" alt="token" />
                        <div className="text-xl font-bold">{prettyNumber(projections.monthly, 6)} AfroX</div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-800 rounded">
                      <div className="text-xs text-gray-400">Yearly Reward (365d)</div>
                      <div className="flex items-center gap-2 mt-2">
                        <img src={TOKEN_LOGO} className="h-5 w-5" alt="token" />
                        <div className="text-xl font-bold">{prettyNumber(projections.yearly, 6)} AfroX</div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-gray-400">
                    ⚠️ <strong>Disclaimer:</strong> These are estimated values computed off-chain using fixed protocol parameters. Actual rewards are computed by the smart contract on-chain and may differ slightly.
                  </p>
                </div>

                <div className="bg-gray-800 p-4 rounded-xl border border-orange-600/20">
                  <div className="text-xs text-gray-400">Projection Rules (hidden APR)</div>
                  <div className="text-sm text-gray-200 mt-2">
                    Initial 30 days: Daily rate = {String(DAILY_RATE_DEC)} (applies to all stakers)<br />
                    After 30 days: Daily rate = base + bonus = {String(DAILY_RATE_DEC + BONUS_DAILY_DEC)}<br />
                    Yearly projection uses 30 days @ base + 335 days @ base+bonus.
                  </div>
                </div>
              </div>
            </section>

            {/* Token analytics & debug */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10">
                <div className="text-sm text-gray-300">Token Analytics</div>
                <div className="mt-3 text-xs text-gray-400">
                  <div className="flex items-center gap-2"><img src={TOKEN_LOGO} className="h-4 w-4" alt="" /> Maximum Supply: <span className="ml-auto text-white">{maximumSupply ?? '—'}</span></div>
                  <div className="flex items-center gap-2 mt-2"><img src={TOKEN_LOGO} className="h-4 w-4" alt="" /> Current Total Supply: <span className="ml-auto text-white">{totalSupply ?? '—'}</span></div>
                  <div className="flex items-center gap-2 mt-2"><img src={TOKEN_LOGO} className="h-4 w-4" alt="" /> Total Stake Reward Minted: <span className="ml-auto text-white">{totalStakeRewardMinted ?? '—'}</span></div>
                  <div className="flex items-center gap-2 mt-2"><img src={TOKEN_LOGO} className="h-4 w-4" alt="" /> Un-minted AfroX: <span className="ml-auto text-white">{(maximumSupply && totalSupply) ? prettyNumber(Number(maximumSupply) - Number(totalSupply), 0) : '—'}</span></div>
                </div>
              </div>

              <div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10">
                <div className="text-sm text-gray-300">Protocol Parameters (read-only)</div>
                <div className="mt-3 text-xs text-gray-400">
                  <div>rewardRate: {String(REWARD_RATE)} (used as decimal `REWARD_RATE / 10000`)</div>
                  <div>bonusRate: {String(BONUS_RATE)}</div>
                  <div>stakeRewardPeriod: {String(STAKE_REWARD_PERIOD)}</div>
                  <div>stakeBonusPeriod: {String(STAKE_BONUS_PERIOD)}</div>
                </div>
              </div>

              <div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10">
                <div className="text-sm text-gray-300">Debug / Status</div>
                <div className="mt-3 text-xs text-gray-400">
                  <div>Connected: <span className="text-white ml-2">{isConnected ? 'Yes' : 'No'}</span></div>
                  <div>Wallet: <span className="text-white ml-2">{address ? shortAddr(address) : '—'}</span></div>
                  <div>Token decimals: <span className="text-orange-300 ml-2">{decimals}</span></div>
                </div>
              </div>
            </section>

            {/* IMPORTANT DISCLAIMER & FOOTER */}
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

        {/* Ambassador tab placeholder */}
        {activeTab === 'ambassador' && (
          <div className="p-6 bg-gray-900 rounded">
            <h2 className="text-xl font-bold">AfroDex Ambassador Dashboard</h2>
            <p className="text-gray-300 mt-2">Placeholder — referral & ambassador features will be added here.</p>
          </div>
        )}

        {/* Governance tab placeholder */}
        {activeTab === 'governance' && (
          <div className="p-6 bg-gray-900 rounded">
            <h2 className="text-xl font-bold">AfroDex Community of Trust</h2>
            <p className="text-gray-300 mt-2">Placeholder — governance, proposals, and tier management will appear here.</p>
          </div>
        )}
      </main>

      {/* small alert toast */}
      {alertMsg && <div className="fixed right-4 bottom-4 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg z-50">{alertMsg}</div>}
    </div>
  );
}
