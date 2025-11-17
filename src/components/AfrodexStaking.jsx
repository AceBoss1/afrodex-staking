// src/components/AfrodexStaking.jsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { ethers } from 'ethers';

import { STAKING_ABI, AFROX_TOKEN_ABI } from '../lib/abis'; // keep existing exports
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';

// UI constants
const DEFAULT_DECIMALS = 4;
const PRICE_USD_STATIC = 0.000001; // display only (estimates)
const TOKEN_LABEL = 'AfroX';
const TOKEN_ICON = '/afrodex_token.png';

// Reward rule constants (from on-chain)
const DAILY_BASE_RATE_DECIMAL = 0.0060;   // 0.60% daily
const DAILY_BONUS_RATE_DECIMAL = 0.0006;  // 0.06% daily bonus after 30 days
const BONUS_ACTIVATION_DAYS = 30;

// helper: short address
const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '—');

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();

  // UI + form
  const [amount, setAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // on-chain human values
  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');

  // timestamps from viewStakeInfoOf
  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  // tx / loading
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  // rewards calculator inputs
  const [calcDays, setCalcDays] = useState(30);
  const [calcAmt, setCalcAmt] = useState('0');

  // small alert helper
  const showAlert = (m, t = 5000) => {
    setAlertMsg(String(m));
    setTimeout(() => setAlertMsg(null), t);
  };

  // format timestamp
  const fmtTs = (s) => (!s || s <= 0 ? 'N/A' : new Date(Number(s) * 1000).toLocaleString());

  // toHuman / toRaw using decimals
  const toHuman = useCallback((raw) => {
    try {
      if (raw === null || raw === undefined) return '0';
      return formatUnits(raw, decimals);
    } catch {
      // fallback naive
      try {
        const n = Number(raw ?? 0) / 10 ** (decimals || DEFAULT_DECIMALS);
        return String(n);
      } catch {
        return '0';
      }
    }
  }, [decimals]);

  const toRaw = useCallback((human) => {
    try {
      return parseUnits(String(human || '0'), decimals || DEFAULT_DECIMALS);
    } catch {
      return 0n;
    }
  }, [decimals]);

  // fetch on-chain safely (uses readContractSafe)
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;
    try {
      // token decimals from TOKEN_ADDRESS (proxy)
      const decRaw = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_TOKEN_ABI,
        functionName: 'decimals',
      });
      const d = decRaw !== null && decRaw !== undefined ? Number(decRaw) : DEFAULT_DECIMALS;
      setDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);

      if (!address) {
        setWalletBalance('0'); setStakedBalance('0'); setRewards('0'); setAllowance('0');
        setLastUnstakeTs(0); setLastRewardTs(0);
        return;
      }

      // wallet balance
      try {
        const balRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        setWalletBalance(toHuman(balRaw ?? 0n));
      } catch {
        setWalletBalance('0');
      }

      // allowance
      try {
        const allowRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });
        setAllowance(toHuman(allowRaw ?? 0n));
      } catch {
        setAllowance('0');
      }

      // stake info of
      try {
        const stakeInfo = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [address],
        });

        if (stakeInfo) {
          const stakeBalRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
          const rewardValRaw = stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n;
          const lastUnRaw = stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n;
          const lastRewardRaw = stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n;

          setStakedBalance(toHuman(stakeBalRaw ?? 0n));
          setRewards(toHuman(rewardValRaw ?? 0n));
          setLastUnstakeTs(Number(lastUnRaw ?? 0n));
          setLastRewardTs(Number(lastRewardRaw ?? 0n));
        } else {
          setStakedBalance('0'); setRewards('0'); setLastUnstakeTs(0); setLastRewardTs(0);
        }
      } catch (err) {
        // fallback try balanceOf on staking contract (rare)
        try {
          const stBal = await readContractSafe(publicClient, {
            address: STAKING_ADDRESS,
            abi: AFROX_TOKEN_ABI,
            functionName: 'balanceOf',
            args: [address],
          });
          setStakedBalance(toHuman(stBal ?? 0n));
          setRewards('0'); setLastUnstakeTs(0); setLastRewardTs(0);
        } catch (_) {
          setStakedBalance('0'); setRewards('0'); setLastUnstakeTs(0); setLastRewardTs(0);
        }
      }
    } catch (err) {
      console.error('fetchOnChain', err);
    }
  }, [publicClient, address, toHuman]);

  // initial + polling
  useEffect(() => {
    fetchOnChain();
    let t;
    if (isConnected) t = setInterval(fetchOnChain, 30_000);
    return () => clearInterval(t);
  }, [fetchOnChain, isConnected]);

  // keep calculator amount default to staked
  useEffect(() => setCalcAmt(stakedBalance || '0'), [stakedBalance]);

  // compute days since timestamp
  const daysSince = (tsSeconds) => {
    if (!tsSeconds || tsSeconds <= 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - tsSeconds) / 86400);
  };

  const stakedDays = useMemo(() => {
    // conservative: use lastUnstake if > 0 else lastReward
    if (!lastUnstakeTs || lastUnstakeTs === 0) return daysSince(lastRewardTs);
    return daysSince(lastUnstakeTs);
  }, [lastUnstakeTs, lastRewardTs]);

  const has30DayBonus = stakedDays >= BONUS_ACTIVATION_DAYS;

  // Estimates-only reward calculations following on-chain logic:
  // first 30 days: DAILY_BASE_RATE_DECIMAL
  // after 30 days: DAILY_BASE_RATE_DECIMAL + DAILY_BONUS_RATE_DECIMAL
  function estimateRewardsFor(principalHuman, days) {
    const p = Number(principalHuman || 0);
    const d = Number(days || 0);
    if (!p || !d) return { daily: 0, monthly: 0, yearly: 0 };

    // daily estimate: use current eligibility (if user has already staked ≥30 days we can apply bonus)
    const dailyNow = has30DayBonus ? (DAILY_BASE_RATE_DECIMAL + DAILY_BONUS_RATE_DECIMAL) : DAILY_BASE_RATE_DECIMAL;

    // For realistic projection over an arbitrary period, compute day by day:
    let tokens = 0;
    for (let i = 1; i <= d; i++) {
      const rate = i > BONUS_ACTIVATION_DAYS ? (DAILY_BASE_RATE_DECIMAL + DAILY_BONUS_RATE_DECIMAL) : DAILY_BASE_RATE_DECIMAL;
      tokens += p * rate;
    }

    const daily = p * dailyNow;
    const monthly = tokens; // tokens over 'd' days (use caller to set d=30 for monthly)
    const yearly = (() => {
      // approximate 365-day series: compute first 30 at base, remaining 335 at base+bonus
      const first30 = p * DAILY_BASE_RATE_DECIMAL * Math.min(30, 365);
      const rest = p * (DAILY_BASE_RATE_DECIMAL + DAILY_BONUS_RATE_DECIMAL) * Math.max(0, 365 - 30);
      return first30 + rest;
    })();

    return { daily, monthly: tokens, yearly };
  }

  const calcResult = useMemo(() => estimateRewardsFor(Number(calcAmt || 0), Number(calcDays || 30)), [calcAmt, calcDays, has30DayBonus]);

  // ----- robust write helper -----
  // Try to use writeContractSafe (your wrapper) which expects walletClient with writeContract.
  // If walletClient.writeContract is not available, attempt walletClient.request EIP-1193 with eth_sendTransaction.
  async function doWrite({ address: to, abi, functionName, args = [] }) {
    if (!walletClient) throw new Error('Wallet client unavailable');
    // prefer wrapper which handles many provider shapes
    try {
      if (typeof walletClient.writeContract === 'function') {
        // use your wrapper to get consistent results
        const tx = await writeContractSafe(walletClient, { address: to, abi, functionName, args });
        return tx;
      }
    } catch (err) {
      // bubble to fallback
      console.warn('writeContractSafe failed, falling back to request:', err?.message ?? err);
    }

    // fallback: encode function and use walletClient.request (EIP-1193)
    // requires ethers to encode
    try {
      if (typeof walletClient.request === 'function') {
        const iface = new ethers.utils.Interface(abi);
        const data = iface.encodeFunctionData(functionName, args.map((a) => (typeof a === 'bigint' ? ethers.BigNumber.from(a.toString()) : a)));
        // Build a transaction object; user wallet will fill gas, nonce, chainId
        const tx = {
          to,
          data,
        };
        // If wallet client exposes accounts, use first account
        // wagmi walletClient.request expects EIP-1193 style
        const res = await walletClient.request({ method: 'eth_sendTransaction', params: [tx] });
        return { hash: res };
      } else {
        throw new Error('walletClient has no writeContract or request method');
      }
    } catch (err) {
      // surface a friendly error
      throw new Error('Transaction failed: ' + (err?.message ?? err));
    }
  }

  // ---- actions: approve / stake / unstake / claim ----

  async function handleApprove(humanAmount) {
    if (!isConnected || !walletClient) { showAlert('Connect wallet'); return; }
    const amt = humanAmount ?? amount;
    if (!amt || Number(amt) <= 0) { showAlert('Enter amount to approve'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(amt);
      const tx = await doWrite({ address: TOKEN_ADDRESS, abi: AFROX_TOKEN_ABI, functionName: 'approve', args: [STAKING_ADDRESS, raw] });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? tx?.transactionHash ?? String(tx));
      // best-effort wait via publicClient
      try {
        if (publicClient) {
          const h = tx?.hash ?? tx?.request?.hash ?? tx?.transactionHash ?? tx;
          if (h) await publicClient.waitForTransactionReceipt({ hash: String(h) });
        }
      } catch {}
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) {
      console.error('approve failed', err);
      showAlert('Approve failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  }

  async function handleStake(humanAmount) {
    if (!isConnected || !walletClient) { showAlert('Connect wallet'); return; }
    const amt = humanAmount ?? amount;
    if (!amt || Number(amt) <= 0) { showAlert('Enter amount to stake'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(amt);

      // candidate calls: depositToken(token, amount) OR stake(amount) on staking address OR stake on token proxy
      const candidates = [
        { address: STAKING_ADDRESS, abi: STAKING_ABI, fn: 'depositToken', args: [TOKEN_ADDRESS, raw] },
        { address: STAKING_ADDRESS, abi: STAKING_ABI, fn: 'stake', args: [raw] },
        { address: TOKEN_ADDRESS, abi: STAKING_ABI, fn: 'stake', args: [raw] },
      ];

      let executed = false;
      for (const c of candidates) {
        try {
          const tx = await doWrite({ address: c.address, abi: c.abi, functionName: c.fn, args: c.args });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? tx?.transactionHash ?? String(tx));
          // wait
          try { if (publicClient) { const h = tx?.hash ?? tx?.transactionHash ?? tx; if (h) await publicClient.waitForTransactionReceipt({ hash: String(h) }); } } catch {}
          executed = true;
          break;
        } catch (err) {
          // try next candidate
          continue;
        }
      }

      // If not executed, ensure allowance then try stake on staking address
      if (!executed) {
        const allowRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });
        if ((allowRaw ?? 0n) < raw) {
          showAlert('Allowance low — approving first');
          await handleApprove( (10 ** 9).toString() ); // big approve. adjust as you see fit.
        }
        // final stake attempt
        const tx2 = await doWrite({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [raw] });
        setTxHash(tx2?.hash ?? tx2?.request?.hash ?? tx2?.transactionHash ?? String(tx2));
        try { if (publicClient) { const h = tx2?.hash ?? tx2?.transactionHash ?? tx2; if (h) await publicClient.waitForTransactionReceipt({ hash: String(h) }); } } catch {}
        executed = true;
      }

      if (!executed) throw new Error('Stake failed after attempts');
      showAlert('Stake confirmed');
      setAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake failed', err);
      showAlert('Stake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  }

  async function handleUnstake(humanAmount) {
    if (!isConnected || !walletClient) { showAlert('Connect wallet'); return; }
    const amt = humanAmount ?? unstakeAmount;
    if (!amt || Number(amt) <= 0) { showAlert('Enter amount to unstake'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(amt);

      // try unstake on staking address first, then proxy
      try {
        const tx = await doWrite({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [raw] });
        setTxHash(tx?.hash ?? tx?.request?.hash ?? tx?.transactionHash ?? String(tx));
        try { if (publicClient) { const h = tx?.hash ?? tx?.transactionHash ?? tx; if (h) await publicClient.waitForTransactionReceipt({ hash: String(h) }); } } catch {}
      } catch (err1) {
        // fallback to token/proxy unstake
        const tx2 = await doWrite({ address: TOKEN_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [raw] });
        setTxHash(tx2?.hash ?? tx2?.request?.hash ?? tx2?.transactionHash ?? String(tx2));
        try { if (publicClient) { const h = tx2?.hash ?? tx2?.transactionHash ?? tx2; if (h) await publicClient.waitForTransactionReceipt({ hash: String(h) }); } } catch {}
      }

      showAlert('Unstake confirmed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake failed', err);
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  }

  async function handleClaim() {
    if (!isConnected || !walletClient) { showAlert('Connect wallet'); return; }
    setLoading(true);
    setTxHash(null);
    const candidates = ['claim', 'claimRewards', 'withdrawReward', 'getReward', 'withdraw'];
    try {
      let executed = false;
      for (const fn of candidates) {
        try {
          const tx = await doWrite({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: fn, args: [] });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? tx?.transactionHash ?? String(tx));
          try { if (publicClient) { const h = tx?.hash ?? tx?.transactionHash ?? tx; if (h) await publicClient.waitForTransactionReceipt({ hash: String(h) }); } } catch {}
          executed = true;
          break;
        } catch (e) {
          // try next
        }
      }

      // If no explicit claim function - try tiny unstake/retake fallback
      if (!executed) {
        try {
          const tiny = parseUnits('1', decimals || DEFAULT_DECIMALS); // 1 base unit
          const tx1 = await doWrite({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [tiny] });
          try { if (publicClient) { const h = tx1?.hash ?? tx1?.transactionHash ?? tx1; if (h) await publicClient.waitForTransactionReceipt({ hash: String(h) }); } } catch {}
          const tx2 = await doWrite({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [tiny] });
          try { if (publicClient) { const h = tx2?.hash ?? tx2?.transactionHash ?? tx2; if (h) await publicClient.waitForTransactionReceipt({ hash: String(h) }); } } catch {}
          executed = true;
          showAlert('Claim fallback (tiny unstake + restake) executed');
        } catch (e) {
          // nothing we can do
        }
      }

      if (!executed) showAlert('Claim not available on this contract');
      else await fetchOnChain();
    } catch (err) {
      console.error('claim failed', err);
      showAlert('Claim failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  }

  // Responsive grid classes used, cards will stack in mobile
  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      {/* Header area */}
      <header className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">AfroX Staking Dashboard</h1>
          <p className="text-sm text-orange-300/80">Stake AfroX and earn rewards</p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectButton />
        </div>
      </header>

      {/* Tabs (Staking, Ambassador, Community) */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-2 mb-4">
          <button className="px-3 py-2 rounded bg-orange-500 text-black font-semibold">Staking Dashboard</button>
          <button className="px-3 py-2 rounded bg-gray-800 text-gray-300">AfroDex Ambassador Dashboard</button>
          <button className="px-3 py-2 rounded bg-gray-800 text-gray-300">AfroDex Community of Trust</button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 pb-12">
        {/* Top analytics row (4 cards) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" style={{ boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.02)' }} whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
            <div className="text-sm text-gray-300 flex justify-between">
              <span>Your Stake</span>
            </div>
            <div className="text-2xl font-bold flex items-center gap-2 mt-2">
              <img src={TOKEN_ICON} alt="AfroX" className="h-6 w-6 rounded-full" />
              <span>{stakedBalance} {TOKEN_LABEL}</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">Last reward update: {fmtTs(lastRewardTs)}</div>
          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
            <div className="text-sm text-gray-300">Rewards</div>
            <div className="text-2xl font-bold flex items-center gap-2 mt-2">
              <img src={TOKEN_ICON} alt="AfroX" className="h-6 w-6 rounded-full" />
              <span>{rewards} {TOKEN_LABEL}</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">Last unstake: {fmtTs(lastUnstakeTs)}</div>
          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
            <div className="text-sm text-gray-300">Wallet Balance</div>
            <div className="text-2xl font-bold flex items-center gap-2 mt-2">
              <img src={TOKEN_ICON} alt="AfroX" className="h-5 w-5 rounded-full" />
              <span>{walletBalance} {TOKEN_LABEL}</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">Allowance: {allowance}</div>
          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10 flex flex-col justify-between" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">Badge Tier</div>
                <div className="text-lg font-semibold text-orange-300">Starter</div>
              </div>
              <div className="text-xs text-gray-400">{address ? shortAddr(address) : 'Not connected'}</div>
            </div>
            <div className="mt-3 text-xs text-gray-400">Tier thresholds: 1b, 10b, 50b, 100b, 500b</div>
          </motion.div>
        </section>

        {/* Approve/Stake & Unstake/Claim */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Approve & Stake */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
            <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
            <div className="text-sm text-gray-400 mb-4">Approve AfroX and stake it to start earning rewards.</div>

            <label className="block text-xs text-gray-300 mb-1">Amount (AfroX)</label>
            <input
              type="number"
              step={1 / (10 ** (decimals || DEFAULT_DECIMALS))}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleApprove(amount || '1000000')} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium shadow" disabled={!isConnected || loading}>
                Approve
              </button>

              <button onClick={() => handleStake(amount)} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={!isConnected || loading}>
                Stake
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-400">Allowance: <span className="text-orange-300 font-medium">{allowance}</span></div>
            {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
          </motion.div>

          {/* Unstake & Claim */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
            <h2 className="text-xl font-bold mb-3">Unstake & Claim</h2>
            <div className="text-sm text-gray-400 mb-4">Unstake tokens and claim your rewards.</div>

            <label className="block text-xs text-gray-300 mb-1">Amount to Unstake</label>
            <input
              type="number"
              step={1 / (10 ** (decimals || DEFAULT_DECIMALS))}
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="0.0"
              className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleUnstake(unstakeAmount)} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium" disabled={!isConnected || loading}>
                Unstake
              </button>

              <button onClick={() => handleClaim()} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={!isConnected || loading}>
                Claim Rewards
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-400">Your Rewards: <span className="text-orange-300 font-medium">{rewards} {TOKEN_LABEL}</span></div>
          </motion.div>
        </section>

        {/* Rewards center: Estimates only + mini APR card */}
        <section className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10 mb-6">
          <h3 className="text-lg font-bold mb-4">Rewards Center</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* Calculator (span 2) */}
            <div className="md:col-span-2">
              <div className="text-sm text-gray-300 mb-3">Estimated rewards (estimates only — actual rewards are determined on-chain)</div>

              <label className="block text-xs text-gray-400 mb-1">Days to Project</label>
              <input
                type="number"
                step="1"
                value={calcDays}
                onChange={(e) => setCalcDays(Number(e.target.value))}
                className="w-full p-2 rounded bg-gray-800 text-white mb-3"
              />

              <label className="block text-xs text-gray-400 mb-1">Amount to Project (AfroX)</label>
              <input
                type="number"
                step={1 / (10 ** (decimals || DEFAULT_DECIMALS))}
                value={calcAmt}
                onChange={(e) => setCalcAmt(e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white mb-4"
              />

              {/* Output */}
              <div className="text-gray-300">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-400">Estimated daily reward</div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <img src={TOKEN_ICON} alt="AfroX" className="h-4 w-4" />
                    <span>{Number(calcResult.daily).toLocaleString(undefined, { maximumFractionDigits: Math.max(0, decimals) })} {TOKEN_LABEL}</span>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="text-xs text-gray-400">Estimated total for {calcDays} days</div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <img src={TOKEN_ICON} alt="AfroX" className="h-4 w-4" />
                    <span>{Number(calcResult.monthly).toLocaleString(undefined, { maximumFractionDigits: Math.max(0, decimals) })} {TOKEN_LABEL}</span>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="text-xs text-gray-400">Estimated yearly projection (365 days)</div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <img src={TOKEN_ICON} alt="AfroX" className="h-4 w-4" />
                    <span>{Number(calcResult.yearly).toLocaleString(undefined, { maximumFractionDigits: Math.max(0, decimals) })} {TOKEN_LABEL}</span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  <strong>Note:</strong> Actual rewards are computed by the blockchain contract and may slightly differ.
                </div>
              </div>
            </div>

            {/* Mini APR / bonus info card */}
            <div className="bg-gray-800 p-4 rounded-xl border border-orange-600/20">
              <div className="text-xs text-gray-400">Reward rules (on-chain)</div>
              <div className="text-2xl font-bold text-orange-300 mt-2">Estimates Only</div>

              <div className="mt-3 text-xs text-gray-400 leading-relaxed">
                Daily base rate: <span className="text-white font-medium">0.60%</span><br />
                Bonus (after 30 days): <span className="text-white font-medium">+0.06%</span> (daily)<br />
                Effective daily after bonus: <span className="text-white font-medium">0.66%</span>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Staked days: <span className="font-semibold text-white">{stakedDays}</span> • Bonus active: <span className="font-semibold">{has30DayBonus ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* tx / debug panel */}
        <section className="mb-6">
          <div className="bg-gray-900 p-4 rounded-xl text-xs text-gray-400">
            <div>Connected: <span className="text-white font-medium">{isConnected ? 'Yes' : 'No'}</span></div>
            <div>Wallet: <span className="text-white font-mono">{address ? shortAddr(address) : '—'}</span></div>
            <div>Token decimals: <span className="text-orange-300">{decimals}</span></div>
            <div className="mt-2 text-xs">Tip: If approve/stake/unstake buttons fail with `writeContract is not a function`, upgrade your wagmi/rainbowkit to the latest version or use a wallet connector exposing `request`.</div>
          </div>
        </section>
      </main>

      {/* Important disclaimer area above footer */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-gray-900 p-4 rounded-lg text-xs text-gray-300 mb-4">
          <strong>Important Disclaimer:</strong> By using this platform you confirm you are of legal age and understand the risks associated with staking crypto tokens. Ensure you live in a jurisdiction where staking/crypto is legal. All liability is at the user's risk.
        </div>
      </div>

      <footer className="border-t border-gray-800 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-400">
          © 2025 AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
        </div>
      </footer>

      {/* small alert */}
      {alertMsg && (
        <div className="fixed right-4 bottom-4 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg">
          {alertMsg}
        </div>
      )}
    </div>
  );
}
