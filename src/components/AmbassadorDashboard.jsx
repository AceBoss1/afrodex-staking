// src/components/AmbassadorDashboard.jsx
// FIXED: Correct referral logic - 15% of first 30 days REWARDS (not staked amount)
// FIXED: One-time, pending until 30 days, claimable only if referee didn't unstake
// FIXED: Full referral tree visualization with color-coded L1-L5 levels
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion } from 'framer-motion';
import { 
  generateReferralCode, 
  createReferralLink, 
  getAmbassadorStats,
  getAmbassadorLeaderboard,
  getReferralTree
} from '../lib/supabaseClient';
import { readContractSafe, STAKING_ADDRESS } from '../lib/contracts';
import { STAKING_ABI } from '../lib/abis';
import { getAfroxPriceUSD, formatUSD, calculateUSDValue } from '../lib/priceUtils';

// Level colors for tree visualization
const LEVEL_COLORS = {
  1: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', label: 'L1 - Direct' },
  2: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400', label: 'L2' },
  3: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', label: 'L3' },
  4: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', label: 'L4' },
  5: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', label: 'L5' }
};

// Commission rates - percentage of FIRST 30 DAYS REWARDS (not staked amount!)
const COMMISSION_RATES = {
  L1: 15, // 15% of referee's first 30 days rewards
  L2: 12,
  L3: 9,
  L4: 6,
  L5: 3
};

// Tier requirements for unlocking levels
const TIER_CONFIG = {
  'Starter': { levels: 0, minStake: 0, emoji: '✳️' },
  'Cadet': { levels: 1, minStake: 1e9, emoji: '🔰' },
  'Captain': { levels: 2, minStake: 10e9, emoji: '🔱' },
  'Commander': { levels: 3, minStake: 50e9, emoji: '⚜️' },
  'General': { levels: 4, minStake: 100e9, emoji: '⭐' },
  'Marshal': { levels: 5, minStake: 500e9, emoji: '〽️' },
  'Platinum Sentinel': { levels: 5, minStake: 1e12, emoji: '💠' },
  'Diamond Custodian': { levels: 5, minStake: 10e12, emoji: '❇️' }
};

