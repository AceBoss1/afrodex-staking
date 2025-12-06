// src/components/AfrodexStaking.jsx - COMPLETE WITH SUPABASE INTEGRATION
// PART 1 of 2 - Combine with Part 2
//
// ⚠️ SECURITY NOTE (CVE-2025-66478): 
// If using Next.js 15.x/16.x with App Router, update to patched version (15.1.9+)
//
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
// SUPABASE IMPORTS
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

// =============================================
// SOCIAL LINKS
// =============================================
const SOCIAL_LINKS = [
  { name: 'Facebook', url: 'https://fb.me/AfroDex1', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>) },
  { name: 'Telegram', url: 'https://t.me/AfroDex', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>) },
  { name: 'X (Twitter)', url: 'https://x.com/AfroDex1', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>) },
  { name: 'YouTube', url: 'https://youtube.com/@AfroDex', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>) },
  { name: 'Instagram', url: 'https://instagram.com/AfroDex_net', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>) },
  { name: 'LinkedIn', url: 'https://linkedin.com/company/afrodex', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>) },
  { name: 'TikTok', url: 'https://tiktok.com/@afrodex', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>) },
  { name: 'Discord', url: 'https://discord.gg/afrodex', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>) },
  { name: 'GitHub', url: 'https://github.com/AfroDex-Net', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>) },
  { name: 'CoinMarketCap', url: 'https://coinmarketcap.com/currencies/afrodex', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.738 14.341c-.419.265-.912.298-1.286.087-.476-.27-.752-.86-.752-1.609V9.433c0-1.073-.473-1.966-1.264-2.382-.627-.33-1.419-.302-2.169.076l-2.994 1.505V7.06c0-1.094-.55-1.937-1.476-2.262-.753-.264-1.643-.055-2.382.557L3.256 9.12c-.74-.592-1.628-.8-2.382-.538C.048 8.906-.5 9.748-.5 10.843V17.9a2.424 2.424 0 001.232 2.119c.388.22.815.334 1.25.334.343 0 .69-.07 1.018-.213l7.86-3.358v.907c0 1.117.554 1.987 1.482 2.325.143.052.292.09.444.117a2.08 2.08 0 001.17-.162l6.48-2.994c.964-.476 1.564-1.476 1.564-2.607v-1.736c0-.742-.277-1.34-.762-1.627zM5.7 17.09l-3.2 1.367V11.06l3.2-2.563v8.593zm8.058-.416l-5.558 2.375V9.693l5.558-2.79v9.771zm7.742-2.756l-5.242 2.422v-8.84l2.79-1.403c.053-.029.103-.046.147-.046a.17.17 0 01.085.023c.076.04.22.188.22.485v7.359z"/></svg>) },
  { name: 'CoinGecko', url: 'https://www.coingecko.com/en/coins/afrodex', icon: (<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>) },
];

// =============================================
// SHARED FOOTER COMPONENT
// =============================================
export function SharedFooter() {
  return (
    <footer className="border-t border-gray-800 py-6 mt-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Disclaimer */}
        <div className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-700/50">
          <p className="text-gray-400 text-sm text-center">
            <span className="text-yellow-500">⚠️ Disclaimer:</span> By using this platform you confirm you are of legal age, 
            live in a jurisdiction where staking crypto is permitted, and accept all liability and risk.
          </p>
        </div>
        
        {/* Social Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {SOCIAL_LINKS.map((social) => (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-orange-500 transition-colors duration-200"
              title={social.name}
            >
              {social.icon}
            </a>
          ))}
        </div>
        
        {/* Copyright & Donations */}
        <div className="text-center text-gray-500 text-sm">
          <p>© 2019-2025 AFRODEX. All rights reserved.</p>
          <p className="mt-2 flex items-center justify-center gap-2">
            <span className="text-red-500">❤️</span>
            <span>Donations:</span>
            <code className="text-xs bg-gray-800 px-2 py-1 rounded">
              0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
            </code>
          </p>
        </div>
      </div>
    </footer>
  );
}

