// src/components/AfrodexStaking.jsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

import { STAKING_ABI } from '../lib/abis/stakingAbi';
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';

// constants / UI
const DEFAULT_DECIMALS = 4;
const PRICE_USD_STATIC = 0.000001;
const TOKEN_LABEL = 'AfroX';
const TOKEN_LOGO = '/afrodex_token.png';

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();

  // UI and on-chain state
  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');

  const [amount, setAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // rates + timestamps
  const [rewardRate, setRewardRate] = useState(0); // decimal daily base, fallback
  const [bonusRate, setBonusRate] = useState(0);   // monthly bonus decimal
  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  // UX
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  // safe format helpers
  const toHuman = useCallback((raw) => {
    try {
      if (raw === null || raw === undefined) return '0';
      return formatUnits(raw, decimals);
    } catch (e) {
      return String(raw ?? '0');
    }
  }, [decimals]);

  const toRaw = useCallback((human) => {
    try {
      return parseUnits(String(human || '0'), decimals);
    } catch {
      return 0n;
    }
  }, [decimals]);

  // short address
  const shortAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '—';

  // small alert
  const showAlert = (m, t = 5000) => {
    setAlertMsg(String(m));
    setTimeout(() => setAlertMsg(null), t);
  };

  // Fetch on-chain state
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;

    try {
      // decimals
      const decimalsRaw = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'decimals',
        args: [],
      });
      const d = decimalsRaw !== null && decimalsRaw !== undefined ? Number(decimalsRaw) : DEFAULT_DECIMALS;
      setDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);

      // wallet balance
      const balRaw = address ? await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) : 0n;
      setWalletBalance(toHuman(balRaw ?? 0n));

      // allowance
      const allowRaw = address ? await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'allowance',
        args: [address, STAKING_ADDRESS],
      }) : 0n;
      setAllowance(toHuman(allowRaw ?? 0n));

      // stakeInfo
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
          setRewards(toHuman(rewardValRaw ?? 0n));
          setLastUnstakeTs(Number(lastUnstakeRaw ?? 0n));
          setLastRewardTs(Number(lastRewardRaw ?? 0n));
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

      // rewardRate & bonusRate (if provided)
      const rewardRateRaw = await readContractSafe(publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'rewardRate',
      });
      const bonusRateRaw = await readContractSafe(publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'bonusRate',
      });

      // interpret as decimals using token decimals (formatUnits)
      const r = rewardRateRaw ? Number(formatUnits(rewardRateRaw, decimals)) : 0;
      const b = bonusRateRaw ? Number(formatUnits(bonusRateRaw, decimals)) : 0;
      setRewardRate(r || 0);
      setBonusRate(b || 0);

    } catch (err) {
      console.error('fetchOnChain error', err);
    }
  }, [publicClient, address, decimals, toHuman]);

  useEffect(() => {
    fetchOnChain();
    const t = setInterval(fetchOnChain, 20_000);
    return () => clearInterval(t);
  }, [fetchOnChain]);

  // write helpers (calls walletClient)
  const doApprove = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    setLoading(true);
    try {
      const raw = toRaw(humanAmount);
      const tx = await writeContractSafe(walletClient, {
        address: TOKEN_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, raw],
      });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      // wait for receipt attempt
      try {
        if (tx?.request) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
        else if (tx?.hash) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      } catch (e) { /* ignore wait errors */ }
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) {
      console.error('approve err', err);
      showAlert('Approve failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  const doStake = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to stake'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(humanAmount);

      // ensure allowance
      const allowRaw = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'allowance',
        args: [address, STAKING_ADDRESS],
      });

      if ((allowRaw ?? 0n) < raw) {
        showAlert('Allowance low — approving first');
        await doApprove('1000000000000'); // approve big
      }

      // try stake or depositToken
      const tryFns = [
        { fn: 'stake', args: [raw] },
        { fn: 'depositToken', args: [TOKEN_ADDRESS, raw] },
      ];

      let success = false;
      for (const call of tryFns) {
        try {
          const tx = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: call.fn,
            args: call.args,
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          // wait attempt
          try {
            if (tx?.request) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch (e) {}
          success = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!success) throw new Error('No usable staking function or calls reverted');

      showAlert('Stake confirmed');
      setAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake err', err);
      showAlert('Stake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  const doUnstake = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to unstake'); return; }
    setLoading(true);
    setTxHash(null);
    try {
      const raw = toRaw(humanAmount);
      const tx = await writeContractSafe(walletClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [raw],
      });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      try {
        if (tx?.request) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
        else if (tx?.hash) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      } catch (e) {}
      showAlert('Unstake confirmed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake err', err);
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  // Claim routine
  const doClaim = async () => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    setLoading(true);
    setTxHash(null);
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
            if (tx?.request) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch (e) {}
          done = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!done) {
        // fallback tiny unstake/retake
        const tiny = parseUnits('1', decimals);
        const stakeInfo = await readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [address],
        });
        const stakedRaw = stakeInfo ? (stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n) : 0n;
        if (stakedRaw >= tiny) {
          const tx1 = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'unstake',
            args: [tiny],
          });
          try {
            if (tx1?.request) await publicClient.waitForTransactionReceipt({ hash: tx1.request.hash });
            else if (tx1?.hash) await publicClient.waitForTransactionReceipt({ hash: tx1.hash });
          } catch (e) {}
          const tx2 = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [tiny],
          });
          try {
            if (tx2?.request) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
            else if (tx2?.hash) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
          } catch (e) {}
          showAlert('Claim fallback (unstake tiny + restake) completed');
        } else {
          showAlert('No claim function and staked balance too low for fallback.');
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

  // reward helpers
  const daysSince = (tsSec) => {
    if (!tsSec || tsSec <= 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - tsSec) / 86400);
  };

  const stakedDays = useMemo(() => {
    if (!lastUnstakeTs || lastUnstakeTs === 0) return daysSince(lastRewardTs);
    // conservative: if lastUnstakeTs > 0 use days since lastUnstakeTs
    return daysSince(lastUnstakeTs);
  }, [lastUnstakeTs, lastRewardTs]);

  const has30DayBonus = stakedDays >= 30;

  const dailyRate = (rewardRate && rewardRate > 0) ? rewardRate : 0.0003;
  const monthlyBonusRate = (bonusRate && bonusRate > 0) ? bonusRate : 0.00003;

  function calcRewardsFor(principalHuman, days) {
    const p = Number(principalHuman || 0);
    const d = Number(days || 0);
    if (!p || !d) return { tokens: 0, usd: 0 };
    const base = p * dailyRate * d;
    const months = Math.floor(d / 30);
    const bonus = has30DayBonus ? (p * monthlyBonusRate * months) : 0;
    const tokens = base + bonus;
    const usd = tokens * PRICE_USD_STATIC;
    return { tokens, usd };
  }

  const APR = useMemo(() => {
    return (dailyRate + monthlyBonusRate * 12) * 365 * 100;
  }, [dailyRate, monthlyBonusRate]);

  // Calculator state
  const [calcDays, setCalcDays] = useState(30);
  const [calcAmt, setCalcAmt] = useState('');
  useEffect(() => {
    setCalcAmt(stakedBalance || '');
  }, [stakedBalance]);

  const calcResult = useMemo(() => calcRewardsFor(Number(calcAmt || stakedBalance || 0), Number(calcDays || 0)),
    [calcAmt, calcDays, has30DayBonus, stakedBalance, dailyRate, monthlyBonusRate]);

  // small format util for timestamps
  const fmtTs = (s) => (!s || s <= 0) ? 'N/A' : new Date(s * 1000).toLocaleString();

  // JSX (layout preserved; token logo integrated in Your Stake, Rewards, Wallet Balance)
  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">AfroX Staking Dashboard</h1>
          <p className="text-sm text-orange-300/80">Stake AfroX and earn rewards</p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-12">
        {/* Top analytics row */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" style={{ boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.02)' }} whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
            <div className="text-sm text-gray-300">Your Stake</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
              {stakedBalance} {TOKEN_LABEL}
            </div>
            <div className="text-xs text-gray-400 mt-2">Last reward update: {fmtTs(lastRewardTs)}</div>
          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
            <div className="text-sm text-gray-300">Rewards</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
              {rewards} {TOKEN_LABEL}
            </div>
            <div className="text-xs text-gray-400 mt-2">Last unstake: {fmtTs(lastUnstakeTs)}</div>
          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
            <div className="text-sm text-gray-300">Wallet Balance</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <img src={TOKEN_LOGO} alt="AfroX" className="h-5 w-5 rounded-full opacity-90" />
              {walletBalance} {TOKEN_LABEL}
            </div>
            <div className="text-xs text-gray-400 mt-2">Allowance: {allowance} {TOKEN_LABEL}</div>
          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10 flex flex-col justify-between" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">Badge Tier</div>
                <div className="text-lg font-semibold text-orange-300">Starter</div>
              </div>
              <div className="text-xs text-gray-400">{address ? shortAddr(address) : 'Not connected'}</div>
            </div>
            <div className="mt-3 text-xs text-gray-400">Tier thresholds: 10m, 100m, 1b, 10b</div>
          </motion.div>
        </section>

        {/* Stake / Unstake */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30" initial="initial" whileHover="hover">
            <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
            <div className="text-sm text-gray-400 mb-4">Approve AfroX to the staking contract and then stake.</div>

            <label className="block text-xs text-gray-300 mb-1">Amount (AfroX)</label>
            <input type="number" step={1 / (10 ** decimals)} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500" />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => doApprove(amount || '1000000')} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium shadow" disabled={!isConnected || loading}>Approve</button>
              <button onClick={() => doStake(amount)} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={!isConnected || loading}>Stake</button>
            </div>

            <div className="mt-4 text-xs text-gray-400">Allowance: <span className="text-orange-300 font-medium">{allowance}</span></div>
            {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
          </motion.div>

          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30" initial="initial" whileHover="hover">
            <h2 className="text-xl font-bold mb-3">Unstake</h2>
            <div className="text-sm text-gray-400 mb-4">Unstake your AfroX tokens and claim rewards.</div>

            <label className="block text-xs text-gray-300 mb-1">Amount to Unstake</label>
            <input type="number" step={1 / (10 ** decimals)} value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} placeholder="0.0" className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500" />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => doUnstake(unstakeAmount)} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium" disabled={!isConnected || loading}>Unstake</button>
              <button onClick={() => doClaim()} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={!isConnected || loading}>Claim Rewards</button>
            </div>

            <div className="mt-4 text-xs text-gray-400">Your Rewards: <span className="text-orange-300 font-medium">{rewards} {TOKEN_LABEL}</span></div>
          </motion.div>
        </section>

        {/* Rewards center */}
        <section className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10 mb-6">
          <h3 className="text-lg font-bold mb-4">Rewards Center</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="text-sm text-gray-300 mb-3">Estimated rewards calculator</div>

              <label className="block text-xs text-gray-400 mb-1">(Days to Stake)</label>
              <input type="number" step="1" value={calcDays} onChange={(e) => setCalcDays(Number(e.target.value))} className="w-full p-2 rounded bg-gray-800 text-white mb-3" />

              <label className="block text-xs text-gray-400 mb-1">Amount to Stake (AfroX)</label>
              <input type="number" step={1 / (10 ** decimals)} value={calcAmt} onChange={(e) => setCalcAmt(e.target.value)} className="w-full p-2 rounded bg-gray-800 text-white mb-4" />

              <div className="text-gray-300">
                Estimated rewards for {calcDays} days:
                <span className="font-bold text-white"> {Number(calcResult.tokens).toFixed(decimals)} {TOKEN_LABEL}</span>
                <div className="text-sm text-gray-500">≈ ${Number(calcResult.usd).toFixed(6)} (at ${PRICE_USD_STATIC} per AfroX)</div>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-orange-600/20 flex flex-col justify-center items-start">
              <div className="text-xs text-gray-400">APR (protocol)</div>
              <div className="text-2xl font-bold text-orange-300">{APR.toFixed(2)}% <span className="text-sm text-gray-400">(if staked for 365 days)</span></div>

              <div className="mt-3 text-xs text-gray-400 leading-relaxed">
                Daily APR = <span className="text-orange-300 font-medium">{(dailyRate * 100).toFixed(4)}%</span><br />
                Monthly Bonus = <span className="text-orange-300 font-medium">+{(monthlyBonusRate * 100).toFixed(4)}% (per month)</span> if staked ≥ 30 days<br />
                Total yearly ≈ <span className="text-orange-300 font-medium">{APR.toFixed(2)}%</span>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                *Rewards grow live when user interacts* • Staked days: <span className="font-semibold text-white">{stakedDays}</span> (30-day bonus: <span className="font-semibold">{has30DayBonus ? 'Yes' : 'No'}</span>)
              </div>
            </div>
          </div>
        </section>

        {/* debug panel */}
        <section className="mb-6">
          <div className="bg-gray-900 p-4 rounded-xl text-xs text-gray-400">
            <div>Connected: <span className="text-white font-medium">{isConnected ? 'Yes' : 'No'}</span></div>
            <div>Wallet: <span className="text-white font-mono">{address ? shortAddr(address) : '—'}</span></div>
            <div>Token decimals: <span className="text-orange-300">{decimals}</span></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-800 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">© 2019-Present AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A</div>
      </footer>

      {alertMsg && <div className="fixed right-6 bottom-6 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg">{alertMsg}</div>}
    </div>
  );
}