export default function AmbassadorDashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [stats, setStats] = useState({
    totalReferrals: 0,
    l1: 0, l2: 0, l3: 0, l4: 0, l5: 0,
    totalEarned: 0,
    totalClaimed: 0,
    pendingCommissions: 0,
    currentTier: 'Starter'
  });
  const [stakedBalance, setStakedBalance] = useState('0');
  const [referralTree, setReferralTree] = useState([]);
  const [pendingCommissions, setPendingCommissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [afroxPrice, setAfroxPrice] = useState(null);
  const [activeTreeView, setActiveTreeView] = useState('tree'); // 'tree' or 'list'

  // Calculate tier based on staked amount
  const calculateTier = useCallback((staked) => {
    const amount = Number(staked);
    if (amount >= 10e12) return 'Diamond Custodian';
    if (amount >= 1e12) return 'Platinum Sentinel';
    if (amount >= 500e9) return 'Marshal';
    if (amount >= 100e9) return 'General';
    if (amount >= 50e9) return 'Commander';
    if (amount >= 10e9) return 'Captain';
    if (amount >= 1e9) return 'Cadet';
    return 'Starter';
  }, []);

  // Get unlocked levels for current tier
  const getUnlockedLevels = useCallback((tier) => {
    return TIER_CONFIG[tier]?.levels || 0;
  }, []);

  const loadAmbassadorData = useCallback(async () => {
    if (!isConnected || !address) return;

    setLoading(true);
    try {
      // 1. Fetch AfroX price
      const priceData = await getAfroxPriceUSD(publicClient, process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS);
      if (priceData) setAfroxPrice(priceData.priceUSD);

      // 2. Generate referral code
      const code = generateReferralCode(address);
      setReferralCode(code);
      setReferralLink(createReferralLink(code));
      
      // 3. Get staked balance from contract
      if (publicClient) {
        try {
          const stakeInfo = await readContractSafe(publicClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'viewStakeInfoOf',
            args: [address],
          });

          if (stakeInfo) {
            const stakeBalRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
            const stakeBalHuman = (Number(stakeBalRaw) / 1e4).toString();
            setStakedBalance(stakeBalHuman);
            
            const tier = calculateTier(stakeBalHuman);
            setStats(prev => ({ ...prev, currentTier: tier }));
          }
        } catch (err) {
          console.error('Error fetching staked balance:', err);
        }
      }
      
      // 4. Load stats from Supabase
      const ambassadorStats = await getAmbassadorStats(address);
      if (ambassadorStats) {
        setStats(prev => ({ ...prev, ...ambassadorStats }));
      }
      
      // 5. Load leaderboard
      const leaderboardData = await getAmbassadorLeaderboard(100);
      setLeaderboard(leaderboardData);
      
      // 6. Load referral tree
      const treeData = await getReferralTree(address, 5);
      setReferralTree(treeData);
      
    } catch (error) {
      console.error('Error loading ambassador data:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, publicClient, calculateTier]);

  useEffect(() => {
    if (isConnected && address) {
      loadAmbassadorData();
    }
  }, [isConnected, address, loadAmbassadorData]);

  function copyReferralLink() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function claimCommissions() {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      // TODO: Implement claim logic with smart contract
      alert('Claim functionality coming soon!');
    } catch (error) {
      console.error('Claim error:', error);
    } finally {
      setLoading(false);
    }
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

  // Calculate days until commission is claimable
  function getDaysRemaining(createdAt) {
    const created = new Date(createdAt);
    const claimableDate = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = Math.ceil((claimableDate - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };
  const tierConfig = TIER_CONFIG[stats.currentTier] || TIER_CONFIG['Starter'];
  const unlockedLevels = getUnlockedLevels(stats.currentTier);

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-300">Please connect your wallet to access the Ambassador Dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12">
      
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">Ambassador Dashboard</h1>
        <p className="text-gray-400">Earn commissions from your referral network&apos;s staking rewards</p>
      </div>

      {/* Referral Link Card */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Your Referral Link</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 p-3 rounded bg-gray-800 text-gray-300 border border-gray-700"
          />
          <button
            onClick={copyReferralLink}
            className="px-6 py-3 rounded bg-orange-500 hover:bg-orange-600 text-black font-semibold"
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-3">
          Share this link to earn <span className="text-orange-400 font-bold">15% of your referrals&apos; first 30 days rewards</span>
        </p>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Total Referrals</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{stats.totalReferrals}</div>
          <div className="text-xs text-gray-500 mt-1">All levels combined</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Total Earned</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{prettyNumber(stats.totalEarned)} AfroX</div>
          {afroxPrice && (
            <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(stats.totalEarned, afroxPrice))}</div>
          )}
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Pending (30-day lock)</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{prettyNumber(stats.pendingCommissions)} AfroX</div>
          <div className="text-xs text-gray-500 mt-1">Unlocks after 30 days</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Current Tier</div>
          <div className="text-2xl font-bold text-orange-400 mt-1 flex items-center gap-2">
            <span>{tierConfig.emoji}</span>
            <span>{stats.currentTier}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Unlocks L1-L{unlockedLevels}</div>
        </motion.div>
      </div>

      {/* ⚠️ IMPORTANT: Commission Rules Explanation */}
      <motion.div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 p-6 rounded-xl border border-orange-500/30 mb-6">
        <h2 className="text-xl font-bold text-orange-400 mb-4">⚠️ How Referral Commissions Work</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-white mb-2">📊 Commission Calculation</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• L1: <span className="text-blue-400 font-bold">15%</span> of referee&apos;s <u>first 30 days rewards</u></li>
              <li>• L2: <span className="text-green-400 font-bold">12%</span> of their first 30 days rewards</li>
              <li>• L3: <span className="text-yellow-400 font-bold">9%</span> of their first 30 days rewards</li>
              <li>• L4: <span className="text-orange-400 font-bold">6%</span> of their first 30 days rewards</li>
              <li>• L5: <span className="text-red-400 font-bold">3%</span> of their first 30 days rewards</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">🔒 Eligibility Rules</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• <span className="text-yellow-400">One-time bonus</span> per referee (not recurring)</li>
              <li>• Commission is <span className="text-yellow-400">PENDING</span> for 30 days</li>
              <li>• Only <span className="text-green-400">claimable after 30 days</span></li>
              <li>• <span className="text-red-400">FORFEITED</span> if referee unstakes before 30 days</li>
              <li>• You must maintain ≥1B AfroX staked to be eligible</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Commission Rates by Level */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Your Commission Rates (% of 30-Day Rewards)</h2>
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((level) => {
            const colors = LEVEL_COLORS[level];
            const rate = COMMISSION_RATES[`L${level}`];
            const isUnlocked = level <= unlockedLevels;
            
            return (
              <div 
                key={level} 
                className={`text-center p-4 rounded-lg border-2 ${
                  isUnlocked 
                    ? `${colors.bg} ${colors.border}` 
                    : 'bg-gray-800/50 border-gray-700 opacity-50'
                }`}
              >
                <div className={`text-xs ${isUnlocked ? colors.text : 'text-gray-500'}`}>
                  {colors.label}
                </div>
                <div className={`text-2xl font-bold mt-1 ${isUnlocked ? colors.text : 'text-gray-600'}`}>
                  {rate}%
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {isUnlocked ? '✓ Unlocked' : '🔒 Locked'}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-gray-400">
          💡 Upgrade your tier by staking more AfroX to unlock deeper levels
        </div>
      </motion.div>

      {/* Referral Network Breakdown */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Referral Network</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTreeView('tree')}
              className={`px-3 py-1 rounded text-sm ${activeTreeView === 'tree' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'}`}
            >
              🌳 Tree View
            </button>
            <button
              onClick={() => setActiveTreeView('list')}
              className={`px-3 py-1 rounded text-sm ${activeTreeView === 'list' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'}`}
            >
              📋 List View
            </button>
          </div>
        </div>

        {/* Level Summary */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { level: 1, count: stats.l1 },
            { level: 2, count: stats.l2 },
            { level: 3, count: stats.l3 },
            { level: 4, count: stats.l4 },
            { level: 5, count: stats.l5 }
          ].map(({ level, count }) => {
            const colors = LEVEL_COLORS[level];
            const isUnlocked = level <= unlockedLevels;
            
            return (
              <div 
                key={level} 
                className={`text-center p-3 rounded-lg ${colors.bg} border ${colors.border} ${!isUnlocked && 'opacity-40'}`}
              >
                <div className={`text-xs ${colors.text} font-semibold`}>{colors.label}</div>
                <div className={`text-3xl font-bold ${colors.text}`}>{count}</div>
                <div className="text-[10px] text-gray-500">referrals</div>
              </div>
            );
          })}
        </div>

        {/* Tree Visualization */}
        {activeTreeView === 'tree' && referralTree.length > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-center mb-4">
              <div className="px-4 py-2 bg-orange-500/20 border border-orange-500 rounded-lg">
                <div className="text-xs text-orange-400">YOU</div>
                <div className="text-sm font-bold text-white">{shortAddr(address)}</div>
              </div>
            </div>
            
            {/* Render tree by levels */}
            {[1, 2, 3, 4, 5].map((level) => {
              const levelRefs = referralTree.filter(r => r.level === level);
              if (levelRefs.length === 0) return null;
              
              const colors = LEVEL_COLORS[level];
              const isUnlocked = level <= unlockedLevels;
              
              return (
                <div key={level} className={`mb-4 ${!isUnlocked && 'opacity-40'}`}>
                  <div className={`text-xs ${colors.text} font-semibold mb-2 flex items-center gap-2`}>
                    <span className={`w-3 h-3 rounded-full ${colors.bg} ${colors.border} border`}></span>
                    {colors.label} ({levelRefs.length} referrals)
                    {!isUnlocked && <span className="text-gray-500 ml-2">🔒 Upgrade tier to unlock</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 ml-5">
                    {levelRefs.slice(0, 20).map((ref, idx) => (
                      <div 
                        key={idx}
                        className={`px-3 py-1 rounded ${colors.bg} border ${colors.border} text-xs`}
                      >
                        <span className={colors.text}>{shortAddr(ref.referee_address)}</span>
                        {ref.status === 'pending' && (
                          <span className="ml-1 text-yellow-400">⏳</span>
                        )}
                        {ref.status === 'claimable' && (
                          <span className="ml-1 text-green-400">✓</span>
                        )}
                      </div>
                    ))}
                    {levelRefs.length > 20 && (
                      <div className="px-3 py-1 text-xs text-gray-500">
                        +{levelRefs.length - 20} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {activeTreeView === 'list' && referralTree.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {referralTree.map((ref, index) => {
              const colors = LEVEL_COLORS[ref.level];
              const daysRemaining = getDaysRemaining(ref.created_at);
              const isClaimable = daysRemaining === 0;
              
              return (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-3 rounded-lg ${colors.bg} border ${colors.border}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${colors.text} ${colors.bg}`}>
                      L{ref.level}
                    </span>
                    <div>
                      <div className={`text-sm font-medium ${colors.text}`}>
                        {shortAddr(ref.referee_address)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Joined {new Date(ref.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {isClaimable ? (
                      <div className="text-xs text-green-400 font-semibold">✓ Claimable</div>
                    ) : (
                      <div className="text-xs text-yellow-400">⏳ {daysRemaining}d remaining</div>
                    )}
                    <div className="text-[10px] text-gray-500">
                      {COMMISSION_RATES[`L${ref.level}`]}% of rewards
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {referralTree.length === 0 && (
          <div className="text-center p-8 bg-gray-800 rounded-lg text-gray-400 text-sm">
            <div className="text-4xl mb-3">🌱</div>
            No referrals yet. Share your referral link to start building your network!
          </div>
        )}
      </motion.div>

      {/* Pending Commissions (30-day lock) */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Pending Commissions</h2>
        
        {pendingCommissions.length > 0 ? (
          <div className="space-y-3">
            {pendingCommissions.map((commission, idx) => {
              const daysRemaining = getDaysRemaining(commission.created_at);
              const isClaimable = daysRemaining === 0 && commission.referee_still_staking;
              
              return (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-white">
                      From: {shortAddr(commission.referee_address)}
                    </div>
                    <div className="text-xs text-gray-400">
                      L{commission.level} • {COMMISSION_RATES[`L${commission.level}`]}% of their 30-day rewards
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-orange-400">
                      {prettyNumber(commission.amount)} AfroX
                    </div>
                    {isClaimable ? (
                      <div className="text-xs text-green-400">✓ Ready to claim</div>
                    ) : daysRemaining > 0 ? (
                      <div className="text-xs text-yellow-400">⏳ {daysRemaining} days left</div>
                    ) : (
                      <div className="text-xs text-red-400">✗ Forfeited (unstaked)</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-800 rounded">
            <div className="text-gray-400 mb-2">No pending commissions</div>
            <div className="text-sm text-gray-500">
              Commissions appear here when your referrals stake AfroX
            </div>
          </div>
        )}
      </motion.div>

      {/* Claim Section */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Claim Commissions</h2>
        
        <div className="bg-gray-800/50 p-4 rounded-lg mb-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-400">Available to Claim</div>
              <div className="text-2xl font-bold text-green-400">
                {prettyNumber(stats.totalEarned - stats.totalClaimed)} AfroX
              </div>
              {afroxPrice && (
                <div className="text-xs text-gray-500">
                  ≈ {formatUSD(calculateUSDValue(stats.totalEarned - stats.totalClaimed, afroxPrice))}
                </div>
              )}
            </div>
            <button
              onClick={claimCommissions}
              disabled={loading || (stats.totalEarned - stats.totalClaimed) <= 0}
              className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Claim Now'}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <div>✓ Only 30+ day old commissions are claimable</div>
          <div>✓ Referee must still be staking for commission to be valid</div>
          <div>✓ You must have ≥1B AfroX staked to claim</div>
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
                  <div className={`text-lg font-bold ${
                    index === 0 ? 'text-yellow-400' : 
                    index === 1 ? 'text-gray-300' : 
                    index === 2 ? 'text-orange-600' : 'text-gray-500'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{shortAddr(item.wallet || item.ambassador_address)}</div>
                    <div className="text-xs text-gray-400">{item.tier || 'Ambassador'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">
                    {prettyNumber(item.totalCommissions || item.total_earned)} AfroX
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.totalReferrals || item.total_referrals} referrals
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-800 rounded text-gray-400">
            Leaderboard will populate as ambassadors earn commissions
          </div>
        )}
      </motion.div>

      {/* Tier Progression */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Tier Progression</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(TIER_CONFIG).filter(([name]) => name !== 'Starter').map(([name, config]) => {
            const isCurrent = name === stats.currentTier;
            const isUnlocked = Number(stakedBalance) >= config.minStake;
            
            return (
              <div 
                key={name}
                className={`p-4 rounded-lg border-2 text-center ${
                  isCurrent 
                    ? 'border-orange-500 bg-orange-500/10' 
                    : isUnlocked 
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <div className="text-2xl mb-1">{config.emoji}</div>
                <div className={`text-sm font-bold ${isCurrent ? 'text-orange-400' : 'text-gray-300'}`}>
                  {name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ≥{prettyNumber(config.minStake)}
                </div>
                <div className="text-xs text-purple-400 mt-1">
                  L1-L{config.levels}
                </div>
                {isCurrent && (
                  <div className="text-[10px] text-orange-400 mt-1">← Current</div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
