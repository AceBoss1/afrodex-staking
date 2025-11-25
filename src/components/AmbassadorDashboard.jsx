// src/components/AmbassadorDashboard.jsx
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
import { readContractSafe } from '../lib/contracts';
import { STAKING_ABI, STAKING_ADDRESS } from '../lib/contracts';
import { getAfroxPriceUSD, formatUSD, calculateUSDValue } from '../lib/priceUtils';

export default function AmbassadorDashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [stats, setStats] = useState({
    totalReferrals: 0,
    l1: 0,
    l2: 0,
    l3: 0,
    l4: 0,
    l5: 0,
    totalEarned: 0,
    totalClaimed: 0,
    pendingCommissions: 0,
    currentTier: 'Starter'
  });
  const [stakedBalance, setStakedBalance] = useState('0');
  const [referralTree, setReferralTree] = useState([]);
  const [claimableCommissions, setClaimableCommissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [afroxPrice, setAfroxPrice] = useState(null);

  // Commission rates by tier (FIXED: Remove MINSTAKE display)
  const tierRates = {
    'Starter': { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0, minStake: 0 },
    'Cadet': { l1: 15, l2: 0, l3: 0, l4: 0, l5: 0, minStake: 1e9 },
    'Captain': { l1: 15, l2: 12, l3: 0, l4: 0, l5: 0, minStake: 10e9 },
    'Commander': { l1: 15, l2: 12, l3: 9, l4: 0, l5: 0, minStake: 50e9 },
    'General': { l1: 15, l2: 12, l3: 9, l4: 6, l5: 0, minStake: 100e9 },
    'Marshal': { l1: 15, l2: 12, l3: 9, l4: 6, l5: 3, minStake: 500e9 },
    'Platinum Sentinel': { l1: 15, l2: 12, l3: 9, l4: 6, l5: 3, minStake: 1e12 },
    'Diamond Custodian': { l1: 15, l2: 12, l3: 9, l4: 6, l5: 3, minStake: 10e12 }
  };

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

  const loadAmbassadorData = useCallback(async () => {
    if (!isConnected || !address) return;

    setLoading(true);
    try {
      // 1. Fetch AfroX price
      const priceData = await getAfroxPriceUSD(publicClient, process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS);
      if (priceData) {
        setAfroxPrice(priceData.priceUSD);
      }

      // 2. Generate referral code (first 8 chars after 0x)
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
            const stakeBalHuman = (Number(stakeBalRaw) / 1e4).toString(); // Assuming 4 decimals
            setStakedBalance(stakeBalHuman);
            
            // Calculate tier from staked balance
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
        setStats(prev => ({
          ...prev,
          ...ambassadorStats
        }));
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
      // TODO: Implement claim logic
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

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

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
        <p className="text-gray-400">Share your referral link and earn tiered commissions from your network</p>
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
          Share this link to earn commissions when your referrals stake AfroX tokens
        </p>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Total Referrals</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{stats.totalReferrals}</div>
          <div className="text-xs text-gray-500 mt-1">All levels</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Total Earned</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{prettyNumber(stats.totalEarned)} AfroX</div>
          {afroxPrice && (
            <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(stats.totalEarned, afroxPrice))}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">Lifetime earnings</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Pending Claims</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{prettyNumber(stats.pendingCommissions)} AfroX</div>
          {afroxPrice && (
            <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(stats.pendingCommissions, afroxPrice))}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">Ready to claim</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Current Tier</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{stats.currentTier}</div>
          <div className="text-xs text-gray-500 mt-1">Ambassador level</div>
        </motion.div>
      </div>

      {/* Commission Rates */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Your Commission Rates</h2>
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(tierRates[stats.currentTier] || tierRates['Starter']).filter(([key]) => key !== 'minStake').map(([level, rate]) => (
            <div key={level} className="text-center p-3 bg-gray-800 rounded">
              <div className="text-xs text-gray-400">{level.toUpperCase()}</div>
              <div className="text-lg font-bold text-orange-400 mt-1">{rate}%</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-gray-800/50 rounded text-sm text-gray-400">
          <strong>⚠️ Eligibility Requirement:</strong> You must maintain ≥1B AfroX staked to earn commissions. If your stake drops below 1B when a commission is triggered, that commission is permanently forfeited.
        </div>
      </motion.div>

      {/* Referral Network Breakdown */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Referral Network Breakdown</h2>
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Level 1 (L1)', count: stats.l1, color: 'text-blue-400' },
            { label: 'Level 2 (L2)', count: stats.l2, color: 'text-green-400' },
            { label: 'Level 3 (L3)', count: stats.l3, color: 'text-yellow-400' },
            { label: 'Level 4 (L4)', count: stats.l4, color: 'text-orange-400' },
            { label: 'Level 5 (L5)', count: stats.l5, color: 'text-red-400' }
          ].map((level) => (
            <div key={level.label} className="text-center p-4 bg-gray-800 rounded">
              <div className="text-xs text-gray-400 mb-2">{level.label}</div>
              <div className={`text-3xl font-bold ${level.color}`}>{level.count}</div>
            </div>
          ))}
        </div>

        {/* Referral Tree Visualization */}
        {referralTree.length > 0 && (
          <div className="mt-6 p-4 bg-gray-800 rounded">
            <h3 className="text-sm font-semibold text-orange-400 mb-3">Your Referral Network</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {referralTree.map((ref, index) => (
                <div key={index} className="flex items-center justify-between text-xs p-2 bg-gray-700/50 rounded">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${
                      ref.level === 1 ? 'text-blue-400' :
                      ref.level === 2 ? 'text-green-400' :
                      ref.level === 3 ? 'text-yellow-400' :
                      ref.level === 4 ? 'text-orange-400' : 'text-red-400'
                    }`}>L{ref.level}</span>
                    <span className="text-gray-300">{ref.referee_address.slice(0, 6)}...{ref.referee_address.slice(-4)}</span>
                  </div>
                  <span className="text-gray-500">{new Date(ref.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {referralTree.length === 0 && (
          <div className="mt-6 p-4 bg-gray-800 rounded text-center text-gray-400 text-sm">
            No referrals yet. Share your referral link to start building your network!
          </div>
        )}
      </motion.div>

      {/* Claim Section */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Claim Commissions</h2>
        
        {stats.pendingCommissions > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4 p-4 bg-gray-800 rounded">
              <div>
                <div className="text-sm text-gray-400">Available to Claim</div>
                <div className="text-2xl font-bold text-green-400">{prettyNumber(stats.pendingCommissions, 6)} AfroX</div>
              </div>
              <button
                onClick={claimCommissions}
                disabled={loading}
                className="px-6 py-3 rounded bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Claim Now'}
              </button>
            </div>
            <div className="text-xs text-gray-400">
              ✓ You meet the minimum 1B AfroX staking requirement
            </div>
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-800 rounded">
            <div className="text-gray-400 mb-2">No commissions available to claim</div>
            <div className="text-sm text-gray-500">Start referring users to earn commissions</div>
          </div>
        )}
      </motion.div>

      {/* Leaderboard */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Top Ambassadors</h2>
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold text-orange-400">#{item.rank}</div>
                  <div>
                    <div className="text-sm font-medium">{item.wallet.slice(0, 6)}...{item.wallet.slice(-4)}</div>
                    <div className="text-xs text-gray-400">{item.tier}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">{prettyNumber(item.totalCommissions)} AfroX</div>
                  <div className="text-xs text-gray-400">{item.totalReferrals} referrals</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-800 rounded text-gray-400">
            Leaderboard will be populated as ambassadors earn commissions
          </div>
        )}
      </motion.div>

      {/* How It Works */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">How Ambassador Rewards Work</h2>
        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">📊 Tiered Commission Structure</h3>
            <p>Earn commissions from up to 5 levels deep based on your staking tier. Higher tiers unlock deeper levels and higher rates.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">⚡ Commission Trigger</h3>
            <p>Commissions are paid when your referred users claim their first 30 days of staking rewards. No lock period required.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🎯 Eligibility Requirements</h3>
            <p>You must maintain ≥1B AfroX staked at the moment commissions are triggered. If below 1B, that commission is forfeited.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🔒 Trust or Lose It</h3>
            <p>The system operates on trust. Keep your stake active to benefit from your network&apos;s growth.</p>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
