// src/components/AfrodexStaking.jsx - WITH SUPABASE INTEGRATION
// Based on your existing component structure
// ADDED: Supabase calls for recording staking events, referrals, and commissions
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { useSearchParams } from 'next/navigation';

import { STAKING_ABI, AFROX_PROXY_ABI } from '../lib/abis';
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';
import AmbassadorDashboard from './AmbassadorDashboard';
import LPMiningDashboard from './LPMiningDashboard';
import GovernanceDashboard from './GovernanceDashboard';
import AfroSwap from './AfroSwap';
import { getAfroxPriceUSD, formatUSD, calculateUSDValue } from '../lib/priceUtils';

// =============================================
// SUPABASE IMPORTS - ADD THESE
// =============================================
import {
  initializeUserOnConnect,
  getUser,
  updateUserStake,
  recordStakingEvent,
  getStakingHistory,
  getAmbassadorStats,
  createReferralLink
} from '../lib/supabaseClient';

const TOKEN_LOGO = '/afrodex_token.png';
const LOGO_LEFT = '/afrodex_logoT.png';
const LOGO_RIGHT = '/afrodex_logoA.png';
const DEFAULT_DECIMALS = 4;
const REWARD_RATE = 60n;
const BONUS_RATE = 6n;
const DAILY_RATE_DEC = Number(REWARD_RATE) / 10000;
const BONUS_DAILY_DEC = Number(BONUS_RATE) / 10000;
const FIRST_30_DAYS = 30;
const REMAINING_DAYS = 365 - 30;

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
  for (const tier of BADGE_TIERS) { if (staked >= tier.minStake) return tier; }
  return BADGE_TIERS[BADGE_TIERS.length - 1];
}

export function createDynamicReferralLink(referralCode) {
  if (typeof window === 'undefined') return `https://hub.afrox.one/?ref=${referralCode}`;
  return `${window.location.origin}/?ref=${referralCode}`;
}

// Keep your existing SOCIAL_LINKS and SharedFooter exactly as they are
const SOCIAL_LINKS = [
  { name: 'Facebook', url: 'https://fb.me/AfroDex1', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>) },
  { name: 'Telegram', url: 'https://t.me/AfroDex', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>) },
  // ... keep your other social links
];

export function SharedFooter() {
  // Keep your existing SharedFooter implementation exactly as is
  return (
    <footer className="border-t border-gray-800 py-6 mt-8">
      {/* Your existing footer code */}
    </footer>
  );
}

