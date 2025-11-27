// src/components/AfrodexStaking.jsx - COMPLETE UPDATED VERSION
// FIXED: New header with two different logos on the left and the right
// FIXED: Added notes on Unstake & Reward Projections
// FIXED: Footer with social links
// FIXED: URL routing using query params for Next.js compatibility
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

// Dynamic referral link - uses current domain (works for both dashboard.afrox.one and hub.afrox.one)
export function createDynamicReferralLink(referralCode) {
  if (typeof window === 'undefined') return `https://hub.afrox.one/?ref=${referralCode}`;
  return `${window.location.origin}/?ref=${referralCode}`;
}

// Social Links for Footer
const SOCIAL_LINKS = [
  { name: 'Facebook', url: 'https://fb.me/AfroDex1', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  )},
  { name: 'LinkedIn', url: 'https://www.linkedin.com/company/afrodexlabs', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  )},
  { name: 'Telegram', url: 'https://t.me/AfroDex', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
  )},
  { name: 'Medium', url: 'https://medium.com/@AfroDex1', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/></svg>
  )},
  { name: 'GitHub', url: 'https://github.com/AfroDex', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
  )},
  { name: 'Discord', url: 'https://discord.gg/5EwRguT', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
  )},
  { name: 'CoinMarketCap', url: 'https://coinmarketcap.com/currencies/afrodex/', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 17.08c-.292.426-.782.649-1.412.649-.164 0-.339-.02-.524-.06-1.193-.258-1.85-1.197-2.357-1.924l-.074-.106c-.325-.465-.605-.866-1.527-.866-.922 0-1.202.401-1.527.866l-.074.106c-.507.727-1.164 1.666-2.357 1.924a2.39 2.39 0 01-.524.06c-.63 0-1.12-.223-1.412-.649-.56-.817-.28-1.992.756-3.159.674-.759 1.638-1.478 2.785-2.078 1.22-.638 2.347-.96 2.353-.962a.75.75 0 01.404 1.444c-.025.007-2.534.736-4.054 2.237-.582.576-.682 1.012-.634 1.082.044.064.181.098.367.058.567-.122.954-.599 1.387-1.22l.074-.107c.507-.727 1.164-1.666 2.456-1.666s1.949.939 2.456 1.666l.074.107c.433.621.82 1.098 1.387 1.22.186.04.323.006.367-.058.048-.07-.052-.506-.634-1.082-1.52-1.501-4.029-2.23-4.054-2.237a.75.75 0 01.404-1.444c.006.002 1.133.324 2.353.962 1.147.6 2.111 1.319 2.785 2.078 1.036 1.167 1.316 2.342.756 3.159z"/></svg>
  )}
];

