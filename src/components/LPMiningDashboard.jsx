// src/components/LPMiningDashboard.jsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';

export default function LPMiningDashboard() {
  const { address, isConnected } = useAccount();
  
  const [lpBalance, setLpBalance] = useState('0');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [lockAmount, setLockAmount] = useState('');
  const [lockedPositions, setLockedPositions] = useState([]);
  const [totalLocked, setTotalLocked] = useState('0');
  const [totalRewardsEarned, setTotalRewardsEarned] = useState('0');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('lock'); // 'lock' or 'positions'

  // Lock duration options with APY and rewards
  const lockDurations = {
    30: { 
      days: 30, 
      instantBonus: 5, 
      miningReward: 5, 
      totalAPY: 10,
      description: '1 Month Lock'
    },
    60: { 
      days: 60, 
      instantBonus: 5, 
      miningReward: 12, 
      totalAPY: 17,
      description: '2 Months Lock'
    },
    90: { 
      days: 90, 
      instantBonus: 5, 
      miningReward: 30, 
      totalAPY: 35,
      description: '3 Months Lock'
    },
    180: { 
      days: 180, 
      instantBonus: 5, 
      miningReward: 70, 
      totalAPY: 75,
      description: '6 Months Lock'
    },
    365: { 
      days: 365, 
      instantBonus: 5, 
      miningReward: 150, 
      totalAPY: 155,
      description: '1 Year Lock'
    }
  };

  const loadLPData = useCallback(async () => {
    if (!isConnected || !address) return;
    
    setLoading(true);
    try {
      // TODO: Replace with actual contract calls
      // Mock data for now
      setLpBalance('5000.00');
      setTotalLocked('125000.00');
      setTotalRewardsEarned('8750.00');
      
      // Mock locked positions
      setLockedPositions([
        {
          id: 1,
          amount: '10000',
          duration: 90,
          lockDate: Date.now() - (30 * 24 * 60 * 60 * 1000),
          unlockDate: Date.now() + (60 * 24 * 60 * 60 * 1000),
          instantBonus: '500',
          miningReward: '3000',
          bonusClaimed: true,
          status: 'locked'
        }
      ]);
      
      // Mock leaderboard
      setLeaderboard([
        { rank: 1, wallet: '0x1234...5678', totalLocked: '500000', rewards: '45000' },
        { rank: 2, wallet: '0x8765...4321', totalLocked: '350000', rewards: '28000' },
        { rank: 3, wallet: '0xabcd...ef01', totalLocked: '250000', rewards: '19500' }
      ]);
      
    } catch (error) {
      console.error('Error loading LP data:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    loadLPData();
  }, [loadLPData]);

  async function lockLPTokens() {
    if (!isConnected || !lockAmount || Number(lockAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement contract interaction
      alert(`Locking ${lockAmount} LP tokens for ${selectedDuration} days`);
      await loadLPData();
    } catch (error) {
      console.error('Lock error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function claimBonus(positionId) {
    setLoading(true);
    try {
      // TODO: Implement bonus claim
      alert('Instant bonus claimed!');
      await loadLPData();
    } catch (error) {
      console.error('Claim bonus error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function unlockPosition(positionId, early = false) {
    setLoading(true);
    try {
      if (early) {
        const confirmed = window.confirm(
          'Early unlock will incur a 15% penalty on your rewards. Continue?'
        );
        if (!confirmed) {
          setLoading(false);
          return;
        }
      }
      
      // TODO: Implement unlock
      alert(early ? 'Position unlocked early (15% penalty applied)' : 'Position unlocked successfully!');
      await loadLPData();
    } catch (error) {
      console.error('Unlock error:', error);
    } finally {
      setLoading(false);
    }
  }

  function prettyNumber(num, decimals = 2) {
    const n = Number(num || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
    return n.toFixed(decimals);
  }

  function calculateRewards(amount, duration) {
    const amt = Number(amount || 0);
    const config = lockDurations[duration];
    
    return {
      instantBonus: (amt * config.instantBonus) / 100,
      miningReward: (amt * config.miningReward) / 100,
      total: (amt * config.totalAPY) / 100
    };
  }

  function getTimeRemaining(unlockDate) {
    const now = Date.now();
    const diff = unlockDate - now;
    
    if (diff <= 0) return 'Unlocked';
    
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-300">Please connect your wallet to access LP Token Lock-Mining</p>
        </div>
      </div>
    );
  }

  const selectedConfig = lockDurations[selectedDuration];
  const projectedRewards = calculateRewards(lockAmount, selectedDuration);

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">LP Token Lock-Mining Dashboard</h1>
        <p className="text-gray-400">Lock your LP tokens and earn mining rewards + instant bonuses</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">LP Balance</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{prettyNumber(lpBalance)} LP</div>
          <div className="text-xs text-gray-500 mt-1">Available to lock</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Total Locked</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{prettyNumber(totalLocked)} LP</div>
          <div className="text-xs text-gray-500 mt-1">Your locked positions</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Total Rewards</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{prettyNumber(totalRewardsEarned)} AfroX</div>
          <div className="text-xs text-gray-500 mt-1">Lifetime earnings</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Active Locks</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{lockedPositions.length}</div>
          <div className="text-xs text-gray-500 mt-1">Locked positions</div>
        </motion.div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('lock')}
          className={`px-4 py-2 rounded font-semibold ${
            activeTab === 'lock'
              ? 'bg-orange-600 text-black'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          🔒 Lock LP Tokens
        </button>
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 rounded font-semibold ${
            activeTab === 'positions'
              ? 'bg-orange-600 text-black'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          📊 My Positions
        </button>
      </div>

      {/* Lock LP Tokens Tab */}
      {activeTab === 'lock' && (
        <>
          {/* Lock Duration Selection */}
          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">Select Lock Duration</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(lockDurations).map(([days, config]) => (
                <button
                  key={days}
                  onClick={() => setSelectedDuration(Number(days))}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedDuration === Number(days)
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-orange-500/50'
                  }`}
                >
                  <div className="font-bold text-lg text-orange-400">{config.days} Days</div>
                  <div className="text-sm text-gray-400 mt-1">{config.description}</div>
                  <div className="text-xs text-green-400 mt-2 font-semibold">
                    APY: {config.totalAPY}%
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Instant: {config.instantBonus}% | Mining: {config.miningReward}%
                  </div>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Lock Amount Input */}
          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">Lock LP Tokens</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Amount to Lock</label>
                <div className="flex gap-2 mb-4">
                  <input
                    type="number"
                    value={lockAmount}
                    onChange={(e) => setLockAmount(e.target.value)}
                    placeholder="0.0"
                    className="flex-1 p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-orange-500 outline-none"
                  />
                  <button
                    onClick={() => setLockAmount(lpBalance)}
                    className="px-4 py-2 rounded bg-gray-800 border border-gray-700 hover:border-orange-500 text-sm"
                  >
                    MAX
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Lock Duration:</span>
                    <span className="text-white font-semibold">{selectedConfig.days} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Instant Bonus (7 days):</span>
                    <span className="text-green-400 font-semibold">
                      {prettyNumber(projectedRewards.instantBonus, 2)} AfroX ({selectedConfig.instantBonus}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Mining Reward (at unlock):</span>
                    <span className="text-blue-400 font-semibold">
                      {prettyNumber(projectedRewards.miningReward, 2)} AfroX ({selectedConfig.miningReward}%)
                    </span>
                  </div>
                  <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
                    <span className="text-gray-400">Total Rewards:</span>
                    <span className="text-orange-400 font-bold">
                      {prettyNumber(projectedRewards.total, 2)} AfroX ({selectedConfig.totalAPY}%)
                    </span>
                  </div>
                </div>

                <button
                  onClick={lockLPTokens}
                  disabled={loading || !lockAmount || Number(lockAmount) <= 0}
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Lock LP Tokens'}
                </button>
              </div>

              {/* Info Section */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold text-orange-400 mb-3">🎁 Rewards Breakdown</h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <div className="font-semibold text-green-400 mb-1">Instant Bonus (5%)</div>
                    <p className="text-xs">Claimable 7 days after lock. You AND your referrer both receive 5% of the AfroX value in the pool!</p>
                  </div>
                  
                  <div>
                    <div className="font-semibold text-blue-400 mb-1">Mining Rewards ({selectedConfig.miningReward}%)</div>
                    <p className="text-xs">Earned at unlock based on lock duration. Longer locks = higher rewards!</p>
                  </div>
                  
                  <div className="border-t border-gray-700 pt-2">
                    <div className="font-semibold text-orange-400 mb-1">⚠️ Early Unlock Penalty</div>
                    <p className="text-xs">Unlock early with a 10-20% penalty on rewards. Consider carefully!</p>
                  </div>

                  <div className="bg-orange-500/10 border border-orange-500/30 p-2 rounded text-xs">
                    <strong>💡 Pro Tip:</strong> Longer lock periods offer significantly higher APY. A 1-year lock earns 155% total rewards!
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* My Positions Tab */}
      {activeTab === 'positions' && (
        <>
          {lockedPositions.length > 0 ? (
            <div className="space-y-4 mb-6">
              {lockedPositions.map((position) => {
                const config = lockDurations[position.duration];
                const timeLeft = getTimeRemaining(position.unlockDate);
                const canClaimBonus = !position.bonusClaimed && (Date.now() - position.lockDate) >= (7 * 24 * 60 * 60 * 1000);
                const isUnlocked = Date.now() >= position.unlockDate;

                return (
                  <motion.div
                    key={position.id}
                    className="bg-gray-900 p-6 rounded-xl border border-orange-600/20"
                    whileHover={cardGlow}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-sm text-gray-400">Position #{position.id}</div>
                        <div className="text-2xl font-bold text-orange-400">
                          {prettyNumber(position.amount)} LP
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {config.days} days lock ({config.totalAPY}% APY)
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded text-sm font-semibold ${
                        isUnlocked
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {isUnlocked ? '✓ Unlocked' : `🔒 ${timeLeft}`}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-400">Locked Date</div>
                        <div className="text-sm font-semibold">
                          {new Date(position.lockDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Unlock Date</div>
                        <div className="text-sm font-semibold">
                          {new Date(position.unlockDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Instant Bonus</div>
                        <div className="text-sm font-semibold text-green-400">
                          {prettyNumber(position.instantBonus)} AfroX
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Mining Reward</div>
                        <div className="text-sm font-semibold text-blue-400">
                          {prettyNumber(position.miningReward)} AfroX
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {canClaimBonus && (
                        <button
                          onClick={() => claimBonus(position.id)}
                          className="flex-1 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold"
                        >
                          Claim Instant Bonus
                        </button>
                      )}
                      
                      {position.bonusClaimed && !isUnlocked && (
                        <div className="flex-1 py-2 rounded bg-gray-700 text-gray-400 text-center text-sm">
                          ✓ Bonus Claimed
                        </div>
                      )}

                      {isUnlocked ? (
                        <button
                          onClick={() => unlockPosition(position.id, false)}
                          className="flex-1 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                        >
                          Unlock & Claim Rewards
                        </button>
                      ) : (
                        <button
                          onClick={() => unlockPosition(position.id, true)}
                          className="flex-1 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
                        >
                          Early Unlock (15% Penalty)
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700 mb-6">
              <div className="text-gray-400 mb-2">No locked positions yet</div>
              <div className="text-sm text-gray-500">Lock LP tokens to start earning rewards</div>
              <button
                onClick={() => setActiveTab('lock')}
                className="mt-4 px-6 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white font-semibold"
              >
                Lock LP Tokens
              </button>
            </div>
          )}
        </>
      )}

      {/* Leaderboard */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">🏆 LP Mining Leaderboard</h2>
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center justify-between p-3 bg-gray-800 rounded"
              >
                <div className="flex items-center gap-3">
                  <div className={`text-lg font-bold ${
                    entry.rank === 1 ? 'text-yellow-400' :
                    entry.rank === 2 ? 'text-gray-300' :
                    entry.rank === 3 ? 'text-orange-400' :
                    'text-gray-500'
                  }`}>
                    #{entry.rank}
                  </div>
                  <div className="text-sm font-medium">
                    {entry.wallet}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-400">
                    {prettyNumber(entry.totalLocked)} LP
                  </div>
                  <div className="text-xs text-green-400">
                    {prettyNumber(entry.rewards)} AfroX earned
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-800 rounded text-gray-400">
            Leaderboard will be populated as users lock LP tokens
          </div>
        )}
      </motion.div>

      {/* How It Works */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">How LP Token Lock-Mining Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🔒 Lock Your LP Tokens</h3>
            <p>Deposit Uniswap/SushiSwap LP tokens for 30-365 days. Longer locks earn higher rewards!</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">🎁 Instant Bonus (5%)</h3>
            <p>Claim 5% bonus after 7 days. Your referrer also gets 5% - double rewards!</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-blue-400 mb-2">⛏️ Mining Rewards</h3>
            <p>Earn 5-150% mining rewards based on lock duration. Released at unlock.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-red-400 mb-2">⚠️ Early Unlock</h3>
            <p>Need funds early? Unlock with 10-20% penalty on your rewards.</p>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
