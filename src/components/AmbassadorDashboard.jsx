// src/components/AmbassadorDashboard.jsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';

export default function AmbassadorDashboard({ stakedBalance = '0' }) {
  const { address, isConnected } = useAccount();
  
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
  const [referralTree, setReferralTree] = useState(null);
  const [showTree, setShowTree] = useState(false);
  const [claimableCommissions, setClaimableCommissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claimType, setClaimType] = useState('instant'); // 'instant' or 'gasless'

  // Commission rates by tier
  const tierRates = {
    'Starter': { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0 },
    'Cadet': { l1: 15, l2: 0, l3: 0, l4: 0, l5: 0 },
    'Captain': { l1: 15, l2: 12, l3: 0, l4: 0, l5: 0 },
    'Commander': { l1: 15, l2: 12, l3: 9, l4: 0, l5: 0 },
    'General': { l1: 15, l2: 12, l3: 9, l4: 6, l5: 0 },
    'Marshal': { l1: 15, l2: 12, l3: 9, l4: 6, l5: 3 },
    'Platinum Sentinel': { l1: 15, l2: 12, l3: 9, l4: 6, l5: 3 },
    'Diamond Custodian': { l1: 15, l2: 12, l3: 9, l4: 6, l5: 3 }
  };

  // Get badge tier based on staked balance
  const getBadgeTier = useCallback(() => {
    const staked = Number(stakedBalance || '0');
    
    if (staked >= 10e12) return { name: 'Diamond Custodian', emoji: '❇️', threshold: '≥10T AfroX' };
    if (staked >= 1e12) return { name: 'Platinum Sentinel', emoji: '💠', threshold: '≥1T AfroX' };
    if (staked >= 500e9) return { name: 'Marshal', emoji: '〽️', threshold: '≥500B AfroX' };
    if (staked >= 100e9) return { name: 'General', emoji: '⭐', threshold: '≥100B AfroX' };
    if (staked >= 50e9) return { name: 'Commander', emoji: '⚜️', threshold: '≥50B AfroX' };
    if (staked >= 10e9) return { name: 'Captain', emoji: '🔱', threshold: '≥10B AfroX' };
    if (staked >= 1e9) return { name: 'Cadet', emoji: '🔰', threshold: '≥1B AfroX' };
    
    return { name: 'Starter', emoji: '✳️', threshold: 'Stake ≥1B to unlock' };
  }, [stakedBalance]);

  const currentBadge = getBadgeTier();

  const loadAmbassadorData = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual Supabase calls
      // For now, using placeholder data
      
      // Generate referral code and link
      const code = address.slice(2, 10); // Use first 8 chars of address as code
      setReferralCode(code);
      setReferralLink(`https://dashboard.afrox.one/?ref=${code}`);
      
      // Load stats (TODO: fetch from Supabase)
      setStats({
        totalReferrals: 0,
        l1: 0,
        l2: 0,
        l3: 0,
        l4: 0,
        l5: 0,
        totalEarned: 0,
        totalClaimed: 0,
        pendingCommissions: 0,
        currentTier: currentBadge.name
      });
      
    } catch (error) {
      console.error('Error loading ambassador data:', error);
    } finally {
      setLoading(false);
    }
  }, [address, currentBadge.name]);

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
      if (claimType === 'instant') {
        // TODO: Implement instant claim with gas payment
        alert('Instant claim (you pay gas) - Coming soon!');
      } else {
        // TODO: Add to gasless claim queue
        alert('Added to gasless claim queue! You will receive your rewards on the 7th of next month.');
      }
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
          <div className="text-xs text-gray-500 mt-1">Lifetime earnings</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Pending Claims</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{prettyNumber(stats.pendingCommissions)} AfroX</div>
          <div className="text-xs text-gray-500 mt-1">Ready to claim</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Current Tier</div>
          <div className="text-2xl font-bold text-orange-400 mt-1 flex items-center gap-2">
            <span>{currentBadge.emoji}</span>
            <span>{currentBadge.name}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Ambassador level</div>
        </motion.div>
      </div>

      {/* Commission Rates */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Your Commission Rates</h2>
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(tierRates[currentBadge.name] || tierRates['Starter']).map(([level, rate]) => (
            <div key={level} className="text-center p-3 bg-gray-800 rounded">
              <div className="text-xs text-gray-400">{level.toUpperCase()}</div>
              <div className="text-lg font-bold text-orange-400 mt-1">{rate}%</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-gray-800/50 rounded text-sm text-gray-400">
          <strong>⚠️ Eligibility Requirement:</strong> You must maintain the minimum staking requirement for your current badge tier to earn commissions at that tier level. If your stake drops below your tier&apos;s minimum when a commission is triggered, you will only earn from the levels available at your reduced tier.
        </div>
      </motion.div>

      {/* Referral Network Breakdown */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Referral Network Breakdown</h2>
          <button
            onClick={() => setShowTree(!showTree)}
            className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
          >
            {showTree ? '📊 Show Stats' : '🌳 Show Tree'}
          </button>
        </div>

        {!showTree ? (
          <div className="grid grid-cols-5 gap-3">
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
        ) : (
          <div className="bg-gray-800 p-6 rounded-lg min-h-[400px]">
            {/* Simple Tree Visualization */}
            <div className="overflow-x-auto">
              <div className="flex flex-col items-center space-y-4">
                {/* Root (You) */}
                <div className="flex flex-col items-center">
                  <div className="px-4 py-2 bg-orange-600 rounded-lg text-white font-semibold">
                    You ({currentBadge.emoji})
                  </div>
                </div>

                {/* Level 1 */}
                {stats.l1 > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-0.5 bg-blue-400"></div>
                    <div className="flex gap-4">
                      {Array.from({ length: Math.min(stats.l1, 5) }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center">
                          <div className="px-3 py-1.5 bg-blue-600 rounded text-white text-sm">L1</div>
                          {stats.l2 > 0 && i === 0 && (
                            <>
                              <div className="h-6 w-0.5 bg-green-400"></div>
                              <div className="px-3 py-1.5 bg-green-600 rounded text-white text-xs">L2</div>
                              {stats.l3 > 0 && (
                                <>
                                  <div className="h-6 w-0.5 bg-yellow-400"></div>
                                  <div className="px-3 py-1.5 bg-yellow-600 rounded text-white text-xs">L3</div>
                                  {stats.l4 > 0 && (
                                    <>
                                      <div className="h-6 w-0.5 bg-orange-400"></div>
                                      <div className="px-2 py-1 bg-orange-600 rounded text-white text-xs">L4</div>
                                      {stats.l5 > 0 && (
                                        <>
                                          <div className="h-6 w-0.5 bg-red-400"></div>
                                          <div className="px-2 py-1 bg-red-600 rounded text-white text-xs">L5</div>
                                        </>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                      {stats.l1 > 5 && (
                        <div className="px-3 py-1.5 bg-gray-700 rounded text-gray-300 text-sm">
                          +{stats.l1 - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 text-center text-sm text-gray-400">
              Simplified view showing your referral network structure
            </div>
          </div>
        )}
      </motion.div>

      {/* Claim Section */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Claim Commissions</h2>
        
        {stats.pendingCommissions > 0 ? (
          <div>
            <div className="mb-4 p-4 bg-gray-800 rounded">
              <div className="text-sm text-gray-400 mb-2">Available to Claim</div>
              <div className="text-2xl font-bold text-green-400 mb-4">{prettyNumber(stats.pendingCommissions, 6)} AfroX</div>
              
              {/* Claim Type Selection */}
              <div className="mb-4">
                <div className="text-sm text-gray-300 mb-2 font-semibold">Choose Claim Method:</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setClaimType('instant')}
                    className={`p-3 rounded border-2 transition-all ${
                      claimType === 'instant' 
                        ? 'border-orange-500 bg-orange-500/10' 
                        : 'border-gray-700 bg-gray-800'
                    }`}
                  >
                    <div className="font-semibold text-sm">⚡ Instant Claim</div>
                    <div className="text-xs text-gray-400 mt-1">Pay gas fee now</div>
                  </button>
                  
                  <button
                    onClick={() => setClaimType('gasless')}
                    className={`p-3 rounded border-2 transition-all ${
                      claimType === 'gasless' 
                        ? 'border-green-500 bg-green-500/10' 
                        : 'border-gray-700 bg-gray-800'
                    }`}
                  >
                    <div className="font-semibold text-sm">🎁 Gasless Claim</div>
                    <div className="text-xs text-gray-400 mt-1">Bulk distribution on 7th</div>
                  </button>
                </div>
              </div>

              {claimType === 'gasless' && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-gray-300">
                  <strong>📅 Gasless Claim Schedule:</strong>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>• Click claim between <strong>1st-6th</strong> of any month</li>
                    <li>• Your claim will be marked as &quot;Claimed - Pending Distribution&quot;</li>
                    <li>• All pending claims distributed on the <strong>7th</strong> in one bulk transaction</li>
                    <li>• System pays gas fees, saving you money! 💰</li>
                  </ul>
                </div>
              )}
              
              <button
                onClick={claimCommissions}
                disabled={loading}
                className={`w-full py-3 rounded font-semibold disabled:opacity-50 ${
                  claimType === 'instant'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {loading ? 'Processing...' : claimType === 'instant' ? 'Claim Now (Pay Gas)' : 'Add to Claim Queue (Gasless)'}
              </button>
            </div>
            
            <div className="text-xs text-gray-400">
              ✓ You meet the minimum staking requirement for {currentBadge.name} tier ({currentBadge.threshold})
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
            <p>Commissions become claimable 30 days after your referred user stakes tokens. The commission is triggered automatically after 30 days, regardless of whether the referred user has claimed their rewards or not. Stakers can choose to leave rewards in the system.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🎯 Eligibility Requirements</h3>
            <p>You must maintain the minimum staking requirement for your badge tier when commissions are triggered. If your stake falls below your tier&apos;s minimum, you can only claim from the levels available at your reduced tier.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">💰 Gasless Claim Option</h3>
            <p>Choose between instant claim (pay gas yourself) or gasless claim. With gasless, submit your claim between the 1st-6th of any month, and receive your rewards on the 7th via bulk distribution. The system pays all gas fees!</p>
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
