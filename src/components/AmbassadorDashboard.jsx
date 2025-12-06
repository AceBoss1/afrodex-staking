// src/components/AmbassadorDashboard.jsx
// Updated to fetch commission data from Supabase
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BADGE_TIERS, createDynamicReferralLink, prettyNumber } from './AfrodexStaking';
import { formatUSD } from '../lib/priceUtils';
import {
  getAmbassadorStats,
  getCommissions,
  getReferrals,
  updateAmbassadorCommissions
} from '../lib/supabaseClient';

// Commission rates by level (applied to first month rewards = stake × 18%)
const COMMISSION_RATES = {
  1: 0.15, // 15%
  2: 0.12, // 12%
  3: 0.09, // 9%
  4: 0.06, // 6%
  5: 0.03  // 3%
};

export default function AmbassadorDashboard({ 
  address, 
  stakedBalance, 
  badgeTier, 
  referralCode: propReferralCode,
  ambassadorStats: propStats,
  afroxPrice = 0 
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [copied, setCopied] = useState(false);
  
  // Derived values
  const referralCode = propReferralCode || stats?.referral_code || '';
  const referralLink = createDynamicReferralLink(referralCode);

  // =============================================
  // FETCH DATA FROM SUPABASE
  // =============================================
  const fetchData = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [statsData, commissionsData, referralsData] = await Promise.all([
        getAmbassadorStats(address),
        getCommissions(address),
        getReferrals(address)
      ]);
      
      setStats(statsData);
      setCommissions(commissionsData || []);
      setReferrals(referralsData || []);
      
      console.log('📊 Ambassador data loaded:', {
        stats: statsData,
        commissions: commissionsData?.length || 0,
        referrals: referralsData?.length || 0
      });
    } catch (error) {
      console.error('Error fetching ambassador data:', error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Use prop stats if available, otherwise use fetched stats
  const displayStats = propStats || stats;

  // =============================================
  // CALCULATE COMMISSION TOTALS
  // =============================================
  const commissionTotals = React.useMemo(() => {
    if (!commissions || commissions.length === 0) {
      return {
        totalEarned: 0,
        pending: 0,
        claimed: 0,
        available: 0
      };
    }

    let totalEarned = 0;
    let pending = 0;
    let claimed = 0;
    let available = 0;

    commissions.forEach(c => {
      const amount = parseFloat(c.amount || 0);
      totalEarned += amount;
      
      if (c.claimed) {
        claimed += amount;
      } else if (c.is_claimable) {
        available += amount;
      } else {
        pending += amount;
      }
    });

    return { totalEarned, pending, claimed, available };
  }, [commissions]);

  // =============================================
  // COPY REFERRAL LINK
  // =============================================
  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // =============================================
  // RENDER
  // =============================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Total Earned */}
        <motion.div 
          className="bg-gray-900 p-6 rounded-2xl border border-gray-800"
          whileHover={{ scale: 1.02 }}
        >
          <p className="text-gray-400 text-sm mb-1">Total Earned</p>
          <p className="text-2xl font-bold text-white">
            {prettyNumber(commissionTotals.totalEarned)} AfroX
          </p>
          <p className="text-sm text-gray-500">
            ≈ {formatUSD(commissionTotals.totalEarned * afroxPrice)}
          </p>
        </motion.div>

        {/* Pending (30-day lock) */}
        <motion.div 
          className="bg-gray-900 p-6 rounded-2xl border border-yellow-600/20"
          whileHover={{ scale: 1.02 }}
        >
          <p className="text-gray-400 text-sm mb-1">Pending (30-day lock)</p>
          <p className="text-2xl font-bold text-yellow-400">
            {prettyNumber(commissionTotals.pending)} AfroX
          </p>
          <p className="text-sm text-gray-500">
            ≈ {formatUSD(commissionTotals.pending * afroxPrice)}
          </p>
        </motion.div>

        {/* Available to Claim */}
        <motion.div 
          className="bg-gray-900 p-6 rounded-2xl border border-green-600/20"
          whileHover={{ scale: 1.02 }}
        >
          <p className="text-gray-400 text-sm mb-1">Available to Claim</p>
          <p className="text-2xl font-bold text-green-400">
            {prettyNumber(commissionTotals.available)} AfroX
          </p>
          <p className="text-sm text-gray-500">
            ≈ {formatUSD(commissionTotals.available * afroxPrice)}
          </p>
        </motion.div>

        {/* Already Claimed */}
        <motion.div 
          className="bg-gray-900 p-6 rounded-2xl border border-gray-800"
          whileHover={{ scale: 1.02 }}
        >
          <p className="text-gray-400 text-sm mb-1">Claimed</p>
          <p className="text-2xl font-bold text-gray-400">
            {prettyNumber(commissionTotals.claimed)} AfroX
          </p>
          <p className="text-sm text-gray-500">
            ≈ {formatUSD(commissionTotals.claimed * afroxPrice)}
          </p>
        </motion.div>
      </div>

      {/* Claim Button */}
      {commissionTotals.available > 0 && (
        <motion.button
          className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 rounded-xl font-bold text-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            // TODO: Implement commission claim transaction
            alert('Commission claiming coming soon! This will be a smart contract transaction.');
          }}
        >
          Claim {prettyNumber(commissionTotals.available)} AfroX
        </motion.button>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Referral Link & Badge */}
        <div className="space-y-6">
          {/* Referral Link Card */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-orange-600/20">
            <h3 className="text-lg font-bold mb-4">Your Referral Link</h3>
            
            <div className="bg-gray-800 p-4 rounded-xl mb-4">
              <p className="text-xs text-gray-400 mb-1">Referral Code</p>
              <p className="text-xl font-mono font-bold text-orange-500">{referralCode || 'Connect wallet'}</p>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-300"
              />
              <button
                onClick={copyReferralLink}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  copied 
                    ? 'bg-green-600 text-white' 
                    : 'bg-orange-600 hover:bg-orange-500 text-white'
                }`}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
              Share this link to earn commissions when your referrals stake AfroX
            </p>
          </motion.div>

          {/* Badge Tier Card */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
            <h3 className="text-lg font-bold mb-4">Your Badge Tier</h3>
            
            <div className="text-center mb-6">
              <span className="text-6xl">{badgeTier?.emoji || '✳️'}</span>
              <h4 className="text-2xl font-bold mt-2">{badgeTier?.name || 'Starter'}</h4>
              <p className="text-gray-400">{badgeTier?.threshold}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Your Stake:</span>
                <span className="font-medium">{prettyNumber(stakedBalance)} AfroX</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Referral Levels:</span>
                <span className="font-medium">L1{badgeTier?.levels > 1 ? ` - L${badgeTier.levels}` : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Can Create Proposals:</span>
                <span className={badgeTier?.canPropose ? 'text-green-400' : 'text-gray-500'}>
                  {badgeTier?.canPropose ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Referral Stats & Commission Breakdown */}
        <div className="space-y-6">
          {/* Referral Counts */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
            <h3 className="text-lg font-bold mb-4">Referral Network</h3>
            
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((level) => {
                const count = displayStats?.[`level_${level}_count`] || displayStats?.[`l${level}_count`] || 0;
                const isAccessible = level <= (badgeTier?.levels || 0);
                return (
                  <div 
                    key={level}
                    className={`text-center p-3 rounded-xl ${
                      isAccessible ? 'bg-gray-800' : 'bg-gray-800/50 opacity-50'
                    }`}
                  >
                    <p className="text-xs text-gray-400">L{level}</p>
                    <p className={`text-xl font-bold ${isAccessible ? 'text-white' : 'text-gray-600'}`}>
                      {count}
                    </p>
                    <p className="text-xs text-gray-500">{(COMMISSION_RATES[level] * 100).toFixed(0)}%</p>
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-between pt-4 border-t border-gray-800">
              <span className="text-gray-400">Total Referrals:</span>
              <span className="text-xl font-bold">{displayStats?.total_referrals || 0}</span>
            </div>
          </motion.div>

          {/* Commission Rates Info */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
            <h3 className="text-lg font-bold mb-4">Commission Structure</h3>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-4">
                Commissions are calculated on <span className="text-orange-400">first month rewards</span> (stake × 18%), not the stake amount.
              </p>
              
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div 
                    key={level}
                    className={`flex justify-between items-center p-3 rounded-xl ${
                      level <= (badgeTier?.levels || 0) 
                        ? 'bg-gray-800' 
                        : 'bg-gray-800/30 opacity-50'
                    }`}
                  >
                    <span className="text-gray-400">Level {level}</span>
                    <span className={`font-bold ${
                      level <= (badgeTier?.levels || 0) ? 'text-orange-400' : 'text-gray-600'
                    }`}>
                      {(COMMISSION_RATES[level] * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-blue-900/20 rounded-xl border border-blue-600/20">
                <p className="text-xs text-blue-400">
                  <strong>Example:</strong> Referral stakes 100B AfroX<br/>
                  → First month rewards: 100B × 18% = 18B<br/>
                  → Your L1 commission: 18B × 15% = 2.7B AfroX
                </p>
              </div>
            </div>
          </motion.div>

          {/* Recent Commissions */}
          {commissions.length > 0 && (
            <motion.div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
              <h3 className="text-lg font-bold mb-4">Recent Commissions</h3>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {commissions.slice(0, 10).map((c, i) => (
                  <div 
                    key={c.id || i}
                    className="flex justify-between items-center p-3 bg-gray-800 rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        L{c.level} • {c.commission_type}
                      </p>
                      <p className="text-xs text-gray-500">
                        From: {c.referee_address?.slice(0, 8)}...
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        c.claimed ? 'text-gray-400' : 
                        c.is_claimable ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {prettyNumber(parseFloat(c.amount || 0))}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.claimed ? 'Claimed' : c.is_claimable ? 'Claimable' : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Tier Progression */}
      <motion.div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
        <h3 className="text-lg font-bold mb-4">Badge Tier Progression</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {BADGE_TIERS.map((tier, index) => {
            const isCurrentTier = tier.name === badgeTier?.name;
            const isAchieved = stakedBalance >= tier.minStake;
            
            return (
              <div
                key={tier.name}
                className={`text-center p-3 rounded-xl border ${
                  isCurrentTier 
                    ? 'bg-orange-600/20 border-orange-500' 
                    : isAchieved 
                      ? 'bg-gray-800 border-gray-700' 
                      : 'bg-gray-900 border-gray-800 opacity-50'
                }`}
              >
                <span className="text-2xl">{tier.emoji}</span>
                <p className="text-xs font-medium mt-1 truncate">{tier.name}</p>
                <p className="text-xs text-gray-500">{tier.threshold}</p>
                <p className="text-xs text-gray-600">L1-L{tier.levels || 0}</p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