// =============================================
// TOKEN ANALYTICS CHART COMPONENT
// =============================================
function TokenAnalyticsChart({ currentSupply, rewardsMinted, maxSupply }) {
  const current = Number(currentSupply || 0);
  const minted = Number(rewardsMinted || 0);
  const max = Number(maxSupply || 0);
  const unminted = max - current - minted;
  
  const currentPct = max > 0 ? (current / max) * 100 : 0;
  const mintedPct = max > 0 ? (minted / max) * 100 : 0;
  const unmintedPct = max > 0 ? (unminted / max) * 100 : 0;
  
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  
  function prettyNum(num, p = 2) {
    const n = Number(num || 0);
    if (n >= 1e15) return (n / 1e15).toFixed(p) + 'Q';
    if (n >= 1e12) return (n / 1e12).toFixed(p) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(p) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(p) + 'M';
    return n.toFixed(p);
  }
  
  // Calculate stroke dasharray for each segment
  const currentDash = (currentPct / 100) * circumference;
  const mintedDash = (mintedPct / 100) * circumference;
  const unmintedDash = (unmintedPct / 100) * circumference;
  
  return (
    <motion.div 
      className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10"
      whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.12)' }}
    >
      <h2 className="text-xl font-bold text-center mb-4">Token Analytics</h2>
      
      <div className="flex justify-center mb-6">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth="24"
          />
          
          {/* Unminted (orange) - base layer */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#f97316"
            strokeWidth="24"
            strokeDasharray={`${unmintedDash} ${circumference}`}
            strokeDashoffset={0}
            transform="rotate(-90 100 100)"
            strokeLinecap="round"
          />
          
          {/* Rewards Minted (green) */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#22c55e"
            strokeWidth="24"
            strokeDasharray={`${mintedDash} ${circumference}`}
            strokeDashoffset={-unmintedDash}
            transform="rotate(-90 100 100)"
            strokeLinecap="round"
          />
          
          {/* Current Supply (blue) */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="24"
            strokeDasharray={`${currentDash} ${circumference}`}
            strokeDashoffset={-(unmintedDash + mintedDash)}
            transform="rotate(-90 100 100)"
            strokeLinecap="round"
          />
          
          {/* Center text */}
          <text x="100" y="95" textAnchor="middle" className="fill-gray-400 text-sm">
            Max Supply
          </text>
          <text x="100" y="115" textAnchor="middle" className="fill-white text-xl font-bold">
            {prettyNum(max)}
          </text>
        </svg>
      </div>
      
      {/* Legend */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-400">Current Supply:</span>
          </div>
          <span className="text-white font-medium">{prettyNum(current)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-400">Rewards Minted:</span>
          </div>
          <span className="text-green-400 font-medium">{prettyNum(minted)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-gray-400">Un-minted:</span>
          </div>
          <span className="text-orange-400 font-medium">{prettyNum(unminted)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================
// HELPER FUNCTIONS
// =============================================
function prettyNumber(num, decPlaces = DEFAULT_DECIMALS) {
  const n = Number(num || 0);
  if (n >= 1e15) return (n / 1e15).toFixed(decPlaces) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(decPlaces) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(decPlaces) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(decPlaces) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(decPlaces) + 'K';
  return n.toFixed(decPlaces);
}

function formatBalance(bal, dec = 4, trailingDecimals = DEFAULT_DECIMALS) {
  const str = typeof bal === 'bigint' ? formatUnits(bal, dec) : String(bal);
  const num = parseFloat(str);
  return prettyNumber(num, trailingDecimals);
}

function calculateRewardProjection(stakedBal, rewardsDue, isBonus) {
  const stakedNum = Number(stakedBal || '0');
  const pendingNum = Number(rewardsDue || '0');
  const daily = isBonus ? stakedNum * BONUS_DAILY_DEC : stakedNum * DAILY_RATE_DEC;
  const monthly = daily * 30;
  const yearly = isBonus ? daily * 365 : (stakedNum * DAILY_RATE_DEC * FIRST_30_DAYS) + (stakedNum * BONUS_DAILY_DEC * REMAINING_DAYS);
  return { daily, monthly, yearly, pending: pendingNum };
}

// Export for use in other components
export { prettyNumber, formatBalance, calculateRewardProjection, TokenAnalyticsChart };
// =============================================
// PART 2 of 2 - MAIN AFRODEX STAKING COMPONENT
// Append this after Part 1 in the same file
// =============================================

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const searchParams = useSearchParams();

  // State
  const [activeTab, setActiveTab] = useState('stake');
  const [walletBalance, setWalletBalance] = useState(0n);
  const [stakedBalance, setStakedBalance] = useState(0n);
  const [rewardsDue, setRewardsDue] = useState(0n);
  const [isBonus, setIsBonus] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [txMessage, setTxMessage] = useState('');
  const [afroxPrice, setAfroxPrice] = useState(0);
  
  // Token analytics state
  const [currentSupply, setCurrentSupply] = useState(0n);
  const [rewardsMinted, setRewardsMinted] = useState(0n);
  const [maxSupply, setMaxSupply] = useState(0n);
  
  // Supabase state
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [ambassadorStats, setAmbassadorStats] = useState(null);

  // Get referral code from URL
  const refCode = searchParams?.get('ref') || '';

  // =============================================
  // SUPABASE INITIALIZATION ON WALLET CONNECT
  // =============================================
  useEffect(() => {
    async function initSupabase() {
      if (isConnected && address) {
        try {
          // Initialize user in Supabase (handles referral if present)
          const user = await initializeUserOnConnect(address, refCode || null);
          setSupabaseUser(user);
          
          if (user?.referral_code) {
            setReferralCode(user.referral_code);
          }
          
          // Get ambassador stats
          const stats = await getAmbassadorStats(address);
          setAmbassadorStats(stats);
          
          console.log('✅ Supabase initialized for wallet:', address.slice(0, 10) + '...');
        } catch (error) {
          console.error('Error initializing Supabase:', error);
        }
      }
    }
    initSupabase();
  }, [isConnected, address, refCode]);

  // =============================================
  // FETCH BLOCKCHAIN DATA
  // =============================================
  const fetchData = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      // Fetch wallet balance
      const bal = await readContractSafe(publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'balanceOf',
        args: [address]
      });
      setWalletBalance(bal || 0n);

      // Fetch staked balance
      const staked = await readContractSafe(publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stakedBalanceOf',
        args: [address]
      });
      setStakedBalance(staked || 0n);

      // Fetch rewards due
      const rewards = await readContractSafe(publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'rewardsDue',
        args: [address]
      });
      setRewardsDue(rewards || 0n);

      // Check if bonus period
      const bonus = await readContractSafe(publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'isBonusPeriod',
        args: [address]
      });
      setIsBonus(bonus || false);

      // Token analytics
      const [current, minted, max] = await Promise.all([
        readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_PROXY_ABI,
          functionName: 'totalSupply'
        }),
        readContractSafe(publicClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'totalRewardsMinted'
        }),
        readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_PROXY_ABI,
          functionName: 'maxSupply'
        })
      ]);
      setCurrentSupply(current || 0n);
      setRewardsMinted(minted || 0n);
      setMaxSupply(max || 0n);

      // Get AfroX price
      const price = await getAfroxPriceUSD();
      setAfroxPrice(price);

      // Update Supabase with current stake
      if (staked && staked > 0n) {
        const stakedNum = Number(formatUnits(staked, 4));
        await updateUserStake(address, stakedNum);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [publicClient, address]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  // =============================================
  // STAKING ACTIONS
  // =============================================
  const doStake = async () => {
    if (!walletClient || !stakeAmount || loading) return;
    setLoading(true);
    setTxMessage('Approving tokens...');
    
    try {
      const amount = parseUnits(stakeAmount, 4);
      
      // Approve
      const approveTx = await writeContractSafe(walletClient, publicClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_PROXY_ABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, amount]
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      
      // Stake
      setTxMessage('Staking tokens...');
      const stakeTx = await writeContractSafe(walletClient, publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [amount]
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: stakeTx });
      
      // Record in Supabase
      const stakeNum = Number(stakeAmount);
      await recordStakingEvent(address, 'stake', stakeNum, stakeTx, Number(receipt.blockNumber));
      
      setTxMessage('✅ Stake successful!');
      setStakeAmount('');
      await fetchData();
      
      // Refresh ambassador stats
      const stats = await getAmbassadorStats(address);
      setAmbassadorStats(stats);
      
    } catch (error) {
      console.error('Stake error:', error);
      setTxMessage(`❌ Error: ${error.message?.slice(0, 50) || 'Transaction failed'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setTxMessage(''), 5000);
    }
  };

  const doUnstake = async () => {
    if (!walletClient || !unstakeAmount || loading) return;
    setLoading(true);
    setTxMessage('Unstaking tokens...');
    
    try {
      const amount = parseUnits(unstakeAmount, 4);
      
      const unstakeTx = await writeContractSafe(walletClient, publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [amount]
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: unstakeTx });
      
      // Record in Supabase
      const unstakeNum = Number(unstakeAmount);
      await recordStakingEvent(address, 'unstake', unstakeNum, unstakeTx, Number(receipt.blockNumber));
      
      setTxMessage('✅ Unstake successful!');
      setUnstakeAmount('');
      await fetchData();
      
    } catch (error) {
      console.error('Unstake error:', error);
      setTxMessage(`❌ Error: ${error.message?.slice(0, 50) || 'Transaction failed'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setTxMessage(''), 5000);
    }
  };

  const doClaim = async () => {
    if (!walletClient || rewardsDue === 0n || loading) return;
    setLoading(true);
    setTxMessage('Claiming rewards...');
    
    try {
      const claimTx = await writeContractSafe(walletClient, publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'claimRewards',
        args: []
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
      
      // Record in Supabase
      const claimNum = Number(formatUnits(rewardsDue, 4));
      await recordStakingEvent(address, 'claim', claimNum, claimTx, Number(receipt.blockNumber));
      
      setTxMessage('✅ Rewards claimed!');
      await fetchData();
      
    } catch (error) {
      console.error('Claim error:', error);
      setTxMessage(`❌ Error: ${error.message?.slice(0, 50) || 'Transaction failed'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setTxMessage(''), 5000);
    }
  };

  // =============================================
  // COMPUTED VALUES
  // =============================================
  const badgeTier = useMemo(() => {
    return getBadgeTierFromStake(Number(formatUnits(stakedBalance, 4)));
  }, [stakedBalance]);

  const projections = useMemo(() => {
    const stakedNum = Number(formatUnits(stakedBalance, 4));
    const rewardsNum = Number(formatUnits(rewardsDue, 4));
    return calculateRewardProjection(stakedNum, rewardsNum, isBonus);
  }, [stakedBalance, rewardsDue, isBonus]);

  // =============================================
  // RENDER
  // =============================================
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <img src={TOKEN_LOGO} alt="AfroX" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">AfroX DeFi Hub</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to start staking</p>
          {/* Your ConnectButton goes here */}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 py-4">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_LEFT} alt="AfroX" className="h-10" />
            <span className="text-xl font-bold">AfroX DeFi Hub</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {badgeTier.emoji} {badgeTier.name}
            </span>
            {/* Your ConnectButton/wallet display goes here */}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {['stake', 'ambassador', 'lp-mining', 'governance', 'swap'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'text-orange-500 border-b-2 border-orange-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'stake' && '🥩 Stake'}
                {tab === 'ambassador' && '🏅 Ambassador'}
                {tab === 'lp-mining' && '⛏️ LP Mining'}
                {tab === 'governance' && '🏛️ Governance'}
                {tab === 'swap' && '🔄 Swap'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Transaction Message */}
        {txMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-4 rounded-xl text-center ${
              txMessage.includes('✅') ? 'bg-green-900/50 text-green-400' :
              txMessage.includes('❌') ? 'bg-red-900/50 text-red-400' :
              'bg-blue-900/50 text-blue-400'
            }`}
          >
            {txMessage}
          </motion.div>
        )}

        {/* Stake Tab */}
        {activeTab === 'stake' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column - Staking Interface */}
            <div className="space-y-6">
              {/* Balance Cards */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                  <p className="text-gray-400 text-sm">Wallet Balance</p>
                  <p className="text-xl font-bold">{formatBalance(walletBalance)} AfroX</p>
                  <p className="text-sm text-gray-500">≈ {formatUSD(calculateUSDValue(walletBalance, afroxPrice, 4))}</p>
                </motion.div>
                <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/20">
                  <p className="text-gray-400 text-sm">Staked Balance</p>
                  <p className="text-xl font-bold text-orange-500">{formatBalance(stakedBalance)} AfroX</p>
                  <p className="text-sm text-gray-500">≈ {formatUSD(calculateUSDValue(stakedBalance, afroxPrice, 4))}</p>
                </motion.div>
              </div>

              {/* Stake Input */}
              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
                <h3 className="text-lg font-bold mb-4">Stake AfroX</h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="Amount to stake"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() => setStakeAmount(formatUnits(walletBalance, 4))}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm"
                  >
                    MAX
                  </button>
                </div>
                <button
                  onClick={doStake}
                  disabled={loading || !stakeAmount}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all"
                >
                  {loading ? 'Processing...' : 'Stake'}
                </button>
              </motion.div>

              {/* Unstake Input */}
              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
                <h3 className="text-lg font-bold mb-4">Unstake AfroX</h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="number"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="Amount to unstake"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() => setUnstakeAmount(formatUnits(stakedBalance, 4))}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm"
                  >
                    MAX
                  </button>
                </div>
                <button
                  onClick={doUnstake}
                  disabled={loading || !unstakeAmount}
                  className="w-full py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all"
                >
                  {loading ? 'Processing...' : 'Unstake'}
                </button>
              </motion.div>
            </div>

            {/* Right Column - Rewards & Analytics */}
            <div className="space-y-6">
              {/* Rewards Card */}
              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-green-600/20">
                <h3 className="text-lg font-bold mb-4">Rewards</h3>
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-green-400">{formatBalance(rewardsDue)} AfroX</p>
                  <p className="text-gray-400">≈ {formatUSD(calculateUSDValue(rewardsDue, afroxPrice, 4))}</p>
                  {isBonus && (
                    <span className="inline-block mt-2 px-3 py-1 bg-yellow-900/50 text-yellow-400 rounded-full text-sm">
                      🎁 Bonus Period Active (0.66%/day)
                    </span>
                  )}
                </div>
                <button
                  onClick={doClaim}
                  disabled={loading || rewardsDue === 0n}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all"
                >
                  {loading ? 'Processing...' : 'Claim Rewards'}
                </button>
              </motion.div>

              {/* Projections */}
              <motion.div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
                <h3 className="text-lg font-bold mb-4">Reward Projections</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Daily</span>
                    <span className="font-medium">{prettyNumber(projections.daily)} AfroX</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monthly</span>
                    <span className="font-medium">{prettyNumber(projections.monthly)} AfroX</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Yearly</span>
                    <span className="font-medium text-green-400">{prettyNumber(projections.yearly)} AfroX</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-500">
                    Rate: {isBonus ? '0.66%' : '0.60%'}/day • First 30 days: 0.60% • After: 0.66%
                  </p>
                </div>
              </motion.div>

              {/* Token Analytics */}
              <TokenAnalyticsChart
                currentSupply={Number(formatUnits(currentSupply, 4))}
                rewardsMinted={Number(formatUnits(rewardsMinted, 4))}
                maxSupply={Number(formatUnits(maxSupply, 4))}
              />
            </div>
          </div>
        )}

        {/* Ambassador Tab */}
        {activeTab === 'ambassador' && (
          <AmbassadorDashboard
            address={address}
            stakedBalance={Number(formatUnits(stakedBalance, 4))}
            badgeTier={badgeTier}
            referralCode={referralCode}
            ambassadorStats={ambassadorStats}
            afroxPrice={afroxPrice}
          />
        )}

        {/* LP Mining Tab */}
        {activeTab === 'lp-mining' && (
          <LPMiningDashboard
            address={address}
            afroxPrice={afroxPrice}
          />
        )}

        {/* Governance Tab */}
        {activeTab === 'governance' && (
          <GovernanceDashboard
            address={address}
            stakedBalance={stakedBalance}
            badgeTier={badgeTier}
          />
        )}

        {/* Swap Tab */}
        {activeTab === 'swap' && (
          <AfroSwap />
        )}
      </main>

      {/* Footer */}
      <SharedFooter />
    </div>
  );
}
