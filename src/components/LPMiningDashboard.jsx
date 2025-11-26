// src/components/LPMiningDashboard.jsx - COMPLETE FIXED VERSION
// FIXED: Rewards calculated from AfroX VALUE in LP position, not LP token count
// FIXED: Instant bonus shows billions of AfroX, not tiny decimals
// FIXED: USD values showing everywhere
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { formatUSD, calculateUSDValue } from '../lib/priceUtils';

// ERC20/LP Pair ABI
const LP_ABI = [
  { inputs: [{ type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getReserves', outputs: [{ type: 'uint112' }, { type: 'uint112' }, { type: 'uint32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' }
];

export default function LPMiningDashboard({ afroxPrice }) {
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

  // Lock options with rewards based on AfroX VALUE in LP
  // Instant Bonus: 5% of AfroX value (claimable after 7 days)
  // Mining Bonus: Additional % based on lock duration
  // Total APY = Instant + Mining
  const lockOptions = useMemo(() => [
    { days: 30, label: '30 Days', instantBonusPct: 5, miningBonusPct: 5, totalApy: 10 },
    { days: 60, label: '60 Days', instantBonusPct: 5, miningBonusPct: 12, totalApy: 17 },
    { days: 90, label: '90 Days', instantBonusPct: 5, miningBonusPct: 20, totalApy: 25 },
    { days: 180, label: '180 Days', instantBonusPct: 5, miningBonusPct: 67, totalApy: 72 },
    { days: 365, label: '365 Days', instantBonusPct: 5, miningBonusPct: 150, totalApy: 155 }
  ], []);

  // Load LP data with multiple fallback methods
  const loadLPData = useCallback(async () => {
    if (!address || !isConnected || !publicClient) return;

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Loading LP data...');
      console.log('📍 Address:', address);
      console.log('📍 LP Pair:', AFROX_WETH_PAIR);
      console.log('📍 AfroX Token:', AFROX_TOKEN);

      if (!AFROX_WETH_PAIR) {
        setError('LP Pair address not configured. Please check NEXT_PUBLIC_LP_PAIR_ADDRESS');
        setLpTokens([]);
        return;
      }

      // Try to read LP balance
      let balance = 0n;
      try {
        balance = await publicClient.readContract({
          address: AFROX_WETH_PAIR,
          abi: LP_ABI,
          functionName: 'balanceOf',
          args: [address]
        });
        console.log('✅ LP Balance (raw):', balance.toString());
      } catch (balanceError) {
        console.error('❌ Failed to read LP balance:', balanceError);
        setError('Failed to read LP balance. Check if LP pair address is correct.');
        setLpTokens([]);
        return;
      }

      if (balance > 0n) {
        try {
          // Get pair details
          const [token0, token1, reserves, totalSupply, decimals] = await Promise.all([
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'token0' }),
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'token1' }),
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'getReserves' }),
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'totalSupply' }),
            publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'decimals' }).catch(() => 18)
          ]);

          console.log('✅ Token0:', token0);
          console.log('✅ Token1:', token1);
          console.log('✅ Reserves:', reserves[0].toString(), reserves[1].toString());
          console.log('✅ Total Supply:', totalSupply.toString());

          const userBalance = Number(balance);
          const totalSupplyNum = Number(totalSupply);
          const userShare = totalSupplyNum > 0 ? userBalance / totalSupplyNum : 0;

          // Determine which token is AfroX (4 decimals) and which is WETH (18 decimals)
          const isAfroXToken0 = AFROX_TOKEN && token0.toLowerCase() === AFROX_TOKEN.toLowerCase();
          
          // AfroX has 4 decimals, WETH has 18
          const afroxReserve = Number(isAfroXToken0 ? reserves[0] : reserves[1]) / 1e4;
          const wethReserve = Number(isAfroXToken0 ? reserves[1] : reserves[0]) / 1e18;

          // USER'S AfroX in the LP position - THIS IS WHAT REWARDS ARE BASED ON
          const userAfroX = afroxReserve * userShare;
          const userWETH = wethReserve * userShare;

          console.log('✅ User Share:', (userShare * 100).toFixed(6) + '%');
          console.log('✅ User AfroX in LP:', userAfroX);
          console.log('✅ User WETH in LP:', userWETH);

          // Calculate USD values
          const ethPrice = 3000; // Approximate
          const afroxValueUSD = afroxPrice ? userAfroX * afroxPrice : 0;
          const wethValueUSD = userWETH * ethPrice;
          const totalValueUSD = afroxValueUSD + wethValueUSD;

          console.log('✅ Total Value USD:', totalValueUSD);

          const lpBalanceHuman = Number(formatUnits(balance, Number(decimals)));

          setLpTokens([{
            address: AFROX_WETH_PAIR,
            balance: lpBalanceHuman,
            balanceFormatted: formatUnits(balance, Number(decimals)),
            balanceRaw: balance,
            pairName: 'AfroX-WETH',
            symbol: 'UNI-V2',
            decimals: Number(decimals),
            dex: 'Uniswap V2',
            userAfroX,        // User's AfroX VALUE in the LP - used for reward calculations
            userWETH,
            afroxValueUSD,
            wethValueUSD,
            totalValueUSD,
            shareOfPool: userShare * 100,
            // Store ratio for calculating rewards when user enters amount
            afroxPerLP: lpBalanceHuman > 0 ? userAfroX / lpBalanceHuman : 0
          }]);

        } catch (detailsError) {
          console.error('❌ Failed to get pair details:', detailsError);
          // Still show basic LP balance even if details fail
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
        console.log('ℹ️ No LP tokens found for this address');
        setLpTokens([]);
      }

      // Sample leaderboard
      setLeaderboard([
        { rank: 1, wallet: '0x1234...5678', totalLP: '500000', rewards: '45000000000' },
        { rank: 2, wallet: '0x8765...4321', totalLP: '350000', rewards: '28000000000' },
        { rank: 3, wallet: '0xabcd...ef01', totalLP: '250000', rewards: '19500000000' }
      ]);

    } catch (error) {
      console.error('❌ Error loading LP data:', error);
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

  // Calculate rewards based on AfroX VALUE in the LP position
  const calculateRewards = useCallback((afroxValue, days) => {
    const option = lockOptions.find(opt => opt.days === days);
    if (!option) return { instant: 0, mining: 0, total: 0, referrerBonus: 0 };
    
    // Calculate rewards based on AfroX VALUE
    const instantBonus = afroxValue * (option.instantBonusPct / 100);      // 5% of AfroX value
    const miningReward = afroxValue * (option.miningBonusPct / 100);       // Variable based on duration
    const totalReward = afroxValue * (option.totalApy / 100);             // Total APY
    const referrerBonus = instantBonus / 2;                                // Referrer gets 50% of instant bonus
    
    return {
      instant: instantBonus,
      mining: miningReward,
      total: totalReward,
      referrerBonus: referrerBonus
    };
  }, [lockOptions]);

  // Current rewards calculation
  const rewards = useMemo(() => {
    let afroxValue = 0;
    
    if (lockAmount && selectedToken) {
      // Calculate based on entered LP amount
      afroxValue = getAfroxValueFromLP(lockAmount);
    } else if (selectedToken) {
      // Show rewards for full balance if no amount entered
      afroxValue = selectedToken.userAfroX || 0;
    }
    
    const rewardCalc = calculateRewards(afroxValue, lockDuration);
    return {
      ...rewardCalc,
      afroxValue
    };
  }, [lockAmount, lockDuration, selectedToken, calculateRewards, getAfroxValueFromLP]);

  function prettyNumber(num, decimals = 2) {
    const n = Number(num || 0);
    if (n >= 1e12) return (n / 1e12).toFixed(decimals) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
    return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };
  const selectedOption = lockOptions.find(opt => opt.days === lockDuration);

  if (!isConnected) {
    return (
      <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
        <p className="text-gray-300">Connect to access LP Token Lock-Mining</p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">LP Token Lock-Mining Dashboard</h1>
        <p className="text-gray-400">Lock LP tokens and earn mining rewards + instant bonuses based on your AfroX value</p>
      </div>

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
          <div className="text-xs text-gray-500 mt-1">Your WETH in pool</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Share of Pool</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {lpTokens[0]?.shareOfPool ? `${lpTokens[0].shareOfPool.toFixed(6)}%` : '0%'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Your pool ownership</div>
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

            {/* Rewards Breakdown - Based on AfroX VALUE */}
            <div className="bg-gray-800/50 p-4 rounded-lg mb-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-3">
                🎁 Rewards Breakdown (Based on {prettyNumber(rewards.afroxValue)} AfroX)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Lock Duration:</span>
                  <span className="font-bold text-white">{lockDuration} days</span>
                </div>
                
                {/* INSTANT BONUS - 5% of AfroX value */}
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

                {/* REFERRER BONUS */}
                <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <div className="flex justify-between items-start">
                    <span className="text-purple-400 font-semibold">👥 Your Referrer Gets:</span>
                    <div className="text-right">
                      <span className="font-bold text-purple-400 text-lg">{prettyNumber(rewards.referrerBonus)} AfroX</span>
                      {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(rewards.referrerBonus, afroxPrice))}</div>}
                    </div>
                  </div>
                  <div className="text-xs text-purple-400 mt-2">✓ Claimable after 7 days</div>
                </div>
                
                {/* MINING REWARD */}
                <div className="flex justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
                  <span className="text-blue-400 font-semibold">⛏️ Mining Reward ({selectedOption?.miningBonusPct}%):</span>
                  <div className="text-right">
                    <span className="font-bold text-blue-400 text-lg">{prettyNumber(rewards.mining)} AfroX</span>
                    {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(rewards.mining, afroxPrice))}</div>}
                  </div>
                </div>
                <div className="text-xs text-blue-400 pl-2">↳ Released at unlock ({lockDuration} days)</div>
                
                {/* TOTAL */}
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

      {/* Leaderboard */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">🏆 LP Mining Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((item) => (
            <div key={item.rank} className="flex items-center justify-between p-3 bg-gray-800 rounded">
              <div className="flex items-center gap-3">
                <div className={`text-lg font-bold ${item.rank === 1 ? 'text-yellow-400' : 'text-gray-400'}`}>#{item.rank}</div>
                <span className="text-sm">{item.wallet}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-400">{prettyNumber(item.totalLP)} LP</div>
                <div className="text-xs text-green-400">{prettyNumber(item.rewards)} AfroX earned</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* How It Works */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">How LP Token Lock-Mining Works</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🔒 Lock Your LP Tokens</h3>
            <p>Deposit Uniswap/SushiSwap LP tokens for 30-365 days. Rewards are calculated based on your <strong>AfroX value</strong> in the LP position!</p>
          </div>
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🎁 Instant Bonus (5%)</h3>
            <p>Receive <strong>5% of your AfroX value</strong> as instant bonus. Claimable after 7 days. Your referrer also gets half!</p>
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
    </div>
  );
}
