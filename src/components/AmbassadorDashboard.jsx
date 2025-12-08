// src/components/AmbassadorDashboard.jsx
// UPDATED: Dynamic referral links based on current domain
// FIXED: Proper Supabase data mapping for stats, referral tree, and leaderboard
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { getAmbassadorStats, getAmbassadorLeaderboard, getReferralTree, getClaimableCommissions } from '../lib/supabaseClient';
import { formatUSD, calculateUSDValue } from '../lib/priceUtils';
import { BADGE_TIERS, createDynamicReferralLink } from './AfrodexStaking';

const LEVEL_COLORS = {
  1: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', label: 'L1 - Direct' },
  2: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400', label: 'L2' },
  3: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', label: 'L3' },
  4: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', label: 'L4' },
  5: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', label: 'L5' }
};

function generateReferralCode(address) {
  if (!address) return '';
  return address.slice(2, 10).toUpperCase();
}

export default function AmbassadorDashboard({ stakedBalance, badgeTier, afroxPrice }) {
  const { address, isConnected } = useAccount();
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [stats, setStats] = useState({ totalReferrals: 0, l1: 0, l2: 0, l3: 0, l4: 0, l5: 0, totalEarned: 0, totalClaimed: 0, pendingCommissions: 0 });
  const [referralTree, setReferralTree] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [claimableAmount, setClaimableAmount] = useState(0);
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
      setReferralLink(createDynamicReferralLink(code));
      
      // =============================================
      // FIX: Fetch ambassador stats and map snake_case to camelCase
      // =============================================
      const ambassadorStats = await getAmbassadorStats(address);
      if (ambassadorStats) {
        setStats({
          totalReferrals: ambassadorStats.total_referrals || 0,
          l1: ambassadorStats.level_1_count || 0,
          l2: ambassadorStats.level_2_count || 0,
          l3: ambassadorStats.level_3_count || 0,
          l4: ambassadorStats.level_4_count || 0,
          l5: ambassadorStats.level_5_count || 0,
          totalEarned: parseFloat(ambassadorStats.total_earned) || 0,
          totalClaimed: parseFloat(ambassadorStats.total_claimed) || 0,
          pendingCommissions: parseFloat(ambassadorStats.pending_commissions) || 0
        });
      }
      
      // =============================================
      // FIX: Fetch leaderboard with proper field mapping
      // =============================================
      const leaderboardData = await getAmbassadorLeaderboard(100);
      if (leaderboardData && leaderboardData.length > 0) {
        setLeaderboard(leaderboardData.map(item => ({
          wallet: item.wallet || item.ambassador_address || item.wallet_address,
          totalCommissions: parseFloat(item.total_earned) || 0,
          totalReferrals: item.total_referrals || item.l1_count || 0
        })));
      } else {
        setLeaderboard([]);
      }
      
      // =============================================
      // FIX: Fetch referral tree with proper field mapping
      // =============================================
      const treeData = await getReferralTree(address, 5);
      if (treeData && treeData.length > 0) {
        setReferralTree(treeData.map(ref => ({
          referee_address: ref.referee_address,
          level: ref.level,
          created_at: ref.created_at,
          is_active: ref.is_active
        })));
      } else {
        setReferralTree([]);
      }

      // =============================================
      // FIX: Fetch claimable commissions
      // =============================================
      const claimable = await getClaimableCommissions(address);
      if (claimable && claimable.length > 0) {
        const totalClaimable = claimable.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
        setClaimableAmount(totalClaimable);
      } else {
        setClaimableAmount(0);
      }

    } catch (e) {
      console.error('Error loading ambassador data:', e);
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

  function shortAddr(addr) {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—';
  }

  function getDaysRemaining(createdAt) {
    const d = new Date(new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    return Math.max(0, Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24)));
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };
  // Use the fetched claimable amount instead of calculating from stats
  const availableToClaim = claimableAmount > 0 ? claimableAmount : Math.max(0, stats.totalEarned - stats.totalClaimed);

  if (!isConnected) {
    return (
      <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
        <p className="text-gray-300">Connect to access Ambassador Dashboard</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-300">Ambassador Dashboard</h2>
        <p className="text-sm text-gray-500">Earn commissions from your referral network</p>
      </div>

      {/* Referral Link */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Your Referral Link</h2>
        <div className="flex gap-3">
          <input type="text" value={referralLink} readOnly className="flex-1 p-3 rounded bg-gray-800 text-gray-300 border border-gray-700 text-sm" />
          <button onClick={copyReferralLink} className="px-6 py-3 rounded bg-orange-500 hover:bg-orange-600 text-black font-semibold">
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-3">
          Share to earn <span className="text-orange-400 font-bold">15% of referrals&apos; first 30 days rewards</span>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Works on both dashboard.afrox.one and hub.afrox.one
        </p>
      </motion.div>

      {/* Stats */}
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
        </motion.div>
      </div>

      {/* How It Works */}
      <motion.div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 p-6 rounded-xl border border-orange-500/30 mb-6">
        <h2 className="text-xl font-bold text-orange-400 mb-4">⚠️ How Referral Commissions Work</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-white mb-2">📊 Commission Calculation</h3>
            <ul className="space-y-1 text-gray-300">
              <li>• L1: <span className="text-blue-400 font-bold">15%</span> of referee&apos;s <u>first 30 days rewards</u></li>
              <li>• L2: <span className="text-green-400 font-bold">12%</span> of their first 30 days rewards</li>
              <li>• L3: <span className="text-yellow-400 font-bold">9%</span> of their first 30 days rewards</li>
              <li>• L4: <span className="text-orange-400 font-bold">6%</span> of their first 30 days rewards</li>
              <li>• L5: <span className="text-red-400 font-bold">3%</span> of their first 30 days rewards</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">🔒 Eligibility Rules</h3>
            <ul className="space-y-1 text-gray-300">
              <li>• <span className="text-yellow-400">One-time bonus</span> per referee (not recurring)</li>
              <li>• Commission is <span className="text-yellow-400">PENDING</span> for 30 days</li>
              <li>• Only <span className="text-green-400">claimable after 30 days</span></li>
              <li>• <span className="text-red-400">FORFEITED</span> if referee unstakes before 30 days</li>
              <li>• You must maintain ≥1B AfroX staked to be eligible</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Commission Rates */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Your Commission Rates (% of 30-Day Rewards)</h2>
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((level) => {
            const colors = LEVEL_COLORS[level];
            const isUnlocked = level <= unlockedLevels;
            const rates = [15, 12, 9, 6, 3];
            return (
              <div key={level} className={`text-center p-4 rounded-lg border-2 ${isUnlocked ? `${colors.bg} ${colors.border}` : 'bg-gray-800/50 border-gray-700 opacity-50'}`}>
                <div className={`text-xs ${isUnlocked ? colors.text : 'text-gray-500'}`}>{colors.label}</div>
                <div className={`text-2xl font-bold mt-1 ${isUnlocked ? colors.text : 'text-gray-600'}`}>{rates[level - 1]}%</div>
                <div className="text-[10px] text-gray-500 mt-1">{isUnlocked ? '✓ Unlocked' : '🔒 Locked'}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-gray-400">💡 Upgrade your tier by staking more AfroX to unlock deeper levels</div>
      </motion.div>

      {/* Referral Network */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Referral Network</h2>
          <div className="flex gap-2">
            <button onClick={() => setActiveTreeView('tree')} className={`px-3 py-1 rounded text-sm ${activeTreeView === 'tree' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'}`}>🌳 Tree</button>
            <button onClick={() => setActiveTreeView('list')} className={`px-3 py-1 rounded text-sm ${activeTreeView === 'list' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'}`}>📋 List</button>
          </div>
        </div>

        {/* Level Stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[{ level: 1, count: stats.l1 }, { level: 2, count: stats.l2 }, { level: 3, count: stats.l3 }, { level: 4, count: stats.l4 }, { level: 5, count: stats.l5 }].map(({ level, count }) => {
            const colors = LEVEL_COLORS[level];
            const isUnlocked = level <= unlockedLevels;
            return (
              <div key={level} className={`text-center p-4 rounded-lg ${colors.bg} border ${colors.border} ${!isUnlocked && 'opacity-40'}`}>
                <div className={`text-xs ${colors.text} font-semibold`}>{colors.label}</div>
                <div className={`text-3xl font-bold ${colors.text}`}>{count}</div>
                <div className="text-xs text-gray-500">referrals</div>
              </div>
            );
          })}
        </div>

        {/* Tree/List View */}
        {activeTreeView === 'tree' && (
          <div className="bg-gray-800/50 rounded-lg p-6">
            <div className="flex justify-center mb-6">
              <div className="px-4 py-3 bg-orange-500/20 border-2 border-orange-500 rounded-lg text-center">
                <div className="text-xs text-orange-400">YOU</div>
                <div className="text-sm font-bold text-white">{shortAddr(address)}</div>
              </div>
            </div>
            {[1, 2, 3, 4, 5].map((level) => {
              const levelRefs = referralTree.filter(r => r.level === level);
              if (levelRefs.length === 0) return null;
              const colors = LEVEL_COLORS[level];
              const isUnlocked = level <= unlockedLevels;
              return (
                <div key={level} className={`mb-4 ${!isUnlocked && 'opacity-40'}`}>
                  <div className={`text-sm ${colors.text} font-semibold mb-2 flex items-center gap-2`}>
                    <span className={`w-3 h-3 rounded-full ${colors.border} border-2`}></span>
                    {colors.label} ({levelRefs.length} referrals)
                  </div>
                  <div className="flex flex-wrap gap-2 ml-5">
                    {levelRefs.map((ref, idx) => (
                      <div key={idx} className={`px-3 py-2 rounded-lg ${colors.bg} border ${colors.border}`}>
                        <span className={`text-sm ${colors.text}`}>{shortAddr(ref.referee_address)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {referralTree.length === 0 && <div className="text-center text-gray-400 py-4">🌱 No referrals yet. Share your referral link!</div>}
          </div>
        )}

        {activeTreeView === 'list' && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {referralTree.length > 0 ? referralTree.map((ref, index) => {
              const colors = LEVEL_COLORS[ref.level] || LEVEL_COLORS[1];
              const daysRemaining = getDaysRemaining(ref.created_at);
              return (
                <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${colors.text}`}>L{ref.level}</span>
                    <span className={`text-sm ${colors.text}`}>{shortAddr(ref.referee_address)}</span>
                  </div>
                  <div className="text-xs text-gray-400">{daysRemaining > 0 ? `⏳ ${daysRemaining}d remaining` : '✓ Claimable'}</div>
                </div>
              );
            }) : <div className="text-center p-8 bg-gray-800 rounded text-gray-400">🌱 No referrals yet</div>}
          </div>
        )}
      </motion.div>

      {/* Claim Section */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Claim Commissions</h2>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-400">Available to Claim</div>
              <div className="text-2xl font-bold text-green-400">{prettyNumber(availableToClaim)} AfroX</div>
              {afroxPrice && <div className="text-xs text-green-500">≈ {formatUSD(calculateUSDValue(availableToClaim, afroxPrice))}</div>}
            </div>
            <button disabled={availableToClaim <= 0} className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50">
              {availableToClaim > 0 ? 'Claim Now' : 'Nothing to Claim'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Leaderboard */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">🏆 Top Ambassadors</h2>
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.slice(0, 10).map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center gap-3">
                  <div className={`text-lg font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                    #{index + 1}
                  </div>
                  <span className="text-sm">{shortAddr(item.wallet)}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">{prettyNumber(item.totalCommissions)} AfroX</div>
                  <div className="text-xs text-gray-400">{item.totalReferrals || 0} referrals</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-800 rounded text-gray-400">Leaderboard will populate as ambassadors earn commissions</div>
        )}
      </motion.div>

      {/* Tier Progression */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Tier Progression</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BADGE_TIERS.map((tier) => {
            const isCurrent = tier.name === currentTier.name;
            const isUnlocked = Number(stakedBalance) >= tier.minStake;
            return (
              <div key={tier.name} className={`p-4 rounded-lg border-2 text-center ${isCurrent ? 'border-orange-500 bg-orange-500/10' : isUnlocked ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700 bg-gray-800/50'}`}>
                <div className="text-2xl mb-1">{tier.emoji}</div>
                <div className={`text-sm font-bold ${isCurrent ? 'text-orange-400' : 'text-gray-300'}`}>{tier.name}</div>
                <div className="text-xs text-gray-500 mt-1">{tier.threshold}</div>
                <div className="text-xs text-purple-400 mt-1">L1-L{tier.levels}</div>
                {isCurrent && <div className="text-[10px] text-orange-400 mt-1">← Current</div>}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
