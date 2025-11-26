// src/components/AfrodexStaking.jsx - COMPLETE FIXED VERSION
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

const DAILY_RATE_DEC = Number(REWARD_RATE) / 10000;
const BONUS_DAILY_DEC = Number(BONUS_RATE) / 10000;
const FIRST_30_DAYS = 30;
const REMAINING_DAYS = 365 - 30;

// Badge tier thresholds - exported for child components
export const BADGE_TIERS = [
  { name: 'Diamond Custodian', emoji: '❇️', minStake: 10e12, threshold: '≥10T AfroX', canPropose: true, levels: 5 },
  { name: 'Platinum Sentinel', emoji: '💠', minStake: 1e12, threshold: '≥1T AfroX', canPropose: true, levels: 5 },
  { name: 'Marshal', emoji: '〽️', minStake: 500e9, threshold: '≥500B AfroX', canPropose: true, levels: 5 },
  { name: 'General', emoji: '⭐', minStake: 100e9, threshold: '≥100B AfroX', canPropose: true, levels: 4 },
  { name: 'Commander', emoji: '⚜️', minStake: 50e9, threshold: '≥50B AfroX', canPropose: false, levels: 3 },
  { name: 'Captain', emoji: '🔱', minStake: 10e9, threshold: '≥10B AfroX', canPropose: false, levels: 2 },
  { name: 'Cadet', emoji: '🔰', minStake: 1e9, threshold: '≥1B AfroX', canPropose: false, levels: 1 },
  { name: 'Starter', emoji: '✳️', minStake: 0, threshold: 'Stake to unlock', canPropose: false, levels: 0 }
];

export function getBadgeTierFromStake(stakedBalance) {
  const staked = Number(stakedBalance || '0');
  for (const tier of BADGE_TIERS) {
    if (staked >= tier.minStake) return tier;
  }
  return BADGE_TIERS[BADGE_TIERS.length - 1];
}