export function SharedFooter() {
  return (
    <footer className="border-t border-gray-800 py-6 mt-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* Social Links */}
        <div className="flex justify-center gap-4 mb-6">
          {SOCIAL_LINKS.map((social) => (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-orange-400 transition-colors"
              title={social.name}
            >
              {social.icon}
            </a>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="p-4 bg-[#0b0b0b] rounded border border-gray-800 text-sm text-gray-300 mb-4">
          ⚠️ <strong>Important Disclaimer:</strong> By using this platform you confirm you are of legal age, live in a jurisdiction where the specific crypto related activity you want to perform is permitted, and accept all liability and risk.
        </div>

        {/* Copyright */}
        <div className="text-center text-sm text-gray-400">
          © 2019-Present AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
        </div>
      </div>
    </footer>
  );
}

function TokenAnalyticsChart({ currentSupply, rewardsMinted, maxSupply }) {
  const current = Number(currentSupply || 0), minted = Number(rewardsMinted || 0), max = Number(maxSupply || 0);
  const currentPct = max > 0 ? (current / max) * 100 : 0, mintedPct = max > 0 ? (minted / max) * 100 : 0;
  const radius = 80, circumference = 2 * Math.PI * radius;
  function prettyNum(num, p = 2) { const n = Number(num || 0); if (n >= 1e15) return (n / 1e15).toFixed(p) + 'Q'; if (n >= 1e12) return (n / 1e12).toFixed(p) + 'T'; if (n >= 1e9) return (n / 1e9).toFixed(p) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(p) + 'M'; return n.toFixed(p); }
  return (
    <motion.div className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.12)' }}>
      <h2 className="text-xl font-bold text-center mb-4">Token Analytics</h2>
      <div className="flex justify-center mb-6"><div className="relative"><svg width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r={radius} fill="none" stroke="#374151" strokeWidth="24" /><circle cx="100" cy="100" r={radius} fill="none" stroke="#f97316" strokeWidth="24" strokeDasharray={`${((100 - currentPct - mintedPct) / 100) * circumference} ${circumference}`} strokeDashoffset={-(((currentPct + mintedPct) / 100) * circumference)} transform="rotate(-90 100 100)" /><circle cx="100" cy="100" r={radius} fill="none" stroke="#22c55e" strokeWidth="24" strokeDasharray={`${(mintedPct / 100) * circumference} ${circumference}`} strokeDashoffset={-((currentPct / 100) * circumference)} transform="rotate(-90 100 100)" /><circle cx="100" cy="100" r={radius} fill="none" stroke="#3b82f6" strokeWidth="24" strokeDasharray={`${(currentPct / 100) * circumference} ${circumference}`} strokeDashoffset={0} transform="rotate(-90 100 100)" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-xs text-gray-400">Max Supply</div><div className="text-xl font-bold text-white">{prettyNum(max)}</div></div></div></div>
      <div className="space-y-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-sm text-gray-400">Current Supply:</span></div><span className="text-sm font-semibold text-white">{prettyNum(current)}</span></div><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-sm text-gray-400">Rewards Minted:</span></div><span className="text-sm font-semibold text-green-400">{prettyNum(minted)}</span></div><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div><span className="text-sm text-gray-400">Un-minted:</span></div><span className="text-sm font-semibold text-orange-400">{prettyNum(Math.max(0, max - current - minted))}</span></div></div>
    </motion.div>
  );
}

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const searchParams = useSearchParams();

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

  // Set page title
  useEffect(() => {
    document.title = 'AfroX DeFi Hub | Stake, Mint, Mine, Swap, Earn & Govern';
  }, []);

  // URL routing using query params (?tab=lp-mining) for Next.js compatibility
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['staking', 'lp-mining', 'ambassador', 'governance'].includes(tabParam)) {
      setActiveTab(tabParam);
    } else {
      setActiveTab('staking');
    }
  }, [searchParams]);

  // Update URL when tab changes (using query params)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const newUrl = tab === 'staking' ? '/' : `/?tab=${tab}`;
    window.history.pushState({}, '', newUrl);
  };

  const showAlert = (m, t = 6000) => { setAlertMsg(String(m)); setTimeout(() => setAlertMsg(null), t); };
  const toHuman = useCallback((raw) => { try { return raw ? formatUnits(raw, decimals) : '0'; } catch { return '0'; } }, [decimals]);
  const toRaw = useCallback((human) => { try { return parseUnits(String(human || '0'), decimals); } catch { return 0n; } }, [decimals]);
  function prettyNumber(humanStr, precision = 2) { const n = Number(humanStr || '0'); if (!Number.isFinite(n)) return '0'; if (Math.abs(n) >= 1e15) return (n / 1e15).toFixed(precision) + 'Q'; if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(precision) + 'T'; if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(precision) + 'B'; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(precision) + 'M'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(precision) + 'K'; return n.toLocaleString(undefined, { maximumFractionDigits: precision }); }

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

  const stakedDays = useMemo(() => { const ref = lastUnstakeTs > 0 ? lastUnstakeTs : lastRewardTs; if (!ref || ref <= 0) return 0; return Math.floor((Date.now() / 1000 - ref) / 86400); }, [lastUnstakeTs, lastRewardTs]);
  const projections = useMemo(() => { const p = Number(stakedBalance || '0'); if (!p || p <= 0) return { hourly: 0, daily: 0, monthly: 0, yearly: 0 }; const baseDaily = p * DAILY_RATE_DEC; const bonusDaily = stakedDays >= FIRST_30_DAYS ? p * BONUS_DAILY_DEC : 0; const daily = baseDaily + bonusDaily; return { hourly: daily / 24, daily, monthly: daily * 30, yearly: (p * DAILY_RATE_DEC * FIRST_30_DAYS) + (p * (DAILY_RATE_DEC + BONUS_DAILY_DEC) * REMAINING_DAYS) }; }, [stakedBalance, stakedDays]);
  const badgeTier = useMemo(() => getBadgeTierFromStake(stakedBalance), [stakedBalance]);
  const ensureClient = () => { if (!walletClient) throw new Error('Wallet not connected'); return walletClient; };

  async function doApprove(amountHuman) { try { if (!isConnected) { showAlert('Connect wallet'); return; } setLoading(true); const tx = await writeContractSafe(ensureClient(), { address: TOKEN_ADDRESS, abi: AFROX_PROXY_ABI, functionName: 'approve', args: [STAKING_ADDRESS, toRaw(amountHuman)] }); setTxHash(tx?.hash ?? null); await fetchOnChain(); showAlert('Approve confirmed'); } catch (err) { showAlert('Approve failed: ' + (err?.message ?? err)); } finally { setLoading(false); } }
  async function doStake(humanAmount) { try { if (!isConnected) { showAlert('Connect wallet'); return; } if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount'); return; } setLoading(true); const tx = await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [toRaw(humanAmount)] }); setTxHash(tx?.hash ?? null); showAlert('Stake confirmed'); setStakeAmount(''); await fetchOnChain(); } catch (err) { showAlert('Stake failed: ' + (err?.message ?? err)); } finally { setLoading(false); } }
  async function doUnstake(humanAmount) { try { if (!isConnected) { showAlert('Connect wallet'); return; } if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount'); return; } setLoading(true); const tx = await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [toRaw(humanAmount)] }); setTxHash(tx?.hash ?? null); showAlert('Unstake confirmed'); setUnstakeAmount(''); await fetchOnChain(); } catch (err) { showAlert('Unstake failed: ' + (err?.message ?? err)); } finally { setLoading(false); } }
  async function doClaim() { try { if (!isConnected) { showAlert('Connect wallet'); return; } setLoading(true); const tiny = parseUnits('0.0001', decimals); await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [tiny] }); await writeContractSafe(ensureClient(), { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [tiny] }); showAlert('Claim executed'); await fetchOnChain(); } catch (err) { showAlert('Claim failed: ' + (err?.message ?? err)); } finally { setLoading(false); } }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      {/* Header with two different logos */}
      <header className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-center gap-6">
          <img src={LOGO_LEFT} alt="AFRODEX" className="h-16 w-16 rounded-full" />
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-orange-400">AfroX DeFi Hub</h1>
            <p className="text-sm text-gray-400 mt-1">Stake, Mint, Mine, Swap, Earn & Govern</p>
          </div>
          <img src={LOGO_RIGHT} alt="AFRODEX" className="h-16 w-16 rounded-full" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-4">
        {/* Navigation Tabs - No icons, fits one row on desktop */}
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
                
                {/* Note about proxy auto-claim */}
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
                
                {/* Note about projections */}
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
