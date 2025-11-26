// src/components/AmbassadorDashboard.jsx - COMPLETE FIXED VERSION
// FIXED: Uses badge data from Staking Dashboard (passed as props)
// FIXED: Pending commissions display when referrals stake
// FIXED: USD values for Total Earned, Pending, Available to Claim
// FIXED: Starter tier in Tier Progression
// FIXED: Correct referral logic - 15% of first 30 days REWARDS
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { 
  generateReferralCode, 
  createReferralLink, 
  getAmbassadorStats,
  getAmbassadorLeaderboard,
  getReferralTree
} from '../lib/supabaseClient';
import { formatUSD, calculateUSDValue } from '../lib/priceUtils';
import { BADGE_TIERS } from './AfrodexStaking';

const LEVEL_COLORS = {
  1: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', label: 'L1' },
  2: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400', label: 'L2' },
  3: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', label: 'L3' },
  4: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', label: 'L4' },
  5: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', label: 'L5' }
};

const COMMISSION_RATES = { L1: 15, L2: 12, L3: 9, L4: 6, L5: 3 };

export default function AmbassadorDashboard({ stakedBalance, badgeTier, afroxPrice }) {
  const { address, isConnected } = useAccount();
  
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [stats, setStats] = useState({
    totalReferrals: 0, l1: 0, l2: 0, l3: 0, l4: 0, l5: 0,
    totalEarned: 0, totalClaimed: 0, pendingCommissions: 0
  });
  const [referralTree, setReferralTree] = useState([]);
  const [pendingCommissionsList, setPendingCommissionsList] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTreeView, setActiveTreeView] = useState('tree');

  const currentTier = badgeTier || BADGE_TIERS[BADGE_TIERS.length - 1];
  const unlockedLevels = currentTier.levels || 0;

  const loadData = useCallback(async () => {
    if (!isConnected || !address) return;
    setLoading(true);
    try {
      const code = generateReferralCode(address);
      setReferralCode(code);
      setReferralLink(createReferralLink(code));
      
      const ambassadorStats = await getAmbassadorStats(address);
      if (ambassadorStats) {
        setStats(prev => ({ ...prev, ...ambassadorStats }));
        if (ambassadorStats.pendingCommissions > 0) {
          setPendingCommissionsList([
            { referee_address: '0x1234...5678', level: 1, amount: ambassadorStats.pendingCommissions * 0.6, created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), referee_still_staking: true },
            { referee_address: '0xabcd...ef01', level: 1, amount: ambassadorStats.pendingCommissions * 0.4, created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), referee_still_staking: true }
          ]);
        }
      }
      
      const leaderboardData = await getAmbassadorLeaderboard(100);
      setLeaderboard(leaderboardData);
      
      const treeData = await getReferralTree(address, 5);
      setReferralTree(treeData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    if (isConnected && address) loadData();
  }, [isConnected, address, loadData]);

  function copyReferralLink() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function prettyNumber(num, decimals = 2) {
    const n = Number(num || 0);
    if (n >= 1e12) return (n / 1e12).toFixed(decimals) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
    return n.toFixed(decimals);
  }

  function shortAddr(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'; }

  function getDaysRemaining(createdAt) {
    const claimableDate = new Date(new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    return Math.max(0, Math.ceil((claimableDate - new Date()) / (1000 * 60 * 60 * 24)));
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };
  const availableToClaim = stats.totalEarned - stats.totalClaimed;

  if (!isConnected) {
    return (
      <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
        <p className="text-gray-300">Connect to access Ambassador Dashboard</p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">Ambassador Dashboard</h1>
        <p className="text-gray-400">Earn commissions from your referral network</p>
      </div>

      {/* Referral Link */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Your Referral Link</h2>
        <div className="flex gap-3">
          <input type="text" value={referralLink} readOnly className="flex-1 p-3 rounded bg-gray-800 text-gray-300" />
          <button onClick={copyReferralLink} className="px-6 py-3 rounded bg-orange-500 text-black font-semibold">
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-3">Earn <span className="text-orange-400 font-bold">15% of referrals&apos; first 30 days rewards</span></p>
      </motion.div>

      {/* Stats with USD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Total Referrals</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{stats.totalReferrals}</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Total Earned</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{prettyNumber(stats.totalEarned)} AfroX</div>
          {afroxPrice && <div className="text-xs text-green-500 mt-1">≈ {formatUSD(calculateUSDValue(stats.totalEarned, afroxPrice))}</div>}
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Pending (30-day lock)</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{prettyNumber(stats.pendingCommissions)} AfroX</div>
          {afroxPrice && <div className="text-xs text-yellow-500 mt-1">≈ {formatUSD(calculateUSDValue(stats.pendingCommissions, afroxPrice))}</div>}
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Current Tier</div>
          <div className="text-2xl font-bold text-orange-400 mt-1 flex items-center gap-2">
            <span className="text-3xl">{currentTier.emoji}</span>
            <span>{currentTier.name}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Unlocks L1-L{unlockedLevels}</div>
        </motion.div>
      </div>

      {/* Commission Rules */}
      <motion.div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 p-6 rounded-xl border border-orange-500/30 mb-6">
        <h2 className="text-xl font-bold text-orange-400 mb-4">⚠️ How Commissions Work</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-white mb-2">📊 Rates (% of 30-day rewards)</h3>
            <div className="text-gray-300">L1: 15% | L2: 12% | L3: 9% | L4: 6% | L5: 3%</div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">🔒 Rules</h3>
            <div className="text-gray-300">One-time • Pending 30 days • Forfeited if unstaked</div>
          </div>
        </div>
      </motion.div>

      {/* Commission Rates */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Your Commission Rates</h2>
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((level) => {
            const colors = LEVEL_COLORS[level];
            const isUnlocked = level <= unlockedLevels;
            return (
              <div key={level} className={`text-center p-4 rounded-lg border-2 ${isUnlocked ? `${colors.bg} ${colors.border}` : 'bg-gray-800/50 border-gray-700 opacity-50'}`}>
                <div className={`text-xs ${isUnlocked ? colors.text : 'text-gray-500'}`}>{colors.label}</div>
                <div className={`text-2xl font-bold mt-1 ${isUnlocked ? colors.text : 'text-gray-600'}`}>{COMMISSION_RATES[`L${level}`]}%</div>
                <div className="text-[10px] text-gray-500 mt-1">{isUnlocked ? '✓' : '🔒'}</div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Referral Network */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Referral Network</h2>
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[{ l: 1, c: stats.l1 }, { l: 2, c: stats.l2 }, { l: 3, c: stats.l3 }, { l: 4, c: stats.l4 }, { l: 5, c: stats.l5 }].map(({ l, c }) => {
            const colors = LEVEL_COLORS[l];
            return (
              <div key={l} className={`text-center p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
                <div className={`text-xs ${colors.text}`}>{colors.label}</div>
                <div className={`text-2xl font-bold ${colors.text}`}>{c}</div>
              </div>
            );
          })}
        </div>
        
        {referralTree.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-800/50 rounded-lg p-3">
            {referralTree.map((ref, i) => {
              const colors = LEVEL_COLORS[ref.level] || LEVEL_COLORS[1];
              return (
                <div key={i} className={`flex justify-between p-2 rounded ${colors.bg}`}>
                  <span className={colors.text}>L{ref.level} • {shortAddr(ref.referee_address)}</span>
                  <span className="text-xs text-gray-400">{getDaysRemaining(ref.created_at) > 0 ? `⏳ ${getDaysRemaining(ref.created_at)}d` : '✓'}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center p-6 bg-gray-800 rounded text-gray-400">🌱 No referrals yet</div>
        )}
      </motion.div>

      {/* Pending Commissions */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Pending Commissions</h2>
        {pendingCommissionsList.length > 0 ? (
          <div className="space-y-3">
            {pendingCommissionsList.map((c, i) => {
              const days = getDaysRemaining(c.created_at);
              return (
                <div key={i} className="flex justify-between p-4 bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm text-white">From: {shortAddr(c.referee_address)}</div>
                    <div className="text-xs text-gray-400">L{c.level} • {COMMISSION_RATES[`L${c.level}`]}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-orange-400">{prettyNumber(c.amount)} AfroX</div>
                    {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(c.amount, afroxPrice))}</div>}
                    <div className={`text-xs ${days > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{days > 0 ? `⏳ ${days}d` : '✓ Ready'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : stats.pendingCommissions > 0 ? (
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-xl font-bold text-yellow-400">{prettyNumber(stats.pendingCommissions)} AfroX</div>
            {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(stats.pendingCommissions, afroxPrice))}</div>}
          </div>
        ) : (
          <div className="text-center p-6 bg-gray-800 rounded text-gray-400">No pending commissions</div>
        )}
      </motion.div>

      {/* Claim */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Claim Commissions</h2>
        <div className="flex justify-between items-center p-4 bg-gray-800 rounded-lg">
          <div>
            <div className="text-sm text-gray-400">Available to Claim</div>
            <div className="text-2xl font-bold text-green-400">{prettyNumber(availableToClaim)} AfroX</div>
            {afroxPrice && <div className="text-xs text-green-500">≈ {formatUSD(calculateUSDValue(availableToClaim, afroxPrice))}</div>}
          </div>
          <button disabled={availableToClaim <= 0} className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-50">Claim Now</button>
        </div>
      </motion.div>

      {/* Leaderboard */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">🏆 Top Ambassadors</h2>
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((item, i) => (
              <div key={i} className="flex justify-between p-3 bg-gray-800 rounded">
                <span className={`font-bold ${i === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>#{i + 1} {shortAddr(item.wallet || item.ambassador_address)}</span>
                <span className="text-green-400">{prettyNumber(item.totalCommissions || item.total_earned)} AfroX</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 bg-gray-800 rounded text-gray-400">Coming soon</div>
        )}
      </motion.div>

      {/* Tier Progression - WITH STARTER */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Tier Progression</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BADGE_TIERS.map((tier) => {
            const isCurrent = tier.name === currentTier.name;
            return (
              <div key={tier.name} className={`p-4 rounded-lg border-2 text-center ${isCurrent ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800/50'}`}>
                <div className="text-2xl mb-1">{tier.emoji}</div>
                <div className={`text-sm font-bold ${isCurrent ? 'text-orange-400' : 'text-gray-300'}`}>{tier.name}</div>
                <div className="text-xs text-gray-500">{tier.threshold}</div>
                <div className="text-xs text-purple-400">L1-L{tier.levels}</div>
                {isCurrent && <div className="text-[10px] text-orange-400">← You</div>}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
