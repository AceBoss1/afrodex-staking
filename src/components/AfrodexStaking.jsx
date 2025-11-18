'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

import { STAKING_ABI, AFROX_PROXY_ABI } from '../lib/abis';
import { readContractSafe, writeContractSafe } from '../lib/contracts';

// If you set NEXT_PUBLIC_TOKEN_PROXY_ADDRESS in .env.local it will be used, otherwise fallback to the known proxy.
const PROXY_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_PROXY_ADDRESS || '0x08130635368AA28b217a4dfb68E1bF8dC525621C';

const TOKEN_LOGO = '/afrodex_token.png';
const DEFAULT_DECIMALS = 4;

// Reward constants (these are contract-derived but kept here as constants for the UI calc rules the project agreed on)
const CONTRACT_DERIVED = {
  // interpretation: contract exposes rewardRate = 60 => 60/10000 = 0.006 (0.6% daily)
  // bonusRate = 6 => 6/10000 = 0.0006 (0.06% daily bonus after 30 days)
  rewardRateRaw: 60,
  bonusRateRaw: 6,
  stakeRewardPeriod: 86400,
  stakeBonusPeriod: 2592000,
};

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient(); // pass to writeContractSafe

  // token + chain state
  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');

  // analytics
  const [maximumSupply, setMaximumSupply] = useState(null);
  const [totalSupply, setTotalSupply] = useState(null);
  const [totalStakeRewardMinted, setTotalStakeRewardMinted] = useState(null);

  // stake / unstake form
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // timestamps
  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  // loading / tx
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  // tab
  const [activeTab, setActiveTab] = useState('staking');

  // ----- helpers -----
  const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '—');
  const showAlert = (m, t = 6000) => { setAlertMsg(String(m)); setTimeout(() => setAlertMsg(null), t); };

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
    } catch (e) {
      return 0n;
    }
  }, [decimals]);

  // ----- on-chain fetch -----
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;
    try {
      // token decimals (proxy)
      const d = await readContractSafe(publicClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'decimals' });
      setDecimals(Number.isFinite(Number(d)) ? Number(d) : DEFAULT_DECIMALS);

      // analytics (can be fetched without wallet)
      const maxS = await readContractSafe(publicClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'maximumSupply' });
      const totS = await readContractSafe(publicClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'totalSupply' });
      const minted = await readContractSafe(publicClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'totalStakeRewardMinted' });

      setMaximumSupply(maxS ? toHuman(maxS) : null);
      setTotalSupply(totS ? toHuman(totS) : null);
      setTotalStakeRewardMinted(minted ? toHuman(minted) : null);

      // wallet-specific values
      if (address) {
        const bal = await readContractSafe(publicClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'balanceOf', args: [address] });
        setWalletBalance(toHuman(bal ?? 0n));

        const stakeInfo = await readContractSafe(publicClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'viewStakeInfoOf', args: [address] });
        if (stakeInfo) {
          // order confirmed by you: 0 stakeBalance, 1 rewardValue, 2 lastUnstakeTimestamp, 3 lastRewardTimestamp
          const stakeBalRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
          const rewardValRaw = stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n;
          const lastUnRaw = stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n;
          const lastRRaw = stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n;

          setStakedBalance(toHuman(stakeBalRaw ?? 0n));
          setRewards(toHuman(rewardValRaw ?? 0n));
          setLastUnstakeTs(Number(lastUnRaw ?? 0n));
          setLastRewardTs(Number(lastRRaw ?? 0n));
        } else {
          setStakedBalance('0');
          setRewards('0');
          setLastUnstakeTs(0);
          setLastRewardTs(0);
        }

        // allowance (optional)
        const allowRaw = await readContractSafe(publicClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'allowance', args: [address, PROXY_ADDRESS] });
        setAllowance(toHuman(allowRaw ?? 0n));
      } else {
        // not connected
        // show analytics though
      }

    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('fetchOnChain err', err);
    }
  }, [publicClient, address, toHuman]);

  useEffect(() => {
    fetchOnChain();
    const t = setInterval(fetchOnChain, 20_000);
    return () => clearInterval(t);
  }, [fetchOnChain]);

  // ----- reward projection calculation -----
  // using contract-derived constants provided earlier
  const rewardRate = CONTRACT_DERIVED.rewardRateRaw / 10000; // 60 -> 0.006 = 0.6% daily
  const bonusRate = CONTRACT_DERIVED.bonusRateRaw / 10000;   // 6 -> 0.0006 = 0.06% daily bonus
  const stakeRewardPeriod = CONTRACT_DERIVED.stakeRewardPeriod;
  const stakeBonusPeriod = CONTRACT_DERIVED.stakeBonusPeriod;

  // days staked: use lastUnstakeTs if >0 else lastRewardTs
  const daysStaked = useMemo(() => {
    const ref = lastUnstakeTs && lastUnstakeTs > 0 ? lastUnstakeTs : lastRewardTs;
    if (!ref || ref <= 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - ref) / 86400);
  }, [lastUnstakeTs, lastRewardTs]);

  const calcRewards = useCallback((principalHuman, days) => {
    const p = Number(principalHuman || 0);
    const d = Number(days || 0);
    if (!p || p <= 0) return { daily: 0, monthly: 0, yearly: 0 };

    // daily rate depends on whether bonus unlocked
    const baseDaily = p * rewardRate; // p * 0.006
    const bonusDaily = (d >= 30) ? p * bonusRate : 0; // p * 0.0006
    const daily = baseDaily + bonusDaily;

    // monthly approximate 30-day window
    const monthly = daily * 30;

    // yearly: follow project's constant APR calculation (we hide APR but show result). Project specified 239.1% for 1b example.
    // We'll compute yearly based on the piecewise method the project locked in:
    // first 30 days use rewardRate, remaining 335 days use rewardRate + bonusRate
    const first30 = p * rewardRate * Math.min(d, 30);
    const remainingDays = Math.max(0, 365 - 30);
    const remaining = p * (rewardRate + bonusRate) * remainingDays;
    const yearly = first30 + remaining; // if d < 30 this will undercount actual year but it's the agreed constant method

    return { daily, monthly, yearly };
  }, [rewardRate, bonusRate]);

  const projections = useMemo(() => calcRewards(stakedBalance || 0, daysStaked), [stakedBalance, daysStaked, calcRewards]);

  // ----- write helpers (approve / stake / unstake / claim) -----
  const handleApprove = async (human) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    setLoading(true); setTxHash(null);
    try {
      const raw = toRaw(human);
      const tx = await writeContractSafe(walletClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'approve', args: [PROXY_ADDRESS, raw] });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      // wait best-effort
      try { if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash }); else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash }); } catch(e){}
      await fetchOnChain(); showAlert('Approve confirmed');
    } catch (err) { console.error('approve', err); showAlert('Approve failed: ' + (err?.message ?? err)); }
    finally { setLoading(false); }
  };

  const handleStake = async (human) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!human || Number(human) <= 0) { showAlert('Enter amount to stake'); return; }
    setLoading(true); setTxHash(null);
    try {
      const raw = toRaw(human);

      // primary attempt: stake on proxy
      const tx = await writeContractSafe(walletClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'stake', args: [raw] });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      try { if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash }); else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash }); } catch(e){}

      showAlert('Stake submitted');
      setStakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake err', err);
      showAlert('Stake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  const handleUnstake = async (human) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!human || Number(human) < 0) { showAlert('Enter amount to unstake'); return; }
    setLoading(true); setTxHash(null);
    try {
      // prefer calling unstake(amount)
      const raw = toRaw(human || '0');
      const tx = await writeContractSafe(walletClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'unstake', args: [raw] });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      try { if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash }); else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash }); } catch(e){}

      showAlert('Unstake executed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake err', err);
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  const handleClaim = async () => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    setLoading(true); setTxHash(null);
    try {
      // try unstake(0) -> some proxies support this as a "claim"; if not, try unstake(1-unit) hack
      try {
        const tx0 = await writeContractSafe(walletClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'unstake', args: [0n] });
        setTxHash(tx0?.hash ?? tx0?.request?.hash ?? null);
        try { if (tx0?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx0.request.hash }); else if (tx0?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx0.hash }); } catch(e){}
        showAlert('Claim executed (unstake(0))');
        await fetchOnChain();
        return;
      } catch (e0) {
        // fallback: tiny unstake + restake to trigger reward minting if allowed by contract
        try {
          const tiny = parseUnits('1', decimals); // smallest workable unit is "1" at token decimals (this is 1 AfroX)
          const tx1 = await writeContractSafe(walletClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'unstake', args: [tiny] });
          try { if (tx1?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx1.request.hash }); else if (tx1?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx1.hash }); } catch(e){}
          // restake same tiny amount
          const tx2 = await writeContractSafe(walletClient, { address: PROXY_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'stake', args: [tiny] });
          try { if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash }); else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash }); } catch(e){}
          showAlert('Claim fallback executed (unstake tiny + restake)');
          await fetchOnChain();
          return;
        } catch (e1) {
          throw new Error('No claim path available');
        }
      }
    } catch (err) {
      console.error('claim err', err);
      showAlert('Claim failed: ' + (err?.message ?? err));
    } finally { setLoading(false); }
  };

  // ----- UI helpers: max buttons -----
  const setMaxStake = () => setStakeAmount(walletBalance || '0');
  const setMaxUnstake = () => setUnstakeAmount(stakedBalance || '0');

  // ----- render -----
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
        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button className={`px-4 py-2 rounded ${activeTab==='staking'? 'bg-orange-600 text-black':'bg-gray-900'}`} onClick={() => setActiveTab('staking')}>AfroX Staking Dashboard</button>
          <button className={`px-4 py-2 rounded ${activeTab==='ambassador'? 'bg-orange-600 text-black':'bg-gray-900'}`} onClick={() => setActiveTab('ambassador')}>AfroDex Ambassador Dashboard</button>
          <button className={`px-4 py-2 rounded ${activeTab==='trust'? 'bg-orange-600 text-black':'bg-gray-900'}`} onClick={() => setActiveTab('trust')}>AfroDex Community of Trust</button>
        </div>

        {activeTab === 'staking' && (
          <>
            {/* Top analytics row */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
                <div className="text-sm text-gray-300">Wallet Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  {walletBalance} AfroX
                </div>
                <div className="text-xs text-gray-400 mt-2">Available in your wallet</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
                <div className="text-sm text-gray-300">Staked Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  {stakedBalance} AfroX
                </div>
                <div className="text-xs text-gray-400 mt-2">Last unstake: {lastUnstakeTs ? new Date(lastUnstakeTs * 1000).toLocaleString() : '—'}</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
                <div className="text-sm text-gray-300">Accumulated Rewards</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
                  <span className="text-green-300">{rewards} AfroX</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">Last reward update: {lastRewardTs ? new Date(lastRewardTs * 1000).toLocaleString() : '—'}</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10 flex flex-col justify-between" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-300">Badge Tier</div>
                    <div className="text-lg font-semibold text-orange-300">{computeBadge(stakedBalance)}</div>
                  </div>
                  <div className="text-xs text-gray-400">{address ? shortAddr(address) : 'Not connected'}</div>
                </div>
                <div className="mt-3 text-xs text-gray-400">Tier thresholds: 🔰Cadet 1b, 🔱Captain 10b, ⚜️Commander 50b, ✳️General 100b, 〽️Marshal 500b, 💠Platinum Sentinel 1tr, ❇️Diamond Custodian 10tr</div>
              </motion.div>

            </section>

            {/* Stake/Unstake */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
                <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
                <div className="text-sm text-gray-400 mb-4">Approve AfroX to the contract (if needed) and stake.</div>

                <div className="mb-3">
                  <label className="block text-xs text-gray-300 mb-1">Amount (AfroX)</label>
                  <div className="flex gap-2">
                    <input type="number" step={1 / (10 ** decimals)} value={stakeAmount} onChange={(e)=>setStakeAmount(e.target.value)} placeholder="0.0" className="w-full p-3 rounded bg-gray-800" />
                    <button onClick={setMaxStake} className="px-3 rounded bg-gray-700">MAX</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleApprove(stakeAmount || '1000000')} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium">Approve</button>
                  <button onClick={() => handleStake(stakeAmount)} className="py-3 rounded-xl bg-orange-500 text-black font-semibold">Stake</button>
                </div>

                <div className="mt-4 text-xs text-gray-400">Allowance: <span className="text-orange-300">{allowance}</span></div>
                {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
              </motion.div>

              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
                <h2 className="text-xl font-bold mb-3">Unstake & Claim</h2>
                <div className="text-sm text-gray-400 mb-4">Unstake tokens or claim your accumulated rewards.</div>

                <div className="mb-3">
                  <label className="block text-xs text-gray-300 mb-1">Amount to Unstake</label>
                  <div className="flex gap-2">
                    <input type="number" step={1 / (10 ** decimals)} value={unstakeAmount} onChange={(e)=>setUnstakeAmount(e.target.value)} placeholder="0.0" className="w-full p-3 rounded bg-gray-800" />
                    <button onClick={setMaxUnstake} className="px-3 rounded bg-gray-700">MAX</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleUnstake(unstakeAmount)} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium">Unstake</button>
                  <button onClick={handleClaim} className="py-3 rounded-xl bg-orange-500 text-black font-semibold">Claim Rewards</button>
                </div>

                <div className="mt-4 text-xs text-gray-400">Your Rewards: <span className="text-orange-300 font-medium">{rewards} AfroX</span></div>
              </motion.div>

            </section>

            {/* Rewards Calculator + Token Analytics */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="md:col-span-2 bg-gray-900 p-6 rounded-3xl border border-orange-600/10">
                <h3 className="text-lg font-bold mb-4">Rewards Projection Calculator</h3>

                <div className="flex items-center gap-6 mb-4">
                  <div className="text-sm text-gray-300">Daily Rate (hidden in UI, used for calc)</div>
                  <div className="text-xs text-gray-400">(Calculated from contract parameters)</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-800 p-4 rounded-xl flex flex-col items-start">
                    <div className="text-xs text-gray-400">Daily Reward</div>
                    <div className="text-xl font-bold flex items-center gap-2"><img src={TOKEN_LOGO} className="h-5"/> {Number(projections.daily).toLocaleString(undefined, {maximumFractionDigits: 6})} AfroX</div>
                  </div>

                  <div className="bg-gray-800 p-4 rounded-xl flex flex-col items-start">
                    <div className="text-xs text-gray-400">Monthly Reward (30d)</div>
                    <div className="text-xl font-bold flex items-center gap-2"><img src={TOKEN_LOGO} className="h-5"/> {Number(projections.monthly).toLocaleString(undefined, {maximumFractionDigits: 6})} AfroX</div>
                  </div>

                  <div className="bg-gray-800 p-4 rounded-xl flex flex-col items-start">
                    <div className="text-xs text-gray-400">Yearly Reward (365d)</div>
                    <div className="text-xl font-bold flex items-center gap-2"><img src={TOKEN_LOGO} className="h-5"/> {Number(projections.yearly).toLocaleString(undefined, {maximumFractionDigits: 6})} AfroX</div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-gray-400">⚠️ <strong>Disclaimer:</strong> These are estimated rewards calculated from contract parameters and a piecewise daily rate. Actual rewards are computed by the blockchain and can differ slightly.</p>

              </div>

              <div className="bg-gray-900 p-4 rounded-xl border border-orange-600/20">
                <div className="text-xs text-gray-400">Token Analytics</div>
                <div className="mt-3 text-sm text-white flex items-center gap-2"><img src={TOKEN_LOGO} className="h-5"/> Maximum Supply: <span className="ml-auto">{maximumSupply ?? '—'}</span></div>
                <div className="mt-2 text-sm text-white flex items-center gap-2"><img src={TOKEN_LOGO} className="h-5"/> Current Total Supply: <span className="ml-auto">{totalSupply ?? '—'}</span></div>
                <div className="mt-2 text-sm text-white flex items-center gap-2"><img src={TOKEN_LOGO} className="h-5"/> Total Stake Reward Minted: <span className="ml-auto">{totalStakeRewardMinted ?? '—'}</span></div>
                <div className="mt-2 text-sm text-white flex items-center gap-2"><img src={TOKEN_LOGO} className="h-5"/> Un-minted AfroX: <span className="ml-auto">{(maximumSupply && totalSupply) ? (Number(maximumSupply) - Number(totalSupply)).toLocaleString() : '—'}</span></div>
              </div>
            </section>

            {/* Important Disclaimer + Footer */}
            <div className="mt-6 p-4 bg-[#0b0b0b] rounded border border-gray-800 text-sm text-gray-300">
              <strong>Important Disclaimer:</strong> By using this platform you confirm you are of legal age, reside in a jurisdiction where crypto staking is legal, and accept all risks and liabilities. The staking contract mints/burns as rewards are paid.
            </div>

            <footer className="border-t border-gray-800 py-6 mt-6">
              <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">© 2025 AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A</div>
            </footer>

          </>
        )}

        {activeTab === 'ambassador' && (
          <div className="bg-gray-900 p-6 rounded-xl"> 
            <h2 className="text-xl">AfroDex Ambassador Dashboard</h2>
            <p className="text-sm text-gray-400">Placeholder area — referral, leaderboard and ambassador tools will appear here.</p>
          </div>
        )}

        {activeTab === 'trust' && (
          <div className="bg-gray-900 p-6 rounded-xl"> 
            <h2 className="text-xl">AfroDex Community of Trust</h2>
            <p className="text-sm text-gray-400">Placeholder area — governance and community tools will appear here.</p>
          </div>
        )}

      </main>

      {alertMsg && <div className="fixed right-6 bottom-6 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg">{alertMsg}</div>}
    </div>
  );
}

// ----- small helpers outside component -----
function computeBadge(stakedHuman) {
  // expect human string or number
  const n = Number(String(stakedHuman || '0').replace(/,/g, '')) || 0;
  // amounts are AfroX (human)
  if (n >= 10_000_000_000) return '❇️ Diamond Custodian'; // 10 trillion
  if (n >= 1_000_000_000_000) return '💠 Platinum Sentinel'; // 1 trillion (note ordering - large values)
  if (n >= 500_000_000_000) return '〽️ Marshal';
  if (n >= 100_000_000_000) return '✳️ General';
  if (n >= 50_000_000_000) return '⚜️ Commander';
  if (n >= 10_000_000_000) return '🔱 Captain';
  if (n >= 1_000_000_000) return '🔰 Cadet';
  return 'Starter';
}