function TokenAnalyticsChart({ currentSupply, rewardsMinted, maxSupply }) {
  // Keep your existing TokenAnalyticsChart implementation exactly as is
  const current = Number(currentSupply || 0), minted = Number(rewardsMinted || 0), max = Number(maxSupply || 0);
  const currentPct = max > 0 ? (current / max) * 100 : 0, mintedPct = max > 0 ? (minted / max) * 100 : 0;
  const radius = 80, circumference = 2 * Math.PI * radius;
  function prettyNum(num, p = 2) { const n = Number(num || 0); if (n >= 1e15) return (n / 1e15).toFixed(p) + 'Q'; if (n >= 1e12) return (n / 1e12).toFixed(p) + 'T'; if (n >= 1e9) return (n / 1e9).toFixed(p) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(p) + 'M'; return n.toFixed(p); }
  return (
    <motion.div className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.12)' }}>
      <h2 className="text-xl font-bold text-center mb-4">Token Analytics</h2>
      {/* Your existing chart code */}
    </motion.div>
  );
}

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const searchParams = useSearchParams();

  // Your existing state variables
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
  const [showAfroSwap, setShowAfroSwap] = useState(false);
  const [activeTab, setActiveTab] = useState('staking');

  // =============================================
  // NEW: SUPABASE STATE VARIABLES
  // =============================================
  const [dbUser, setDbUser] = useState(null);
  const [stakingHistory, setStakingHistory] = useState([]);

  // Your existing useEffects for page title and URL routing
  useEffect(() => {
    document.title = 'AfroX DeFi Hub | Stake, Mint, Mine, Swap, Earn & Govern';
  }, []);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['staking', 'lp-mining', 'ambassador', 'governance'].includes(tabParam)) {
      setActiveTab(tabParam);
    } else {
      setActiveTab('staking');
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const newUrl = tab === 'staking' ? '/' : `/?tab=${tab}`;
    window.history.pushState({}, '', newUrl);
  };

  // =============================================
  // NEW: INITIALIZE USER ON WALLET CONNECT
  // =============================================
  useEffect(() => {
    const initUser = async () => {
      if (!isConnected || !address) {
        setDbUser(null);
        return;
      }

      try {
        // Get referral code from URL if present
        const refCode = searchParams?.get('ref') || null;
        
        // Initialize user in Supabase (creates if new, handles referral registration)
        const user = await initializeUserOnConnect(address, refCode);
        setDbUser(user);
        
        if (refCode) {
          console.log(`📎 User connected with referral code: ${refCode}`);
        }

        // Load staking history from database
        const history = await getStakingHistory(address, 20);
        setStakingHistory(history);
        
      } catch (err) {
        console.error('Error initializing Supabase user:', err);
      }
    };

    initUser();
  }, [isConnected, address, searchParams]);

  // Your existing helper functions
  const showAlert = (m, t = 6000) => { setAlertMsg(String(m)); setTimeout(() => setAlertMsg(null), t); };
  const toHuman = useCallback((raw) => { try { return raw ? formatUnits(raw, decimals) : '0'; } catch { return '0'; } }, [decimals]);
  const toRaw = useCallback((human) => { try { return parseUnits(String(human || '0'), decimals); } catch { return 0n; } }, [decimals]);
  function prettyNumber(humanStr, precision = 2) { const n = Number(humanStr || '0'); if (!Number.isFinite(n)) return '0'; if (Math.abs(n) >= 1e15) return (n / 1e15).toFixed(precision) + 'Q'; if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(precision) + 'T'; if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(precision) + 'B'; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(precision) + 'M'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(precision) + 'K'; return n.toLocaleString(undefined, { maximumFractionDigits: precision }); }

  // Your existing fetchOnChain function
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;
    try {
      const priceData = await getAfroxPriceUSD(publicClient, process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS);
      if (priceData) setAfroxPrice(priceData.priceUSD);
      const decRaw = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'decimals', args: [] });
      setDecimals(Number.isFinite(Number(decRaw)) ? Number(decRaw) : DEFAULT_DECIMALS);
      if (address) {
        const walletBal = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'balanceOf', args: [address] });
        setWalletBalance(walletBal !== null ? toHuman(walletBal) : '0');
        const stakeInfo = await readContractSafe(publicClient, { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'viewStakeInfoOf', args: [address] });
        if (stakeInfo) { setStakedBalance(toHuman(stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n)); setRewardsAccum(toHuman(stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n)); setLastUnstakeTs(Number(stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n)); setLastRewardTs(Number(stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n)); }
      }
      const maxS = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'maximumSupply' }); setMaximumSupply(maxS !== null ? toHuman(maxS) : null);
      const totalS = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'totalSupply' }); setTotalSupply(totalS !== null ? toHuman(totalS) : null);
      const totalMinted = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'totalStakeRewardMinted' }); setTotalStakeRewardMinted(totalMinted !== null ? toHuman(totalMinted) : null);
    } catch (err) { console.error('fetchOnChain error', err); }
  }, [publicClient, address, toHuman]);

  useEffect(() => { fetchOnChain(); let t; if (isConnected) t = setInterval(fetchOnChain, 30_000); return () => clearInterval(t); }, [fetchOnChain, isConnected]);

  // =============================================
  // NEW: SYNC STAKED BALANCE TO SUPABASE
  // =============================================
  useEffect(() => {
    const syncStakeToDb = async () => {
      if (!address || !stakedBalance) return;
      
      try {
        const stakedNum = Number(stakedBalance);
        if (stakedNum >= 0) {
          await updateUserStake(address, stakedNum);
        }
      } catch (err) {
        console.error('Error syncing stake to DB:', err);
      }
    };

    // Debounce to avoid too many updates
    const timeout = setTimeout(syncStakeToDb, 3000);
    return () => clearTimeout(timeout);
  }, [address, stakedBalance]);

  // Your existing computed values
  const stakedDays = useMemo(() => { const ref = lastUnstakeTs > 0 ? lastUnstakeTs : lastRewardTs; if (!ref || ref <= 0) return 0; return Math.floor((Date.now() / 1000 - ref) / 86400); }, [lastUnstakeTs, lastRewardTs]);
  const projections = useMemo(() => { const p = Number(stakedBalance || '0'); if (!p || p <= 0) return { hourly: 0, daily: 0, monthly: 0, yearly: 0 }; const baseDaily = p * DAILY_RATE_DEC; const bonusDaily = stakedDays >= FIRST_30_DAYS ? p * BONUS_DAILY_DEC : 0; const daily = baseDaily + bonusDaily; return { hourly: daily / 24, daily, monthly: daily * 30, yearly: (p * DAILY_RATE_DEC * FIRST_30_DAYS) + (p * (DAILY_RATE_DEC + BONUS_DAILY_DEC) * REMAINING_DAYS) }; }, [stakedBalance, stakedDays]);
  const badgeTier = useMemo(() => getBadgeTierFromStake(stakedBalance), [stakedBalance]);
  const ensureClient = () => { if (!walletClient) throw new Error('Wallet not connected'); return walletClient; };

  // =============================================
  // UPDATED: doApprove (no changes needed)
  // =============================================
  async function doApprove(amountHuman) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      setLoading(true);
      const tx = await writeContractSafe(ensureClient(), { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'approve', args: [STAKING_ADDRESS, toRaw(amountHuman)] });
      setTxHash(tx?.hash ?? null);
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) {
      showAlert('Approve failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // =============================================
  // UPDATED: doStake WITH SUPABASE RECORDING
  // =============================================
  async function doStake(humanAmount) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount'); return; }
      setLoading(true);
      
      const tx = await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [toRaw(humanAmount)] });
      const txHashResult = tx?.hash ?? null;
      setTxHash(txHashResult);
      
      // =============================================
      // SUPABASE: RECORD STAKING EVENT
      // =============================================
      if (txHashResult && address) {
        const amountNum = Number(humanAmount);
        
        // Record the staking event (this also calculates commissions automatically)
        await recordStakingEvent(address, 'stake', amountNum, txHashResult);
        
        // Update user's total stake in database
        const newTotal = Number(stakedBalance) + amountNum;
        await updateUserStake(address, newTotal);
        
        // Refresh staking history
        const history = await getStakingHistory(address, 20);
        setStakingHistory(history);
        
        console.log(`✅ Stake recorded to Supabase: ${humanAmount} AfroX, TX: ${txHashResult}`);
      }
      
      showAlert('Stake confirmed');
      setStakeAmount('');
      await fetchOnChain();
    } catch (err) {
      showAlert('Stake failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // =============================================
  // UPDATED: doUnstake WITH SUPABASE RECORDING
  // =============================================
  async function doUnstake(humanAmount) {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount'); return; }
      setLoading(true);
      
      const tx = await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [toRaw(humanAmount)] });
      const txHashResult = tx?.hash ?? null;
      setTxHash(txHashResult);
      
      // =============================================
      // SUPABASE: RECORD UNSTAKING EVENT
      // =============================================
      if (txHashResult && address) {
        const amountNum = Number(humanAmount);
        
        // Record the unstaking event
        await recordStakingEvent(address, 'unstake', amountNum, txHashResult);
        
        // Update user's total stake in database
        const newTotal = Math.max(0, Number(stakedBalance) - amountNum);
        await updateUserStake(address, newTotal);
        
        // Refresh staking history
        const history = await getStakingHistory(address, 20);
        setStakingHistory(history);
        
        console.log(`✅ Unstake recorded to Supabase: ${humanAmount} AfroX, TX: ${txHashResult}`);
      }
      
      showAlert('Unstake confirmed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  // =============================================
  // UPDATED: doClaim WITH SUPABASE RECORDING
  // =============================================
  async function doClaim() {
    try {
      if (!isConnected) { showAlert('Connect wallet'); return; }
      setLoading(true);
      const tiny = parseUnits('0.0001', decimals);
      
      const tx1 = await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [tiny] });
      await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [tiny] });
      
      // =============================================
      // SUPABASE: RECORD CLAIM EVENT
      // =============================================
      if (tx1?.hash && address) {
        const rewardsNum = Number(rewardsAccum);
        
        // Record the claim event
        await recordStakingEvent(address, 'claim', rewardsNum, tx1.hash);
        
        // Refresh staking history
        const history = await getStakingHistory(address, 20);
        setStakingHistory(history);
        
        console.log(`✅ Claim recorded to Supabase: ${rewardsNum} AfroX, TX: ${tx1.hash}`);
      }
      
      showAlert('Claim executed');
      await fetchOnChain();
    } catch (err) {
      showAlert('Claim failed: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  // =============================================
  // YOUR EXISTING RETURN/JSX - NO CHANGES NEEDED
  // =============================================
  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      {/* Header with two different logos */}
      <header className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-center gap-8">
          <img src={LOGO_LEFT} alt="AFRODEX" className="h-24 w-24 rounded-full" />
          <div className="text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-orange-400">AfroX DeFi Hub</h1>
            <p className="text-lg text-gray-400 mt-2">Stake, Mint, Mine, Swap, Earn & Govern</p>
          </div>
          <img src={LOGO_RIGHT} alt="AFRODEX" className="h-24 w-24 rounded-full" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-4">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap justify-center">
          <button onClick={() => handleTabChange('staking')} className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${activeTab === 'staking' ? 'bg-orange-500 text-black' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'}`}>AfroX Staking Dashboard</button>
          <button onClick={() => handleTabChange('lp-mining')} className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${activeTab === 'lp-mining' ? 'bg-orange-500 text-black' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'}`}>LP Token Lock-Mining Dashboard</button>
          <button onClick={() => setShowAfroSwap(true)} className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-orange-500 to-yellow-500 text-black hover:from-orange-600 hover:to-yellow-600 text-sm">AfroSwap</button>
          <button onClick={() => handleTabChange('ambassador')} className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${activeTab === 'ambassador' ? 'bg-orange-500 text-black' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'}`}>Ambassador Dashboard</button>
          <button onClick={() => handleTabChange('governance')} className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${activeTab === 'governance' ? 'bg-orange-500 text-black' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'}`}>Community of Trust Dashboard</button>
        </div>

        {activeTab === 'staking' && (
          <>
            <div className="mb-6"><h2 className="text-xl font-bold text-gray-300">AfroX Staking Dashboard</h2><p className="text-sm text-gray-500">Stake AfroX and earn rewards</p></div>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={cardGlow}><div className="text-sm text-gray-300">Wallet Balance</div><div className="text-2xl font-bold flex items-center gap-2 mt-2"><img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" /><span>{prettyNumber(walletBalance, 2)} AfroX</span></div>{afroxPrice && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(walletBalance, afroxPrice))}</div>}<div className="text-xs text-gray-400 mt-2">Available in your wallet</div></motion.div>
              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={cardGlow}><div className="text-sm text-gray-300">Staked Balance</div><div className="text-2xl font-bold flex items-center gap-2 mt-2"><img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" /><span>{prettyNumber(stakedBalance, 2)} AfroX</span></div>{afroxPrice && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(stakedBalance, afroxPrice))}</div>}<div className="text-xs text-gray-400 mt-2">Days staked: {stakedDays}</div></motion.div>
              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={cardGlow}><div className="text-sm text-gray-300">Accumulated Rewards</div><div className="text-2xl font-bold flex items-center gap-2 mt-2"><img src={TOKEN_LOGO} alt="AfroX" className="h-6 w-6 rounded-full" /><span className="text-green-300">{prettyNumber(rewardsAccum, 2)} AfroX</span></div>{afroxPrice && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(rewardsAccum, afroxPrice))}</div>}<div className="text-xs text-gray-400 mt-2">Auto-claimed on unstake</div></motion.div>
              <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={cardGlow}><div className="text-sm text-gray-300">Badge Tier</div><div className="text-2xl font-semibold text-orange-300 flex items-center gap-2 mt-1"><span className="text-3xl">{badgeTier.emoji}</span><span>{badgeTier.name}</span></div><div className="text-xs text-gray-400 mt-2">{badgeTier.threshold}</div></motion.div>
            </section>
            
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Approve & Stake */}
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

              {/* Unstake & Claim */}
              <motion.div className="bg-gray-900 p-6 rounded-3xl" whileHover={{ scale: 1.01 }}>
                <h2 className="text-xl font-bold mb-3">Unstake & Claim</h2>
                <div className="text-sm text-gray-400 mb-4">Unstake tokens (this also auto-claims rewards).</div>
                <div className="flex gap-2 mb-3">
                  <input type="number" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} placeholder="0.0" className="flex-1 p-3 rounded bg-gray-800 text-white" />
                  <button onClick={() => setUnstakeAmount(stakedBalance)} className="px-3 rounded bg-gray-800 text-sm">MAX</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => doUnstake(unstakeAmount)} disabled={loading} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50">Unstake</button>
                  <button onClick={doClaim} disabled={loading} className="py-3 rounded-xl bg-orange-500 text-black font-semibold">Claim Rewards</button>
                </div>
                {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-orange-200 break-all">{txHash}</span></div>}
                
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg text-xs text-yellow-200">
                  <strong>Note:</strong> Your proxy auto-claims rewards on stake/unstake. To manually trigger claim without separate claim function, stake/unstake a tiny amount (e.g. 0.0001 AfroX).
                </div>
              </motion.div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Reward Projections */}
              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10" whileHover={cardGlow}>
                <h2 className="text-xl font-bold mb-4">Reward Projections</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[{ label: 'Hourly', value: projections.hourly }, { label: 'Daily', value: projections.daily }, { label: 'Monthly', value: projections.monthly }, { label: 'Yearly', value: projections.yearly }].map(({ label, value }) => (
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
                
                <div className="mt-3 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg text-xs text-blue-200">
                  <strong>Note:</strong> Reward projections are basically estimates all chain conditions being normal, realtime rewards will show on the top dashboard inside Accumulated Rewards and that is what will be distributed to your wallet.
                </div>
              </motion.div>

              <TokenAnalyticsChart currentSupply={totalSupply} rewardsMinted={totalStakeRewardMinted} maxSupply={maximumSupply} />
            </section>

            <SharedFooter />
          </>
        )}

        {activeTab === 'lp-mining' && <><LPMiningDashboard afroxPrice={afroxPrice} /><SharedFooter /></>}
        {activeTab === 'ambassador' && <><AmbassadorDashboard stakedBalance={stakedBalance} badgeTier={badgeTier} afroxPrice={afroxPrice} /><SharedFooter /></>}
        {activeTab === 'governance' && <><GovernanceDashboard stakedBalance={stakedBalance} badgeTier={badgeTier} afroxPrice={afroxPrice} /><SharedFooter /></>}
      </main>

      {alertMsg && <div className="fixed right-4 bottom-4 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg z-50">{alertMsg}</div>}
      {showAfroSwap && <AfroSwap afroxPrice={afroxPrice} onClose={() => setShowAfroSwap(false)} onNavigateToLPMining={() => { setShowAfroSwap(false); handleTabChange('lp-mining'); }} />}
    </div>
  );
}