// Token Analytics Donut Chart
function TokenAnalyticsChart({ currentSupply, rewardsMinted, maxSupply }) {
  const current = Number(currentSupply || 0);
  const minted = Number(rewardsMinted || 0);
  const max = Number(maxSupply || 0);
  const unminted = Math.max(0, max - current - minted);

  const currentPct = max > 0 ? (current / max) * 100 : 0;
  const mintedPct = max > 0 ? (minted / max) * 100 : 0;

  const radius = 80;
  const circumference = 2 * Math.PI * radius;

  function prettyNum(num, precision = 2) {
    const n = Number(num || 0);
    if (n >= 1e15) return (n / 1e15).toFixed(precision) + 'Q';
    if (n >= 1e12) return (n / 1e12).toFixed(precision) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(precision) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(precision) + 'M';
    return n.toFixed(precision);
  }

  return (
    <motion.div className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.12)' }}>
      <h2 className="text-xl font-bold text-center mb-4">Token Analytics</h2>
      
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={radius} fill="none" stroke="#374151" strokeWidth="24" />
            <circle cx="100" cy="100" r={radius} fill="none" stroke="#f97316" strokeWidth="24"
              strokeDasharray={`${((100 - currentPct - mintedPct) / 100) * circumference} ${circumference}`}
              strokeDashoffset={-(((currentPct + mintedPct) / 100) * circumference)}
              transform="rotate(-90 100 100)" />
            <circle cx="100" cy="100" r={radius} fill="none" stroke="#22c55e" strokeWidth="24"
              strokeDasharray={`${(mintedPct / 100) * circumference} ${circumference}`}
              strokeDashoffset={-((currentPct / 100) * circumference)}
              transform="rotate(-90 100 100)" />
            <circle cx="100" cy="100" r={radius} fill="none" stroke="#3b82f6" strokeWidth="24"
              strokeDasharray={`${(currentPct / 100) * circumference} ${circumference}`}
              strokeDashoffset={0}
              transform="rotate(-90 100 100)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xs text-gray-400">Max Supply</div>
            <div className="text-xl font-bold text-white">{prettyNum(max)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-sm text-gray-400">Current Supply:</span></div>
          <span className="text-sm font-semibold text-white">{prettyNum(current)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-sm text-gray-400">Rewards Minted:</span></div>
          <span className="text-sm font-semibold text-green-400">{prettyNum(minted)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-sm text-gray-400">Un-minted:</span></div>
          <span className="text-sm font-semibold text-orange-400">{prettyNum(unminted)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewardsAccum, setRewardsAccum] = useState('0');
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
  const showAlert = (m, t = 6000) => { setAlertMsg(String(m)); setTimeout(() => setAlertMsg(null), t); };

  const toHuman = useCallback((raw) => {
    try { return raw ? formatUnits(raw, decimals) : '0'; } catch { return '0'; }
  }, [decimals]);

  const toRaw = useCallback((human) => {
    try { return parseUnits(String(human || '0'), decimals); } catch { return 0n; }
  }, [decimals]);

  function prettyNumber(humanStr, precision = 2) {
    const n = Number(humanStr || '0');
    if (!Number.isFinite(n)) return '0';
    if (Math.abs(n) >= 1e15) return (n / 1e15).toFixed(precision) + 'Q';
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(precision) + 'T';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(precision) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(precision) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(precision) + 'K';
    return n.toLocaleString(undefined, { maximumFractionDigits: precision });
  }

  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;
    try {
      const priceData = await getAfroxPriceUSD(publicClient, process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS);
      if (priceData) setAfroxPrice(priceData.priceUSD);

      const decRaw = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'decimals', args: [] });
      const d = decRaw !== null ? Number(decRaw) : DEFAULT_DECIMALS;
      setDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);

      if (address) {
        const walletBal = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'balanceOf', args: [address] });
        setWalletBalance(walletBal !== null ? toHuman(walletBal) : '0');

        const stakeInfo = await readContractSafe(publicClient, { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'viewStakeInfoOf', args: [address] });
        if (stakeInfo) {
          setStakedBalance(toHuman(stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n));
          setRewardsAccum(toHuman(stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n));
          setLastUnstakeTs(Number(stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n));
          setLastRewardTs(Number(stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n));
        }
      }

      const maxS = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'maximumSupply' });
      setMaximumSupply(maxS !== null ? toHuman(maxS) : null);
      const totalS = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'totalSupply' });
      setTotalSupply(totalS !== null ? toHuman(totalS) : null);
      const totalMinted = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'totalStakeRewardMinted' });
      setTotalStakeRewardMinted(totalMinted !== null ? toHuman(totalMinted) : null);
    } catch (err) { console.error('fetchOnChain error', err); }
  }, [publicClient, address, toHuman]);

  useEffect(() => {
    fetchOnChain();
    let t;
    if (isConnected) t = setInterval(fetchOnChain, 30_000);
    return () => clearInterval(t);
  }, [fetchOnChain, isConnected]);

  const stakedDays = useMemo(() => {
    const ref = lastUnstakeTs > 0 ? lastUnstakeTs : lastRewardTs;
    if (!ref || ref <= 0) return 0;
    return Math.floor((Date.now() / 1000 - ref) / 86400);
  }, [lastUnstakeTs, lastRewardTs]);

  const calcProjections = useCallback((principalHuman) => {
    const p = Number(principalHuman || stakedBalance || '0');
    if (!p || p <= 0) return { hourly: 0, daily: 0, monthly: 0, yearly: 0 };
    const baseDaily = p * DAILY_RATE_DEC;
    const bonusDaily = stakedDays >= FIRST_30_DAYS ? p * BONUS_DAILY_DEC : 0;
    const daily = baseDaily + bonusDaily;
    return {
      hourly: daily / 24,
      daily,
      monthly: daily * 30,
      yearly: (p * DAILY_RATE_DEC * FIRST_30_DAYS) + (p * (DAILY_RATE_DEC + BONUS_DAILY_DEC) * REMAINING_DAYS)
    };
  }, [stakedBalance, stakedDays]);

  const projections = useMemo(() => calcProjections(stakedBalance), [calcProjections, stakedBalance]);
  const badgeTier = useMemo(() => getBadgeTierFromStake(stakedBalance), [stakedBalance]);

  const ensureClient = () => { if (!walletClient) throw new Error('Wallet not connected'); return walletClient; };

  async function doApprove(amountHuman) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      setLoading(true);
      const tx = await writeContractSafe(ensureClient(), { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'approve', args: [STAKING_ADDRESS, toRaw(amountHuman)] });
      setTxHash(tx?.hash ?? null);
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) { showAlert('Approve failed: ' + (err?.message ?? err)); }
    finally { setLoading(false); }
  }

  async function doStake(humanAmount) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount'); return; }
      setLoading(true);
      const tx = await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [toRaw(humanAmount)] });
      setTxHash(tx?.hash ?? null);
      showAlert('Stake confirmed');
      setStakeAmount('');
      await fetchOnChain();
    } catch (err) { showAlert('Stake failed: ' + (err?.message ?? err)); }
    finally { setLoading(false); }
  }

  async function doUnstake(humanAmount) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount'); return; }
      setLoading(true);
      const tx = await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [toRaw(humanAmount)] });
      setTxHash(tx?.hash ?? null);
      showAlert('Unstake confirmed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) { showAlert('Unstake failed: ' + (err?.message ?? err)); }
    finally { setLoading(false); }
  }

  async function doClaim() {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      setLoading(true);
      const tiny = parseUnits('0.0001', decimals);
      await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [tiny] });
      await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [tiny] });
      showAlert('Claim executed');
      await fetchOnChain();
    } catch (err) { showAlert('Claim failed: ' + (err?.message ?? err)); }
    finally { setLoading(false); }
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      <header className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">AfroX Staking Dashboard</h1>
          <p className="text-sm text-orange-300/80">Stake AfroX and earn rewards</p>
        </div>
        <div className="text-xs text-gray-300">{isConnected ? shortAddr(address) : 'Not connected'}</div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-12">
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <button onClick={() => setActiveTab('staking')} className={`px-3 py-2 rounded ${activeTab === 'staking' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>AfroX Staking Dashboard</button>
          <button onClick={() => setActiveTab('lp-mining')} className={`px-3 py-2 rounded ${activeTab === 'lp-mining' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>LP Token Lock-Mining Dashboard</button>
          <a href="https://dex.afrox.one/" target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded bg-gray-900 text-gray-300 hover:bg-orange-600 hover:text-black">AfroSwap</a>
          <button onClick={() => setActiveTab('ambassador')} className={`px-3 py-2 rounded ${activeTab === 'ambassador' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>Ambassador Dashboard</button>
          <button onClick={() => setActiveTab('governance')} className={`px-3 py-2 rounded ${activeTab === 'governance' ? 'bg-orange-600 text-black' : 'bg-gray-900 text-gray-300'}`}>Community of Trust Dashboard</button>
        </div>

        {activeTab === 'staking' && (
          <>
            {/* Stats Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={cardGlow}>
                <div className="text-sm text-gray-300">Wallet Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" />
                  <span>{prettyNumber(walletBalance, 2)} AfroX</span>
                </div>
                {afroxPrice && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(walletBalance, afroxPrice))}</div>}
                <div className="text-xs text-gray-400 mt-2">Available in your wallet</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={cardGlow}>
                <div className="text-sm text-gray-300">Staked Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" />
                  <span>{prettyNumber(stakedBalance, 2)} AfroX</span>
                </div>
                {afroxPrice && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(stakedBalance, afroxPrice))}</div>}
                <div className="text-xs text-gray-400 mt-2">Days staked: {stakedDays}</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={cardGlow}>
                <div className="text-sm text-gray-300">Accumulated Rewards</div>
                <div className="text-2xl font-bold flex items-center gap-2 mt-2">
                  <img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" />
                  <span className="text-green-300">{prettyNumber(rewardsAccum, 2)} AfroX</span>
                </div>
                {afroxPrice && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(rewardsAccum, afroxPrice))}</div>}
                <div className="text-xs text-gray-400 mt-2">Auto-claimed on unstake</div>
              </motion.div>

              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={cardGlow}>
                <div className="text-sm text-gray-300">Badge Tier</div>
                <div className="text-2xl font-semibold text-orange-300 flex items-center gap-2 mt-1">
                  <span className="text-3xl">{badgeTier.emoji}</span>
                  <span>{badgeTier.name}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">{badgeTier.threshold}</div>
              </motion.div>
            </section>

            {/* Stake/Unstake */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <motion.div className="bg-gray-900 p-6 rounded-3xl" whileHover={{ scale: 1.01 }}>
                <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
                <div className="text-sm text-gray-400 mb-4">Approve AfroX (only if required) then stake.</div>
                <div className="flex gap-2 mb-3">
                  <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="0.0" className="flex-1 p-3 rounded bg-gray-800 text-white" />
                  <button onClick={() => setStakeAmount(walletBalance)} className="px-3 rounded bg-gray-800 text-sm">MAX</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => doApprove(stakeAmount || '1000000000')} disabled={loading} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50">Approve</button>
                  <button onClick={() => doStake(stakeAmount)} disabled={loading} className="py-3 rounded-xl bg-orange-500 text-black font-semibold">Stake</button>
                </div>
                <div className="mt-4 p-3 bg-gray-800 rounded-lg text-[10px] text-gray-300">
                  <div className="font-semibold mb-1">Badge Tier Requirements:</div>
                  <div>🔰Cadet ≥1B | 🔱Captain ≥10B | ⚜️Commander ≥50B | ⭐General ≥100B</div>
                  <div>〽️Marshal ≥500B | 💠Platinum Sentinel ≥1T | ❇️Diamond Custodian ≥10T</div>
                </div>
              </motion.div>

              <motion.div className="bg-gray-900 p-6 rounded-3xl" whileHover={{ scale: 1.01 }}>
                <h2 className="text-xl font-bold mb-3">Unstake & Claim</h2>
                <div className="text-sm text-gray-400 mb-4">Unstake tokens (this also auto-claims rewards). Alternatively use Claim to run a tiny unstake/restake claim if contract has no claim fn.</div>
                <div className="flex gap-2 mb-3">
                  <input type="number" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} placeholder="0.0" className="flex-1 p-3 rounded bg-gray-800 text-white" />
                  <button onClick={() => setUnstakeAmount(stakedBalance)} className="px-3 rounded bg-gray-800 text-sm">MAX</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => doUnstake(unstakeAmount)} disabled={loading} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50">Unstake</button>
                  <button onClick={doClaim} disabled={loading} className="py-3 rounded-xl bg-orange-500 text-black font-semibold">Claim Rewards</button>
                </div>
                <div className="mt-4 text-xs text-gray-400">Note: your proxy auto-claims rewards on stake/unstake. To manually trigger claim without separate claim function, stake/unstake a tiny amount (e.g. 0.0001 AfroX).</div>
                {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-orange-200 break-all">{txHash}</span></div>}
              </motion.div>
            </section>

            {/* Reward Projections + Token Analytics */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10" whileHover={cardGlow}>
                <h2 className="text-xl font-bold mb-4">Reward Projections</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Hourly', value: projections.hourly },
                    { label: 'Daily', value: projections.daily },
                    { label: 'Monthly', value: projections.monthly },
                    { label: 'Yearly', value: projections.yearly },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-4 bg-gray-800 rounded-xl text-center">
                      <div className="text-sm text-gray-400">{label}</div>
                      <div className="text-lg font-bold text-green-400 mt-1">{prettyNumber(value, 4)} AfroX</div>
                      {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(value, afroxPrice))}</div>}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-gray-500 text-center">
                  Base: 0.6%/day {stakedDays >= 30 && '+ 0.06% bonus'} | Days staked: {stakedDays}
                </div>
              </motion.div>

              <TokenAnalyticsChart currentSupply={totalSupply} rewardsMinted={totalStakeRewardMinted} maxSupply={maximumSupply} />
            </section>

            {/* Disclaimer and Footer */}
            <div className="mt-6">
              <div className="p-4 bg-[#0b0b0b] rounded border border-gray-800 text-sm text-gray-300">
                ⚠️ <strong>Important Disclaimer:</strong> By using this platform you confirm you are of legal age, live in a jurisdiction where staking crypto is permitted, and accept all liability and risk.
              </div>

              <footer className="border-t border-gray-800 py-6 mt-6">
                <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">
                  © 2019-Present AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
                </div>
              </footer>
            </div>
          </>
        )}

        {activeTab === 'lp-mining' && <LPMiningDashboard afroxPrice={afroxPrice} />}
        {activeTab === 'ambassador' && <AmbassadorDashboard stakedBalance={stakedBalance} badgeTier={badgeTier} afroxPrice={afroxPrice} />}
        {activeTab === 'governance' && <GovernanceDashboard stakedBalance={stakedBalance} badgeTier={badgeTier} afroxPrice={afroxPrice} />}
      </main>

      {alertMsg && <div className="fixed right-4 bottom-4 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg z-50">{alertMsg}</div>}
    </div>
  );
}
