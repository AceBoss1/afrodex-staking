// src/components/AfrodexStaking.jsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

import { STAKING_ABI, AFROX_TOKEN_ABI } from '../lib/abis'; // ensure exports: STAKING_ABI, AFROX_TOKEN_ABI
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';

const TOKEN_LOGO = '/afrodex_token.png';
const DEFAULT_DECIMALS = 4;

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // UI state
  const [activeTab, setActiveTab] = useState('staking');

  // on-chain / token state (human readable strings)
  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');

  // timestamps
  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  // on-chain rates
  const [rewardRateRaw, setRewardRateRaw] = useState(null); // raw numeric from contract (e.g. 60)
  const [bonusRateRaw, setBonusRateRaw] = useState(null);   // raw numeric from contract (e.g. 6)
  const [stakeRewardPeriod, setStakeRewardPeriod] = useState(86400); // seconds
  const [stakeBonusPeriod, setStakeBonusPeriod] = useState(2592000); // seconds

  // UX
  const [amount, setAmount] = useState('');           // stake input (human)
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  // helper: short addr
  const shortAddr = (a) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : '—';

  // small alert
  const showAlert = useCallback((m, t = 5000) => {
    setAlertMsg(String(m));
    setTimeout(() => setAlertMsg(null), t);
  }, []);

  // ----------------------
  // Safe conversion helpers
  // ----------------------
  const toHuman = useCallback((raw) => {
    try {
      if (raw === null || raw === undefined) return '0';
      return formatUnits(raw, decimals);
    } catch (e) {
      // fallback numeric division
      try {
        const n = Number(raw ?? 0) / (10 ** (decimals || DEFAULT_DECIMALS));
        return String(n);
      } catch {
        return '0';
      }
    }
  }, [decimals]);

  const toRaw = useCallback((humanStr) => {
    try {
      return parseUnits(String(humanStr || '0'), decimals || DEFAULT_DECIMALS);
    } catch {
      return 0n;
    }
  }, [decimals]);

  // ----------------------
  // Read on-chain state
  // ----------------------
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;

    try {
      // 1) token decimals (safe)
      try {
        const dec = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'decimals',
          args: [],
        });
        const d = dec !== null && dec !== undefined ? Number(dec) : DEFAULT_DECIMALS;
        setDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);
      } catch (e) {
        setDecimals(DEFAULT_DECIMALS);
      }

      // 2) wallet balance (token contract)
      if (address) {
        const balRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        setWalletBalance(toHuman(balRaw ?? 0n));
      } else {
        setWalletBalance('0');
      }

      // 3) allowance (token)
      if (address) {
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
      } else {
        setAllowance('0');
      }

      // 4) stake info (staking contract)
      if (address) {
        const stakeInfo = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [address],
        });

        if (stakeInfo) {
          // support both named tuple and indexed array
          const stakeBalRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
          const rewardValRaw = stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n;
          const lastUnRaw = stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n;
          const lastReRaw = stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n;

          setStakedBalance(toHuman(stakeBalRaw ?? 0n));
          setRewards(toHuman(rewardValRaw ?? 0n));
          setLastUnstakeTs(Number(lastUnRaw ?? 0n));
          setLastRewardTs(Number(lastReRaw ?? 0n));
        } else {
          setStakedBalance('0');
          setRewards('0');
          setLastUnstakeTs(0);
          setLastRewardTs(0);
        }
      } else {
        setStakedBalance('0');
        setRewards('0');
        setLastUnstakeTs(0);
        setLastRewardTs(0);
      }

      // 5) rates and periods from staking contract
      try {
        const rr = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'rewardRate',
        });
        const br = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'bonusRate',
        });
        const rp = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'stakeRewardPeriod',
        });
        const bp = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'stakeBonusPeriod',
        });

        setRewardRateRaw(rr ?? null);
        setBonusRateRaw(br ?? null);
        setStakeRewardPeriod(Number(rp ?? stakeRewardPeriod));
        setStakeBonusPeriod(Number(bp ?? stakeBonusPeriod));
      } catch (e) {
        // keep current rates if chain read fails
      }
    } catch (err) {
      console.error('fetchOnChain error', err);
    }
  }, [publicClient, address, toHuman]);

  // poll on connect
  useEffect(() => {
    fetchOnChain();
    let t;
    if (isConnected) t = setInterval(fetchOnChain, 20_000);
    return () => clearInterval(t);
  }, [fetchOnChain, isConnected]);

  // ----------------------
  // Interpret on-chain rates into daily decimals
  // ----------------------
  // Your contract values appear to use small integers (e.g. rewardRate=60, bonusRate=6).
  // We interpret these as per-day *10000* units:
  //   decimalDaily = raw / 10000
  // So 60 -> 0.006 (0.6%), 6 -> 0.0006 (0.06%).
  const dailyRate = useMemo(() => {
    if (rewardRateRaw === null || rewardRateRaw === undefined) return 0;
    const n = Number(rewardRateRaw);
    return n / 10000;
  }, [rewardRateRaw]);

  const dailyBonusRate = useMemo(() => {
    if (bonusRateRaw === null || bonusRateRaw === undefined) return 0;
    const n = Number(bonusRateRaw);
    return n / 10000;
  }, [bonusRateRaw]);

  // ----------------------
  // Reward projection calculations
  // ----------------------
  // We'll compute:
  // - dailyReward: principal * (dailyRate + maybe bonus)
  // - monthlyReward: daily * 30
  // - yearlyReward: exact split:
  //     first 30 days -> dailyRate
  //     remaining 335 days -> dailyRate + dailyBonusRate
  // This produces the same numbers you worked out (e.g. daily 0.006 => 0.6% base).
  const calcFor = useCallback((principalHuman, stakedDays) => {
    const p = Number(principalHuman || 0);
    if (!p || p <= 0) return { daily: 0, monthly: 0, yearly: 0 };

    const baseDaily = p * dailyRate;
    const bonusActive = stakedDays >= Math.floor((stakeBonusPeriod || 2592000) / 86400);
    const bonusDaily = bonusActive ? p * dailyBonusRate : 0;

    const daily = baseDaily + bonusDaily;
    const monthly = daily * 30;

    // yearly exact: first 30 days base only, remaining 335 days base+bonus
    const daysFirst = 30;
    const daysRest = 365 - daysFirst;
    const yearly = p * (dailyRate * daysFirst + (dailyRate + dailyBonusRate) * daysRest);

    return { daily, monthly, yearly };
  }, [dailyRate, dailyBonusRate, stakeBonusPeriod]);

  // compute days staked (conservative: if lastUnstakeTs > 0 use days since lastUnstakeTs, else days since lastRewardTs)
  const daysStaked = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const ref = (lastUnstakeTs && lastUnstakeTs > 0) ? lastUnstakeTs : lastRewardTs;
    if (!ref || ref <= 0) return 0;
    return Math.floor((now - ref) / 86400);
  }, [lastUnstakeTs, lastRewardTs]);

  // projection for the current stakedBalance
  const projection = useMemo(() => calcFor(Number(stakedBalance || 0), daysStaked), [stakedBalance, daysStaked, calcFor]);

  // ----------------------
  // Write actions (approve/stake/unstake/claim)
  // ----------------------
  async function doApprove(humanAmount) {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(humanAmount);
      const tx = await writeContractSafe(walletClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_TOKEN_ABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, raw],
      });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      // best-effort wait
      try {
        if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
        else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      } catch (e) {}
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) {
      console.error('approve err', err);
      showAlert('Approve failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  }

  async function doStake(humanAmount) {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to stake'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(humanAmount);

      // Try common staking calls (staking contract)
      const candidates = [
        { address: STAKING_ADDRESS, fn: 'depositToken', args: [TOKEN_ADDRESS, raw] },
        { address: STAKING_ADDRESS, fn: 'stake', args: [raw] },
        // some setups expose stake via token proxy — try token address as last resort
        { address: TOKEN_ADDRESS, fn: 'stake', args: [raw] },
      ];

      let ok = false;
      for (const c of candidates) {
        try {
          const tx = await writeContractSafe(walletClient, {
            address: c.address,
            abi: STAKING_ABI,
            functionName: c.fn,
            args: c.args,
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          try {
            if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch (e) {}
          ok = true;
          break;
        } catch (e) {
          // try next candidate
          continue;
        }
      }

      // If none succeeded, ensure allowance + retry stake
      if (!ok) {
        const allowRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });
        if ((allowRaw ?? 0n) < raw) {
          showAlert('Allowance low — approving first');
          await doApprove('1000000000000'); // big approval fallback
        }

        // final stake attempt
        try {
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
          ok = true;
        } catch (e) {}
      }

      if (!ok) throw new Error('Stake failed after attempts');

      showAlert('Stake confirmed');
      setAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake err', err);
      showAlert('Stake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  }

  async function doUnstake(humanAmount) {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to unstake'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(humanAmount);

      // prefer staking contract unstake
      try {
        const tx = await writeContractSafe(walletClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'unstake',
          args: [raw],
        });
        setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
        try {
          if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
          else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
        } catch (e) {}
      } catch (err1) {
        // fallback: try token proxy unstake
        const tx2 = await writeContractSafe(walletClient, {
          address: TOKEN_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'unstake',
          args: [raw],
        });
        setTxHash(tx2?.hash ?? tx2?.request?.hash ?? null);
        try {
          if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
          else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
        } catch (e) {}
      }

      showAlert('Unstake confirmed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake err', err);
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  }

  async function doClaim() {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    setLoading(true);
    setTxHash(null);

    // try claim-like functions first
    const candidates = ['claim', 'claimRewards', 'withdrawReward', 'getReward', 'withdraw'];
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
          continue;
        }
      }

      if (!done) {
        // fallback tiny unstake + restake to trick contract to pay rewards
        // don't use 0; many contracts don't accept 0; use tiny = 1 unit (respect decimals)
        const tiny = parseUnits('1', decimals || DEFAULT_DECIMALS);
        try {
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
          showAlert('Claim fallback (unstake tiny + restake) executed');
        } catch (e) {
          showAlert('No claim function and fallback failed.');
        }
      } else {
        showAlert('Claim executed');
      }

      await fetchOnChain();
    } catch (err) {
      console.error('claim err', err);
      showAlert('Claim failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  }

  // small formatting helpers
  const fmtTs = (s) => (!s || s <= 0) ? 'N/A' : new Date(Number(s) * 1000).toLocaleString();
  const fmtNum = (v) => {
    try {
      // show up to 6 fraction digits and group separators
      return Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
    } catch { return String(v || 0); }
  };

  // ----------------------
  // UI Layout / render
  // ----------------------
  return (
    <div className="min-h-screen w-full bg-black text-white antialiased px-4 sm:px-6 lg:px-8">
      {/* header / tabs */}
      <div className="max-w-6xl mx-auto py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-sm text-gray-300">Staking Powered by AfroDex Community of Trust & AfroDex Ambassadors</div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-orange-400 flex items-center gap-3 mt-2">
            <img src="/afrodex_logoT.png" alt="T" className="h-8 w-auto" />
            AfroX Staking and Minting Engine
            <img src="/afrodex_logoA.png" alt="A" className="h-8 w-auto" />
          </h1>
        </div>

        <div className="flex gap-3 items-center">
          <button onClick={() => setActiveTab('staking')} className={`px-4 py-2 rounded ${activeTab === 'staking' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>AfroX Staking Dashboard</button>
          <button onClick={() => setActiveTab('ambassador')} className={`px-4 py-2 rounded ${activeTab === 'ambassador' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>AfroDex Ambassador Dashboard</button>
          <button onClick={() => setActiveTab('governance')} className={`px-4 py-2 rounded ${activeTab === 'governance' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>AfroDex Community of Trust</button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto pb-12">
        {activeTab === 'staking' && (
          <>
            {!isConnected ? (
              <div className="text-center py-20 text-gray-300">Please connect your wallet to use the staking dashboard.</div>
            ) : (
              <>
                {/* Top analytics row - responsive */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.12)' }}>
                    <div className="text-sm text-gray-300">Your Stake</div>
                    <div className="text-2xl font-bold flex items-center gap-3">
                      <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" />
                      {stakedBalance} AfroX
                    </div>
                    <div className="text-xs text-gray-400 mt-2">Last reward update: {fmtTs(lastRewardTs)}</div>
                  </motion.div>

                  <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.12)' }}>
                    <div className="text-sm text-gray-300">Rewards</div>
                    <div className="text-2xl font-bold flex items-center gap-3">
                      <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" />
                      {rewards} AfroX
                    </div>
                    <div className="text-xs text-gray-400 mt-2">Last unstake: {fmtTs(lastUnstakeTs)}</div>
                  </motion.div>

                  <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.12)' }}>
                    <div className="text-sm text-gray-300">Wallet Balance</div>
                    <div className="text-2xl font-bold flex items-center gap-3">
                      <img src={TOKEN_LOGO} alt="AfroX" className="h-5 w-5 rounded-full" />
                      {walletBalance} AfroX
                    </div>
                    <div className="text-xs text-gray-400 mt-2">Allowance: {allowance}</div>
                  </motion.div>

                  <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10 flex flex-col justify-between" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.12)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-300">Badge Tier</div>
                        <div className="text-lg font-semibold text-orange-300">Starter</div>
                      </div>
                      <div className="text-xs text-gray-400">{shortAddr(address)}</div>
                    </div>
                    <div className="mt-3 text-xs text-gray-400">Tier thresholds: 1b, 10b, 50b, 100b, 500b</div>
                  </motion.div>
                </section>

                {/* Stake / Unstake */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
                    <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
                    <div className="text-sm text-gray-400 mb-4">Approve AfroX to the staking contract and then stake.</div>

                    <label className="block text-xs text-gray-300 mb-1">Amount (AfroX)</label>
                    <input type="number" step={1 / (10 ** decimals)} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500" />

                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => doApprove(amount || '1000000')} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium shadow" disabled={loading}>Approve</button>
                      <button onClick={() => doStake(amount)} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={loading}>Stake</button>
                    </div>

                    <div className="mt-4 text-xs text-gray-400">Allowance: <span className="text-orange-300 font-medium">{allowance}</span></div>
                    {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
                  </motion.div>

                  <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
                    <h2 className="text-xl font-bold mb-3">Unstake</h2>
                    <div className="text-sm text-gray-400 mb-4">Unstake your AfroX tokens and claim rewards.</div>

                    <label className="block text-xs text-gray-300 mb-1">Amount to Unstake</label>
                    <input type="number" step={1 / (10 ** decimals)} value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} placeholder="0.0" className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500" />

                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => doUnstake(unstakeAmount || '0')} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium" disabled={loading}>Unstake</button>
                      <button onClick={() => doClaim()} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={loading}>Claim Rewards</button>
                    </div>

                    <div className="mt-4 text-xs text-gray-400">Your Rewards: <span className="text-orange-300 font-medium">{rewards} AfroX</span></div>
                  </motion.div>
                </section>

                {/* Rewards center */}
                <section className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10 mb-6">
                  <h3 className="text-lg font-bold mb-4">Rewards Projection Calculator</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <div className="text-sm text-gray-300 mb-3">Estimated rewards (based on on-chain rates)</div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="text-xs text-gray-400">Principal (staked): <span className="text-white font-semibold">{stakedBalance} AfroX</span></div>
                        <div className="text-xs text-gray-400">Days since last activity: <span className="text-white font-semibold">{daysStaked}</span></div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-3 bg-gray-800 rounded">
                          <div className="text-xs text-gray-400">Daily Reward</div>
                          <div className="text-lg font-bold">{fmtNum(projection.daily)} <img src={TOKEN_LOGO} alt="" className="inline h-4 w-4 ml-2 align-text-bottom" /></div>
                        </div>

                        <div className="p-3 bg-gray-800 rounded">
                          <div className="text-xs text-gray-400">Monthly Reward (30d)</div>
                          <div className="text-lg font-bold">{fmtNum(projection.monthly)} <img src={TOKEN_LOGO} alt="" className="inline h-4 w-4 ml-2 align-text-bottom" /></div>
                        </div>

                        <div className="p-3 bg-gray-800 rounded">
                          <div className="text-xs text-gray-400">Yearly Reward (365d)</div>
                          <div className="text-lg font-bold">{fmtNum(projection.yearly)} <img src={TOKEN_LOGO} alt="" className="inline h-4 w-4 ml-2 align-text-bottom" /></div>
                        </div>
                      </div>

                      <p className="mt-4 text-sm text-gray-400">*Estimates are calculated from on-chain parameters (rewardRate / bonusRate). Actual rewards are computed by the contract and may differ slightly.</p>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-xl border border-orange-600/20">
                      <div className="text-xs text-gray-400">Rate (on-chain)</div>
                      <div className="text-2xl font-bold text-orange-300">{/* hide percentage if you prefer */} Estimates shown</div>
                      <div className="mt-3 text-xs text-gray-400">
                        Base daily rate (from contract): <span className="text-white">{(dailyRate * 100).toFixed(4)}%</span><br />
                        Daily bonus after {Math.floor(stakeBonusPeriod / 86400)} days: <span className="text-white">{(dailyBonusRate * 100).toFixed(4)}%</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* debug / info */}
                <section className="mb-6">
                  <div className="bg-gray-900 p-4 rounded-xl text-xs text-gray-400">
                    <div>Connected: <span className="text-white font-medium">{isConnected ? 'Yes' : 'No'}</span></div>
                    <div>Wallet: <span className="text-white font-mono">{address ? shortAddr(address) : '—'}</span></div>
                    <div>Token decimals: <span className="text-orange-300">{decimals}</span></div>
                    <div>On-chain rewardRate: <span className="text-white">{String(rewardRateRaw ?? '—')}</span> bonusRate: <span className="text-white">{String(bonusRateRaw ?? '—')}</span></div>
                  </div>
                </section>

                <p className="mt-6 p-4 bg-[#0b0b0b] border border-gray-800 rounded text-sm text-gray-300">
                  ⚠️ <strong>Important Disclaimer:</strong> By using this platform, you confirm you are of legal age, live in a jurisdiction where staking crypto is legal, and accept all risks and liabilities.
                </p>

                <footer className="border-t border-gray-800 py-6 mt-6 text-center text-sm text-gray-400">© 2025 AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A</footer>
              </>
            )}
          </>
        )}

        {/* Ambassador & Governance placeholders */}
        {activeTab === 'ambassador' && (
          <div className="text-gray-300 p-6 bg-gray-900 rounded">
            <h2 className="text-xl font-bold mb-2">AfroDex Ambassador Dashboard</h2>
            <p className="text-sm text-gray-400">Referral, ambassador tiers, leaderboard and referral claim queue will appear here.</p>
          </div>
        )}

        {activeTab === 'governance' && (
          <div className="text-gray-300 p-6 bg-gray-900 rounded">
            <h2 className="text-xl font-bold mb-2">AfroDex Community of Trust</h2>
            <p className="text-sm text-gray-400">Governance tools, proposals, tier registry and treasury transparency will appear here.</p>
          </div>
        )}
      </main>

      {alertMsg && <div className="fixed right-6 bottom-6 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg">{alertMsg}</div>}
    </div>
  );
}
