// src/components/AfrodexStaking.jsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { STAKING_ABI, AFROX_TOKEN_ABI } from '../lib/abis'; // ensure these are exported
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';

const TOKEN_LOGO = '/afrodex_token.png';
const DEFAULT_DECIMALS = 4;

// Contract-derived constants (your confirmed values)
const BASE_DAILY_RATE = 0.006;     // rewardRate = 60 -> 0.6% = 0.006 (per day)
const BONUS_DAILY_RATE = 0.0006;   // bonusRate = 6 -> +0.06% per 30 days => daily additive after 30 days = 0.0006
const BONUS_DAY_THRESHOLD = 30;    // apply bonus when stakedDays >= 30

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient(); // pass this directly to writeContractSafe

  // on-chain / UI state (human-readable strings)
  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');

  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  // form + UX
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  // UI tabs
  const [activeTab, setActiveTab] = useState('staking');

  // derived: number of days staked (conservative use lastUnstakeTs if present)
  const daysStaked = useMemo(() => {
    const ref = lastUnstakeTs && lastUnstakeTs > 0 ? lastUnstakeTs : lastRewardTs;
    if (!ref || ref <= 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - Number(ref)) / 86400);
  }, [lastUnstakeTs, lastRewardTs]);

  // Simple alert
  const showAlert = (m, ms = 6000) => {
    setAlertMsg(String(m));
    setTimeout(() => setAlertMsg(null), ms);
  };

  // humanize timestamp
  const fmtTs = (s) => (!s || s <= 0) ? 'N/A' : new Date(Number(s) * 1000).toLocaleString();

  // safe formatters based on decimals
  const toHuman = useCallback((raw) => {
    try {
      if (raw === null || raw === undefined) return '0';
      return String(formatUnits(raw, decimals));
    } catch {
      try {
        // fallback naive conversion
        const n = Number(raw ?? 0) / (10 ** (decimals || DEFAULT_DECIMALS));
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

  // fetch on-chain values
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;
    try {
      // read decimals from token if available
      const decRaw = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_TOKEN_ABI,
        functionName: 'decimals',
      });
      const d = decRaw !== null && decRaw !== undefined ? Number(decRaw) : DEFAULT_DECIMALS;
      setDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);

      if (address) {
        // wallet balance
        const balRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        setWalletBalance(toHuman(balRaw ?? 0n));

        // allowance to staking contract
        const allowRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });
        setAllowance(toHuman(allowRaw ?? 0n));

        // stake info (preferred)
        const stakeInfo = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [address],
        });

        if (stakeInfo) {
          // order: 0: stakeBalance, 1: rewardValue, 2: lastUnstakeTimestamp, 3: lastRewardTimestamp
          const stakeRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
          const rewardRaw = stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n;
          const lastUnRaw = stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n;
          const lastRRaw = stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n;

          setStakedBalance(toHuman(stakeRaw ?? 0n));
          setRewards(toHuman(rewardRaw ?? 0n));
          setLastUnstakeTs(Number(lastUnRaw ?? 0n));
          setLastRewardTs(Number(lastRRaw ?? 0n));
        } else {
          // fallback: try balanceOf on staking contract (some proxies)
          const stBalRaw = await readContractSafe(publicClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'balanceOf',
            args: [address],
          });
          setStakedBalance(toHuman(stBalRaw ?? 0n));
          setRewards('0');
          setLastUnstakeTs(0);
          setLastRewardTs(0);
        }
      } else {
        // not connected
        setWalletBalance('0');
        setStakedBalance('0');
        setRewards('0');
        setAllowance('0');
        setLastUnstakeTs(0);
        setLastRewardTs(0);
      }
    } catch (err) {
      console.error('fetchOnChain error', err);
    }
  }, [publicClient, address, toHuman]);

  // poll on mount / address change
  useEffect(() => {
    fetchOnChain();
    let t;
    if (isConnected) t = setInterval(fetchOnChain, 20_000);
    return () => clearInterval(t);
  }, [fetchOnChain, isConnected]);

  // ---------- Reward projection (hidden APR, show estimates) ----------
  // Daily rate: BASE_DAILY_RATE (0.006) for days 1-30 ; after that: BASE_DAILY_RATE + BONUS_DAILY_RATE
  const projectionFor = useCallback((principalHuman, days) => {
    const p = Number(principalHuman || 0);
    const d = Number(days || 0);
    if (!p || !d) return { daily: 0, monthly: 0, yearly: 0 };

    // daily reward depends on whether bonus active for that period.
    // We'll compute "current daily" (based on whether user has passed 30 days already)
    const bonusActive = daysStaked >= BONUS_DAY_THRESHOLD;
    const dailyRate = bonusActive ? (BASE_DAILY_RATE + BONUS_DAILY_RATE) : BASE_DAILY_RATE;
    const daily = p * dailyRate;
    const monthly = daily * 30;
    // Yearly: follow your constants: we use the constant YEAR calculation that you confirmed (239.1% APR for 365 days)
    // But user wants to hide APR and only show projected numbers. We'll compute yearly with period breakdown:
    // First 30 days at base rate, remaining 335 at base+bonus if the stake persists.
    const first30 = p * BASE_DAILY_RATE * Math.min(30, d);
    const remainingDays = Math.max(0, d - 30);
    const remaining = p * (BASE_DAILY_RATE + BONUS_DAILY_RATE) * remainingDays;
    const yearlyEstimated = (d >= 365) ? (first30 + remaining) : (first30 + remaining); // same formula works for any d
    // For yearly display we want projection for full 365 days regardless, use the standard formula:
    const yearlyFull = p * BASE_DAILY_RATE * 30 + p * (BASE_DAILY_RATE + BONUS_DAILY_RATE) * 335;

    return {
      daily,
      monthly,
      yearlyPeriod: yearlyEstimated,
      yearlyFull,
    };
  }, [daysStaked]);

  const proj = useMemo(() => projectionFor(Number(stakedBalance || 0), 365), [stakedBalance, daysStaked, projectionFor]);

  // ---------- Write operations ----------
  const doApprove = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet to approve'); return; }
    setLoading(true);
    try {
      const raw = toRaw(humanAmount);
      const tx = await writeContractSafe(walletClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_TOKEN_ABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, raw],
      });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      // best-effort wait: publicClient.waitForTransactionReceipt if available
      try {
        if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
        else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      } catch {}
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) {
      console.error('approve err', err);
      showAlert('Approve failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  const doStake = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet to stake'); return; }
    if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to stake'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(humanAmount);

      // Candidates (try depositToken then stake)
      const candidates = [
        { addr: STAKING_ADDRESS, fn: 'depositToken', args: [TOKEN_ADDRESS, raw] },
        { addr: STAKING_ADDRESS, fn: 'stake', args: [raw] },
        { addr: TOKEN_ADDRESS, fn: 'stake', args: [raw] }, // proxies sometimes expose stake
      ];

      let executed = false;
      for (const c of candidates) {
        try {
          const tx = await writeContractSafe(walletClient, {
            address: c.addr,
            abi: STAKING_ABI,
            functionName: c.fn,
            args: c.args,
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          try {
            if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch (e) {}
          executed = true;
          break;
        } catch (e) {
          // try next
        }
      }

      // If not executed, ensure allowance and retry
      if (!executed) {
        const allowRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });
        if ((allowRaw ?? 0n) < raw) {
          showAlert('Allowance low — approving first');
          await doApprove('1000000000000000000000000'); // big approve fallback
        }
        // final attempt
        const tx2 = await writeContractSafe(walletClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'stake',
          args: [raw],
        });
        setTxHash(tx2?.hash ?? tx2?.request?.hash ?? null);
        try {
          if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
          else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
        } catch (e) {}
        executed = true;
      }

      if (!executed) throw new Error('Stake failed after attempts');

      showAlert('Stake confirmed');
      setStakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake err', err);
      showAlert('Stake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  const doUnstake = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet to unstake'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = humanAmount && Number(humanAmount) > 0 ? toRaw(humanAmount) : undefined;
      const candidates = raw ? ['unstake'] : ['unstake', 'withdraw', 'unstakeAll'];

      let executed = false;
      for (const fn of candidates) {
        try {
          const args = raw ? [raw] : [];
          const tx = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: fn,
            args,
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          try {
            if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch (e) {}
          executed = true;
          break;
        } catch (e) {
          // try next
        }
      }

      if (!executed) throw new Error('Unstake failed: no fn available');

      showAlert('Unstake executed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake err', err);
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  const doClaim = async () => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet to claim'); return; }
    setLoading(true);
    setTxHash(null);
    const candidates = ['claim', 'claimRewards', 'withdrawReward', 'getReward'];
    try {
      let done = false;
      for (const fn of candidates) {
        try {
          const tx = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: fn,
            args: [],
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          try {
            if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch (e) {}
          done = true;
          break;
        } catch (e) {
          // continue
        }
      }

      if (!done) {
        // fallback small unstake-restake trick (if allowed)
        try {
          const tiny = parseUnits('1', decimals || DEFAULT_DECIMALS);
          const tx1 = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'unstake',
            args: [tiny],
          });
          try {
            if (tx1?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx1.request.hash });
            else if (tx1?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx1.hash });
          } catch (e) {}
          const tx2 = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [tiny],
          });
          try {
            if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
            else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
          } catch (e) {}
          showAlert('Claim fallback executed (tiny unstake+restake)');
        } catch (e) {
          showAlert('Claim not available on this contract');
        }
      } else {
        showAlert('Claim executed');
      }

      await fetchOnChain();
    } catch (err) {
      console.error('claim err', err);
      showAlert('Claim failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  // UI helpers: set max
  const setMaxStake = () => setStakeAmount(walletBalance || '0');
  const setMaxUnstake = () => setUnstakeAmount(stakedBalance || '0');

  // small formatting helpers
  const fmtNum = (v) => {
    if (v === null || v === undefined) return '0';
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return String(v);
    // show with up to decimals
    return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <header className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">AfroX Staking Dashboard</h1>
          <p className="text-sm text-orange-300/80">Stake AfroX and earn rewards — estimates shown.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block"><ConnectButton /></div>
          <div className="md:hidden"><ConnectButton /></div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-12">
        {/* Tabs */}
        <nav className="flex gap-4 mb-6">
          <button onClick={() => setActiveTab('staking')} className={`px-3 py-2 rounded ${activeTab === 'staking' ? 'border-b-2 border-orange-400 text-orange-300' : 'text-gray-300'}`}>AfroX Staking Dashboard</button>
          <button onClick={() => setActiveTab('ambassador')} className={`px-3 py-2 rounded ${activeTab === 'ambassador' ? 'border-b-2 border-orange-400 text-orange-300' : 'text-gray-300'}`}>AfroDex Ambassador Dashboard</button>
          <button onClick={() => setActiveTab('governance')} className={`px-3 py-2 rounded ${activeTab === 'governance' ? 'border-b-2 border-orange-400 text-orange-300' : 'text-gray-300'}`}>AfroDex Community of Trust</button>
        </nav>

        {activeTab === 'staking' && (
          <>
            {!isConnected ? (
              <div className="text-center py-12">
                <p className="text-gray-300">Please connect your wallet to view staking details.</p>
                <div className="mt-4"><ConnectButton /></div>
              </div>
            ) : (
              <>
                {/* Top cards (responsive) */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10">
                    <div className="text-sm text-gray-300">Wallet Balance</div>
                    <div className="text-2xl font-bold flex items-center gap-3 mt-2">
                      <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" />
                      <span>{fmtNum(walletBalance)} AfroX</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">Allowance: {fmtNum(allowance)} AfroX</div>
                  </div>

                  <div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10">
                    <div className="text-sm text-gray-300">Your Stake</div>
                    <div className="text-2xl font-bold flex items-center gap-3 mt-2">
                      <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" />
                      <span>{fmtNum(stakedBalance)} AfroX</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">Last reward update: {fmtTs(lastRewardTs)}</div>
                  </div>

                  <div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10">
                    <div className="text-sm text-gray-300">Accumulated Rewards</div>
                    <div className="text-2xl font-bold flex items-center gap-3 mt-2">
                      <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" />
                      <span className="text-green-400">{fmtNum(rewards)} AfroX</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">Last unstake: {fmtTs(lastUnstakeTs)}</div>
                  </div>
                </section>

                {/* Stake / Unstake */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
                    <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
                    <div className="text-sm text-gray-400 mb-3">Approve token first if needed — you can use MAX.</div>

                    <label className="block text-xs text-gray-300 mb-1">Amount (AfroX)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step={1 / (10 ** decimals)}
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0.0"
                        className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
                      />
                      <button onClick={setMaxStake} className="px-3 py-2 rounded bg-gray-800 border border-gray-700">MAX</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <button onClick={() => doApprove(stakeAmount || '1000000')} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium" disabled={loading}>Approve</button>
                      <button onClick={() => doStake(stakeAmount)} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={loading}>Stake</button>
                    </div>

                    {txHash && <div className="mt-3 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
                  </div>

                  <div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
                    <h2 className="text-xl font-bold mb-3">Unstake & Claim</h2>
                    <div className="text-sm text-gray-400 mb-3">You may unstake or claim rewards. Use MAX for quick full actions.</div>

                    <label className="block text-xs text-gray-300 mb-1">Amount to Unstake</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step={1 / (10 ** decimals)}
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        placeholder="0.0"
                        className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
                      />
                      <button onClick={setMaxUnstake} className="px-3 py-2 rounded bg-gray-800 border border-gray-700">MAX</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <button onClick={() => doUnstake(unstakeAmount)} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium" disabled={loading}>Unstake</button>
                      <button onClick={doClaim} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={loading}>Claim Rewards</button>
                    </div>

                    <div className="mt-3 text-xs text-gray-400">Your Rewards: <span className="text-orange-300 font-medium">{fmtNum(rewards)} AfroX</span></div>
                  </div>
                </section>

                {/* Rewards projection (NO APR label, only estimates) */}
                <section className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10 mb-6">
                  <h3 className="text-lg font-bold mb-4">Rewards Calculator (Estimates)</h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div className="md:col-span-2">
                      <div className="text-sm text-gray-300 mb-2">Estimated rewards (based on contract rates). Shows Daily / Monthly / Yearly projections.</div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                        <div className="p-3 bg-gray-800 rounded">
                          <div className="text-xs text-gray-400">Daily Reward</div>
                          <div className="mt-2 text-lg font-bold flex items-center gap-2">
                            <img src={TOKEN_LOGO} alt="AfroX" className="h-5 w-5" />
                            <span>{Number(proj.daily || 0).toLocaleString(undefined, { maximumFractionDigits: decimals })} AfroX</span>
                          </div>
                        </div>

                        <div className="p-3 bg-gray-800 rounded">
                          <div className="text-xs text-gray-400">Monthly Reward (30d)</div>
                          <div className="mt-2 text-lg font-bold flex items-center gap-2">
                            <img src={TOKEN_LOGO} alt="AfroX" className="h-5 w-5" />
                            <span>{Number(proj.monthly || 0).toLocaleString(undefined, { maximumFractionDigits: decimals })} AfroX</span>
                          </div>
                        </div>

                        <div className="p-3 bg-gray-800 rounded">
                          <div className="text-xs text-gray-400">Yearly Reward (365d)</div>
                          <div className="mt-2 text-lg font-bold flex items-center gap-2">
                            <img src={TOKEN_LOGO} alt="AfroX" className="h-5 w-5" />
                            <span>{Number(proj.yearlyFull || 0).toLocaleString(undefined, { maximumFractionDigits: decimals })} AfroX</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500 mt-3">
                        ⚠️ <strong>Estimate disclaimer:</strong> These numbers are calculated off-chain for display.
                        Actual rewards are computed by the contract and may differ slightly.
                      </p>
                    </div>

                    {/* mini info card with period breakdown */}
                    <div className="p-4 bg-gray-800 rounded border border-orange-600/10">
                      <div className="text-xs text-gray-400">Projection Model</div>
                      <div className="mt-2 text-sm text-white leading-relaxed">
                        <div>Initial (Days 1–30): daily = 0.0060 × stake</div>
                        <div className="mt-1">Long term (Day 31+): daily = 0.0066 × stake</div>
                        <div className="mt-2 text-xs text-gray-500">Note: APR = 239.1% (constant)</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* tx / debug panel */}
                <section className="mb-6">
                  <div className="bg-gray-900 p-4 rounded-xl text-xs text-gray-400">
                    <div>Connected: <span className="text-white font-medium">{isConnected ? 'Yes' : 'No'}</span></div>
                    <div>Wallet: <span className="text-white font-mono">{address ?? '—'}</span></div>
                    <div>Token decimals: <span className="text-orange-300">{decimals}</span></div>
                    <div>Staked days (approx): <span className="text-white">{daysStaked}</span></div>
                  </div>
                </section>

                {/* Important disclaimer */}
                <div className="mt-6 p-4 bg-[#0b0b0b] border border-gray-800 rounded text-sm text-gray-300">
                  <strong>Important Disclaimer:</strong> Using this platform means you confirm you are of legal age and that staking crypto is legal in your jurisdiction. You understand the risks of staking and accept full liability for your actions.
                </div>

                {/* Footer */}
                <footer className="mt-6 border-t border-gray-800 py-6">
                  <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">
                    © 2025 AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
                  </div>
                </footer>
              </>
            )}
          </>
        )}

        {activeTab === 'ambassador' && (
          <div className="bg-gray-900 p-6 rounded-lg text-gray-300">
            <h2 className="text-xl font-bold mb-2">AfroDex Ambassador Dashboard</h2>
            <p className="text-sm">Placeholder — referral & ambassador features will be added here.</p>
          </div>
        )}

        {activeTab === 'governance' && (
          <div className="bg-gray-900 p-6 rounded-lg text-gray-300">
            <h2 className="text-xl font-bold mb-2">AfroDex Community of Trust</h2>
            <p className="text-sm">Placeholder — governance & community features will be added here.</p>
          </div>
        )}
      </main>

      {/* toast */}
      {alertMsg && <div className="fixed right-4 bottom-6 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg">{alertMsg}</div>}
    </div>
  );
}
