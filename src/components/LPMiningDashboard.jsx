// src/components/LPMiningDashboard.jsx - COMPLETE FIXED VERSION
// FIXED: Real leaderboard from Supabase
// FIXED: Rewards based on AfroX value
// FIXED: Shared footer
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { formatUSD, calculateUSDValue } from '../lib/priceUtils';
import { getLPMiningLeaderboard } from '../lib/supabaseClient';
import { DashboardFooter } from './AfrodexStaking';

// ERC20/LP Pair ABI
const LP_ABI = [
  { inputs: [{ type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getReserves', outputs: [{ type: 'uint112' }, { type: 'uint112' }, { type: 'uint32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' }
];

export default function LPMiningDashboard({ afroxPrice, onNavigate }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [lpTokens, setLpTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [lockDuration, setLockDuration] = useState(30);
  const [lockAmount, setLockAmount] = useState('');
  const [lockedPositions, setLockedPositions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('lock');
  const [error, setError] = useState(null);

  const AFROX_WETH_PAIR = process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS;
  const AFROX_TOKEN = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS;

  const lockOptions = useMemo(() => [
    { days: 30, label: '30 Days', instantBonusPct: 5, miningBonusPct: 5, totalApy: 10 },
    { days: 60, label: '60 Days', instantBonusPct: 5, miningBonusPct: 12, totalApy: 17 },
    { days: 90, label: '90 Days', instantBonusPct: 5, miningBonusPct: 20, totalApy: 25 },
    { days: 180, label: '180 Days', instantBonusPct: 5, miningBonusPct: 67, totalApy: 72 },
    { days: 365, label: '365 Days', instantBonusPct: 5, miningBonusPct: 150, totalApy: 155 }
  ], []);

  // Load LP data
  const loadLPData = useCallback(async () => {
    if (!address || !isConnected || !publicClient) return;

    setLoading(true);
    setError(null);
    
    try {
      if (!AFROX_WETH_PAIR) {
        setError('LP Pair address not configured. Please check NEXT_PUBLIC_LP_PAIR_ADDRESS');
        setLpTokens([]);
        return;
      }

      let balance = 0n;
      try {
        balance = await publicClient.readContract({
          address: AFROX_WETH_PAIR,
          abi: LP_ABI,
          functionName: 'balanceOf',
          args: [address]
        });
      } catch (balanceError) {
        console.error('Failed to read LP balance:', balanceError);
        setError('Failed to read LP balance. Check if LP pair address is correct.');
        setLpTokens([]);
        return;
      }

      if (balance > 0n) {
        try {
          const [token0, token1, reserves, totalSupply, decimals] = await Promise.all([
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'token0' }),
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'token1' }),
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'getReserves' }),
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'totalSupply' }),
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'decimals' }).catch(() => 18)
          ]);

          const userBalance = Number(balance);
          const totalSupplyNum = Number(totalSupply);
          const userShare = totalSupplyNum > 0 ? userBalance / totalSupplyNum : 0;

          const isAfroXToken0 = AFROX_TOKEN && token0.toLowerCase() === AFROX_TOKEN.toLowerCase();
          const afroxReserve = Number(isAfroXToken0 ? reserves[0] : reserves[1]) / 1e4;
          const wethReserve = Number(isAfroXToken0 ? reserves[1] : reserves[0]) / 1e18;

          const userAfroX = afroxReserve * userShare;
          const userWETH = wethReserve * userShare;

          const ethPrice = 3000;
          const afroxValueUSD = afroxPrice ? userAfroX * afroxPrice : 0;
          const wethValueUSD = userWETH * ethPrice;
          const totalValueUSD = afroxValueUSD + wethValueUSD;

          const lpBalanceHuman = Number(formatUnits(balance, Number(decimals)));

          setLpTokens([{
            address: AFROX_WETH_PAIR,
            balance: lpBalanceHuman,
            balanceFormatted: formatUnits(balance, Number(decimals)),
            pairName: 'AfroX-WETH',
            symbol: 'UNI-V2',
            decimals: Number(decimals),
            dex: 'Uniswap V2',
            userAfroX,
            userWETH,
            afroxValueUSD,
            wethValueUSD,
            totalValueUSD,
            shareOfPool: userShare * 100,
            afroxPerLP: lpBalanceHuman > 0 ? userAfroX / lpBalanceHuman : 0
          }]);

        } catch (detailsError) {
          console.error('Failed to get pair details:', detailsError);
          setLpTokens([{
            address: AFROX_WETH_PAIR,
            balance: Number(formatUnits(balance, 18)),
            pairName: 'AfroX-WETH',
            symbol: 'LP',
            dex: 'Uniswap V2',
            userAfroX: 0,
            userWETH: 0,
            totalValueUSD: 0,
            shareOfPool: 0,
            afroxPerLP: 0
          }]);
        }
      } else {
        setLpTokens([]);
      }

      // Load REAL leaderboard from Supabase
      try {
        const leaderboardData = await getLPMiningLeaderboard(10);
        if (leaderboardData && leaderboardData.length > 0) {
          setLeaderboard(leaderboardData);
        } else {
          // No data yet - show empty state
          setLeaderboard([]);
        }
      } catch (lbError) {
        console.error('Error loading leaderboard:', lbError);
        setLeaderboard([]);
      }

    } catch (error) {
      console.error('Error loading LP data:', error);
      setError('Error loading LP data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, publicClient, AFROX_TOKEN, AFROX_WETH_PAIR, afroxPrice]);

  useEffect(() => {
    loadLPData();
  }, [loadLPData]);

  // Calculate AfroX value from LP amount
  const getAfroxValueFromLP = useCallback((lpAmount) => {
    if (!selectedToken || !lpAmount) return 0;
    const lpAmountNum = Number(lpAmount || 0);
    const afroxPerLP = selectedToken.afroxPerLP || 0;
    return lpAmountNum * afroxPerLP;
  }, [selectedToken]);

  // Calculate rewards based on AfroX VALUE
  const calculateRewards = useCallback((afroxValue, days) => {
    const option = lockOptions.find(opt => opt.days === days);
    if (!option) return { instant: 0, mining: 0, total: 0, referrerBonus: 0 };
    
    const instantBonus = afroxValue * (option.instantBonusPct / 100);
    const miningReward = afroxValue * (option.miningBonusPct / 100);
    const totalReward = afroxValue * (option.totalApy / 100);
    const referrerBonus = afroxValue * (option.instantBonusPct / 100); // Referrer gets same 5%
    
    return { instant: instantBonus, mining: miningReward, total: totalReward, referrerBonus };
  }, [lockOptions]);

  const rewards = useMemo(() => {
    let afroxValue = 0;
    if (lockAmount && selectedToken) {
      afroxValue = getAfroxValueFromLP(lockAmount);
    } else if (selectedToken) {
      afroxValue = selectedToken.userAfroX || 0;
    }
    const rewardCalc = calculateRewards(afroxValue, lockDuration);
    return { ...rewardCalc, afroxValue };
  }, [lockAmount, lockDuration, selectedToken, calculateRewards, getAfroxValueFromLP]);

  function prettyNumber(num, decimals = 2) {
    const n = Number(num || 0);
    if (n >= 1e12) return (n / 1e12).toFixed(decimals) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
    return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
  }

  function shortAddr(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'; }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };
  const selectedOption = lockOptions.find(opt => opt.days === lockDuration);

  if (!isConnected) {
    return (
      <div>
        <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-300">Connect to access LP Token Lock-Mining</p>
        </div>
        <DashboardFooter />
      </div>
    );
  }

  return (
    <div>
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-xl text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">LP Balance</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">
            {loading ? 'Loading...' : lpTokens.length > 0 ? `${Number(lpTokens[0]?.balance || 0).toFixed(8)} LP` : '0 LP'}
          </div>
          {lpTokens[0]?.totalValueUSD > 0 && (
            <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(lpTokens[0].totalValueUSD)}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">Available to lock</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Your AfroX in LP</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {lpTokens[0]?.userAfroX ? `${prettyNumber(lpTokens[0].userAfroX)} AfroX` : '0 AfroX'}
          </div>
          {lpTokens[0]?.afroxValueUSD > 0 && afroxPrice && (
            <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(lpTokens[0].afroxValueUSD)}</div>
          )}
          <div className="text-xs text-green-400 mt-1">Rewards based on this</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Your WETH in LP</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {lpTokens[0]?.userWETH ? `${lpTokens[0].userWETH.toFixed(6)} WETH` : '0 WETH'}
          </div>
          {lpTokens[0]?.wethValueUSD > 0 && (
            <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(lpTokens[0].wethValueUSD)}</div>
          )}
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Share of Pool</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {lpTokens[0]?.shareOfPool ? `${lpTokens[0].shareOfPool.toFixed(6)}%` : '0%'}
          </div>
        </motion.div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => setActiveView('lock')} className={`px-4 py-2 rounded ${activeView === 'lock' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
          🔒 Lock LP Tokens
        </button>
        <button onClick={() => setActiveView('positions')} className={`px-4 py-2 rounded ${activeView === 'positions' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>
          📊 My Positions
        </button>
        <button onClick={loadLPData} disabled={loading} className="px-4 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">
          🔄 Refresh
        </button>
      </div>

      {activeView === 'lock' && (
        <>
          {/* Lock Duration */}
          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">Select Lock Duration</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {lockOptions.map((option) => (
                <div
                  key={option.days}
                  onClick={() => setLockDuration(option.days)}
                  className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${lockDuration === option.days ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800 hover:border-orange-500/50'}`}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-400">{option.label}</div>
                    <div className="text-sm font-bold text-green-400 mt-2">APY: {option.totalApy}%</div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      Instant: {option.instantBonusPct}% | Mining: {option.miningBonusPct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Lock Form */}
          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">Lock LP Tokens</h2>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Select LP Token</label>
              <select
                value={selectedToken?.address || ''}
                onChange={(e) => setSelectedToken(lpTokens.find(t => t.address === e.target.value))}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700"
              >
                <option value="">
                  {loading ? 'Loading LP tokens...' : lpTokens.length === 0 ? 'No AfroX LP tokens found in wallet' : 'Select an LP token'}
                </option>
                {lpTokens.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.pairName} ({token.dex}) - {Number(token.balance).toFixed(8)} LP ({prettyNumber(token.userAfroX)} AfroX)
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Amount to Lock (LP Tokens)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={lockAmount}
                  onChange={(e) => setLockAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.00000001"
                  className="flex-1 p-3 rounded bg-gray-800 text-white border border-gray-700"
                />
                <button onClick={() => setLockAmount(String(selectedToken?.balance || '0'))} className="px-4 rounded bg-gray-700 text-sm">MAX</button>
              </div>
              {selectedToken && (
                <div className="text-xs text-blue-400 mt-2">
                  = {prettyNumber(rewards.afroxValue)} AfroX value being locked
                </div>
              )}
            </div>

            {/* Rewards Breakdown */}
            <div className="bg-gray-800/50 p-4 rounded-lg mb-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-3">
                🎁 Rewards Breakdown (Based on {prettyNumber(rewards.afroxValue)} AfroX)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Lock Duration:</span>
                  <span className="font-bold text-white">{lockDuration} days</span>
                </div>
                
                <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/30">
                  <div className="flex justify-between items-start">
                    <span className="text-green-400 font-semibold">⚡ Instant Bonus ({selectedOption?.instantBonusPct}%):</span>
                    <div className="text-right">
                      <span className="font-bold text-green-400 text-lg">{prettyNumber(rewards.instant)} AfroX</span>
                      {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(rewards.instant, afroxPrice))}</div>}
                    </div>
                  </div>
                  <div className="text-xs text-green-400 mt-2">✓ Claimable after 7 days</div>
                </div>

                <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <div className="flex justify-between items-start">
                    <span className="text-purple-400 font-semibold">👥 Your Referrer Gets ({selectedOption?.instantBonusPct}%):</span>
                    <div className="text-right">
                      <span className="font-bold text-purple-400 text-lg">{prettyNumber(rewards.referrerBonus)} AfroX</span>
                      {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(rewards.referrerBonus, afroxPrice))}</div>}
                    </div>
                  </div>
                  <div className="text-xs text-purple-400 mt-2">✓ Claimable after 7 days</div>
                </div>
                
                <div className="flex justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
                  <span className="text-blue-400 font-semibold">⛏️ Mining Reward ({selectedOption?.miningBonusPct}%):</span>
                  <div className="text-right">
                    <span className="font-bold text-blue-400 text-lg">{prettyNumber(rewards.mining)} AfroX</span>
                    {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(rewards.mining, afroxPrice))}</div>}
                  </div>
                </div>
                <div className="text-xs text-blue-400 pl-2">↳ Released at unlock ({lockDuration} days)</div>
                
                <div className="flex justify-between border-t border-gray-700 pt-3">
                  <span className="text-white font-bold">Total Rewards ({selectedOption?.totalApy}% APY):</span>
                  <div className="text-right">
                    <span className="font-bold text-orange-400 text-xl">{prettyNumber(rewards.total)} AfroX</span>
                    {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(rewards.total, afroxPrice))}</div>}
                  </div>
                </div>
              </div>
            </div>

            <button
              disabled={!selectedToken || !lockAmount || loading}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Lock LP Tokens'}
            </button>

            <div className="mt-4 text-xs text-gray-400">
              ⚠️ <strong>Early Unlock Penalty:</strong> 10-20% penalty on rewards if you unlock early.
            </div>
          </motion.div>
        </>
      )}

      {activeView === 'positions' && (
        <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
          <h2 className="text-xl font-bold mb-4">My Locked Positions</h2>
          {lockedPositions.length === 0 ? (
            <div className="text-center p-8 bg-gray-800 rounded">
              <div className="text-4xl mb-3">🔓</div>
              <div className="text-gray-400 mb-2">No locked positions yet</div>
              <div className="text-sm text-gray-500">Lock LP tokens to start earning rewards</div>
            </div>
          ) : (
            <div className="space-y-4">
              {lockedPositions.map((pos, i) => (
                <div key={i} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  {/* Position details */}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Leaderboard - REAL DATA */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">🏆 LP Mining Leaderboard</h2>
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center gap-3">
                  <div className={`text-lg font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                    #{index + 1}
                  </div>
                  <span className="text-sm">{shortAddr(item.wallet_address || item.wallet)}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-400">{prettyNumber(item.total_lp_locked || item.totalLP)} LP</div>
                  <div className="text-xs text-green-400">{prettyNumber(item.total_rewards_earned || item.rewards)} AfroX earned</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-800 rounded text-gray-400">
            <div className="text-2xl mb-2">🏆</div>
            <div>No LP miners yet</div>
            <div className="text-sm text-gray-500 mt-1">Be the first to lock LP tokens and top the leaderboard!</div>
          </div>
        )}
      </motion.div>

      {/* How It Works */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">How LP Token Lock-Mining Works</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🔒 Lock Your LP Tokens</h3>
            <p>Deposit Uniswap LP tokens for 30-365 days. Rewards are calculated based on your <strong>AfroX value</strong> in the LP position!</p>
          </div>
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🎁 Instant Bonus (5%)</h3>
            <p>Receive <strong>5% of your AfroX value</strong> as instant bonus. Claimable after 7 days. Your referrer also gets <strong>5%</strong>!</p>
          </div>
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">⛏️ Mining Rewards</h3>
            <p>Earn 5-150% additional mining rewards based on lock duration. Released when you unlock.</p>
          </div>
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">⚠️ Early Unlock</h3>
            <p>Need funds early? Unlock with 10-20% penalty on rewards.</p>
          </div>
        </div>
      </motion.div>

      <DashboardFooter />
    </div>
  );
}
