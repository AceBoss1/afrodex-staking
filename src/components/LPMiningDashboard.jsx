// src/components/LPMiningDashboard.jsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, parseUnits } from 'viem';
import { getAfroxPriceUSD, formatUSD, calculateUSDValue } from '../lib/priceUtils';

// LP Pair ABI for reading balances
const PAIR_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

// Known DEX Factory addresses (add your specific DEXs)
const DEX_FACTORIES = {
  uniswap: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  sushiswap: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  // Add more as needed
};

// The Graph Subgraph URLs
const SUBGRAPH_URLS = {
  uniswap: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  sushiswap: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
};

export default function LPMiningDashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [lpTokens, setLpTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [lockDuration, setLockDuration] = useState(30);
  const [lockAmount, setLockAmount] = useState('');
  const [lockedPositions, setLockedPositions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('lock'); // 'lock' or 'positions'
  const [afroxPrice, setAfroxPrice] = useState(null);

  // Get from environment variables
  const AFROX_WETH_PAIR = process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS;
  const AFROX_TOKEN = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS;

// Lock duration options with APY (wrapped in useMemo)
const lockOptions = useMemo(() => [
  { days: 30, label: '30 Days', apy: 10, instantBonus: 5, miningBonus: 5 },
  { days: 60, label: '60 Days', apy: 17, instantBonus: 5, miningBonus: 12 },
  { days: 90, label: '90 Days', apy: 25, instantBonus: 5, miningBonus: 20 },
  { days: 180, label: '180 Days', apy: 72, instantBonus: 5, miningBonus: 67 },
  { days: 365, label: '365 Days', apy: 155, instantBonus: 5, miningBonus: 150 }
], []);

  // Fetch LP tokens from The Graph
  const fetchLPTokensFromSubgraph = useCallback(async (userAddress, afroxAddress) => {
    const query = `
      query GetLiquidityPositions($user: String!, $token: String!) {
        liquidityPositions(
          where: { 
            user: $user,
            liquidityTokenBalance_gt: "0"
          }
        ) {
          id
          liquidityTokenBalance
          pair {
            id
            token0 {
              id
              symbol
              decimals
            }
            token1 {
              id
              symbol
              decimals
            }
            reserve0
            reserve1
            totalSupply
          }
        }
      }
    `;

    try {
      const results = [];
      
      for (const [dex, url] of Object.entries(SUBGRAPH_URLS)) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              variables: { 
                user: userAddress.toLowerCase(),
                token: afroxAddress?.toLowerCase() || ''
              }
            })
          });

          const { data } = await response.json();
          
          if (data?.liquidityPositions) {
            // Filter for pairs containing AfroX token
            const afroxPairs = data.liquidityPositions.filter(pos => 
              pos.pair.token0.id.toLowerCase() === afroxAddress?.toLowerCase() ||
              pos.pair.token1.id.toLowerCase() === afroxAddress?.toLowerCase()
            );

            results.push(...afroxPairs.map(pos => ({
              ...pos,
              dex,
              pairAddress: pos.pair.id,
              pairName: `${pos.pair.token0.symbol}-${pos.pair.token1.symbol}`
            })));
          }
        } catch (err) {
          console.error(`Error fetching from ${dex}:`, err);
        }
      }

      return results;
    } catch (error) {
      console.error('Error fetching LP tokens:', error);
      return [];
    }
  }, []);

  // Fetch LP token balances directly from blockchain
  const fetchLPBalancesOnChain = useCallback(async (userAddress, knownPairs) => {
    if (!publicClient) return [];

    const balances = [];

    for (const pair of knownPairs) {
      try {
        const balance = await publicClient.readContract({
          address: pair.address,
          abi: PAIR_ABI,
          functionName: 'balanceOf',
          args: [userAddress]
        });

        if (balance > 0n) {
          const [totalSupply, reserves, token0Addr, token1Addr, pairName, decimals] = await Promise.all([
            publicClient.readContract({
              address: pair.address,
              abi: PAIR_ABI,
              functionName: 'totalSupply'
            }),
            publicClient.readContract({
              address: pair.address,
              abi: PAIR_ABI,
              functionName: 'getReserves'
            }),
            publicClient.readContract({
              address: pair.address,
              abi: PAIR_ABI,
              functionName: 'token0'
            }),
            publicClient.readContract({
              address: pair.address,
              abi: PAIR_ABI,
              functionName: 'token1'
            }),
            publicClient.readContract({
              address: pair.address,
              abi: PAIR_ABI,
              functionName: 'symbol'
            }),
            publicClient.readContract({
              address: pair.address,
              abi: PAIR_ABI,
              functionName: 'decimals'
            })
          ]);

          // Get token symbols
          const [token0Symbol, token1Symbol] = await Promise.all([
            publicClient.readContract({
              address: token0Addr,
              abi: ERC20_ABI,
              functionName: 'symbol'
            }),
            publicClient.readContract({
              address: token1Addr,
              abi: ERC20_ABI,
              functionName: 'symbol'
            })
          ]);

          balances.push({
            address: pair.address,
            balance: formatUnits(balance, decimals),
            pairName: `${token0Symbol}-${token1Symbol}`,
            symbol: pairName,
            decimals: Number(decimals),
            dex: pair.dex || 'Unknown',
            token0: token0Addr,
            token1: token1Addr,
            reserves: {
              reserve0: reserves[0],
              reserve1: reserves[1]
            },
            totalSupply: formatUnits(totalSupply, decimals)
          });
        }
      } catch (err) {
        console.error(`Error fetching balance for ${pair.address}:`, err);
      }
    }

    return balances;
  }, [publicClient]);

  // Load all LP data
  const loadLPData = useCallback(async () => {
    if (!address || !isConnected) return;

    setLoading(true);
    try {
      // Fetch AfroX price first
      const priceData = await getAfroxPriceUSD(publicClient, AFROX_WETH_PAIR);
      if (priceData) {
        setAfroxPrice(priceData.priceUSD);
      }

      // Known AfroX LP pairs (add your specific pair)
      const knownPairs = [
        { 
          address: AFROX_WETH_PAIR, 
          dex: 'Uniswap V2',
          token0: AFROX_TOKEN,
          token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
          name: 'AfroX-WETH'
        }
      ];

      // Fetch balances directly from pair contract
      const onChainBalances = await fetchLPBalancesOnChain(address, knownPairs);
      
      if (onChainBalances.length > 0) {
        // Calculate USD values
        const balancesWithUSD = onChainBalances.map(balance => {
          // Get AfroX amount from reserves
          const isAfroXToken0 = balance.token0.toLowerCase() === AFROX_TOKEN.toLowerCase();
          const afroxReserve = isAfroXToken0 ? balance.reserves.reserve0 : balance.reserves.reserve1;
          const wethReserve = isAfroXToken0 ? balance.reserves.reserve1 : balance.reserves.reserve0;
          
          // Calculate user's share
          const userShare = Number(balance.balance) / Number(balance.totalSupply);
          const userAfroX = (Number(afroxReserve) / 1e18) * userShare; // Assuming 18 decimals
          const userWETH = (Number(wethReserve) / 1e18) * userShare;
          
          // Calculate USD value
          const afroxValueUSD = priceData ? userAfroX * priceData.priceUSD : 0;
          const wethValueUSD = userWETH * 3000; // Approximate ETH price
          const totalValueUSD = afroxValueUSD + wethValueUSD;

          return {
            ...balance,
            userAfroX,
            userWETH,
            afroxValueUSD,
            wethValueUSD,
            totalValueUSD,
            shareOfPool: userShare * 100
          };
        });
        
        setLpTokens(balancesWithUSD);
      } else {
        // Fallback: Try The Graph subgraphs
        const subgraphData = await fetchLPTokensFromSubgraph(address, AFROX_TOKEN);
        if (subgraphData.length > 0) {
          setLpTokens(subgraphData);
        }
      }

      // Load positions from Supabase or contract
      // TODO: Implement when smart contract is ready

    } catch (error) {
      console.error('Error loading LP data:', error);
    } finally {
      setLoading(false);
    }
}, [address, isConnected, publicClient, fetchLPTokensFromSubgraph, fetchLPBalancesOnChain, AFROX_TOKEN, AFROX_WETH_PAIR]);

  useEffect(() => {
    loadLPData();
  }, [loadLPData]);

  // Calculate rewards breakdown
  const calculateRewards = useCallback((amount, days) => {
    const option = lockOptions.find(opt => opt.days === days);
    if (!option) return { instant: 0, mining: 0, total: 0 };

    const amt = Number(amount || 0);
    const instantBonus = amt * (option.instantBonus / 100);
    const miningRewards = amt * (option.miningBonus / 100);
    const total = amt * (option.apy / 100);

    return {
      instant: instantBonus,
      mining: miningRewards,
      total: total
    };
  }, [lockOptions]);

  const rewards = calculateRewards(lockAmount, lockDuration);

  // Lock LP tokens (placeholder - needs smart contract)
  async function handleLockLP() {
    if (!selectedToken || !lockAmount) {
      alert('Please select an LP token and enter amount');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement smart contract interaction
      alert('Lock functionality will be implemented with smart contract');
      
      // This would be something like:
      // 1. Approve LP token spending
      // 2. Call lock function on your contract
      // 3. Refresh data
      
      await loadLPData();
    } catch (error) {
      console.error('Lock error:', error);
      alert('Failed to lock LP tokens');
    } finally {
      setLoading(false);
    }
  }

  // Early unlock (placeholder)
  async function handleEarlyUnlock(positionId) {
    if (!confirm('Early unlock incurs a 15% penalty. Continue?')) return;

    setLoading(true);
    try {
      // TODO: Implement contract call
      alert('Unlock functionality will be implemented with smart contract');
      await loadLPData();
    } catch (error) {
      console.error('Unlock error:', error);
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
          <p className="text-gray-300">Please connect your wallet to access LP Token Lock-Mining</p>
        </div>
      </div>
    );
  }

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
          <div className="text-2xl font-bold text-orange-400 mt-1">
            {lpTokens.length > 0 ? `${prettyNumber(lpTokens[0]?.balance || 0, 6)} LP` : '0 LP'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {lpTokens.length > 0 && lpTokens[0]?.totalValueUSD ? 
              `≈ ${formatUSD(lpTokens[0].totalValueUSD)}` : 
              'Available to lock'}
          </div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Deposited AfroX</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {lpTokens.length > 0 && lpTokens[0]?.userAfroX ? 
              `${prettyNumber(lpTokens[0].userAfroX)} AfroX` : 
              '0 AfroX'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {lpTokens.length > 0 && lpTokens[0]?.afroxValueUSD ? 
              `≈ ${formatUSD(lpTokens[0].afroxValueUSD)}` : 
              'Your AfroX in pool'}
          </div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Deposited WETH</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {lpTokens.length > 0 && lpTokens[0]?.userWETH ? 
              `${lpTokens[0].userWETH.toFixed(4)} WETH` : 
              '0 WETH'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {lpTokens.length > 0 && lpTokens[0]?.wethValueUSD ? 
              `≈ ${formatUSD(lpTokens[0].wethValueUSD)}` : 
              'Your WETH in pool'}
          </div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Share of Pool</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {lpTokens.length > 0 && lpTokens[0]?.shareOfPool ? 
              `${lpTokens[0].shareOfPool.toFixed(2)}%` : 
              '0%'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Your pool ownership</div>
        </motion.div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveView('lock')}
          className={`px-4 py-2 rounded ${activeView === 'lock' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}
        >
          🔒 Lock LP Tokens
        </button>
        <button
          onClick={() => setActiveView('positions')}
          className={`px-4 py-2 rounded ${activeView === 'positions' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}
        >
          📊 My Positions
        </button>
      </div>

      {activeView === 'lock' && (
        <>
          {/* Lock Duration Selection */}
          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">Select Lock Duration</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {lockOptions.map((option) => (
                <div
                  key={option.days}
                  onClick={() => setLockDuration(option.days)}
                  className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                    lockDuration === option.days
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-orange-500/50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-400">{option.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{option.days === 30 ? '1 Month' : option.days === 60 ? '2 Months' : option.days === 90 ? '3 Months' : option.days === 180 ? '6 Months' : '1 Year'} Lock</div>
                    <div className="text-sm font-bold text-green-400 mt-2">APY: {option.apy}%</div>
                    <div className="text-[10px] text-gray-500 mt-1">Instant: {option.instantBonus}% | Mining: {option.miningBonus}%</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Lock LP Tokens */}
          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">Lock LP Tokens</h2>
            
            {/* LP Token Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Select LP Token</label>
              <select
                value={selectedToken?.address || ''}
                onChange={(e) => {
                  const token = lpTokens.find(t => t.address === e.target.value);
                  setSelectedToken(token);
                }}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700"
              >
                <option value="">
                  {loading ? 'Loading LP tokens...' : lpTokens.length === 0 ? 'No AfroX LP tokens found' : 'Select an LP token'}
                </option>
                {lpTokens.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.pairName} ({token.dex}) - Balance: {prettyNumber(token.balance)} LP
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Amount to Lock</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={lockAmount}
                  onChange={(e) => setLockAmount(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 p-3 rounded bg-gray-800 text-white border border-gray-700"
                />
                <button
                  onClick={() => setLockAmount(selectedToken?.balance || '0')}
                  className="px-4 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Rewards Breakdown */}
            <div className="bg-gray-800/50 p-4 rounded-lg mb-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-3">🎁 Rewards Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Lock Duration:</span>
                  <span className="font-bold text-white">{lockDuration} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Instant Bonus (5%):</span>
                  <span className="font-bold text-green-400">{prettyNumber(rewards.instant, 6)} AfroX</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Mining Reward (at unlock):</span>
                  <span className="font-bold text-blue-400">{prettyNumber(rewards.mining, 6)} AfroX</span>
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-2">
                  <span className="text-gray-300 font-semibold">Total Rewards:</span>
                  <span className="font-bold text-orange-400">{prettyNumber(rewards.total, 6)} AfroX</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                💡 <strong>Pro Tip:</strong> Longer lock periods offer significantly higher APY. A 1-year lock earns 155% total rewards!
              </div>
            </div>

            <button
              onClick={handleLockLP}
              disabled={!selectedToken || !lockAmount || loading}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Lock LP Tokens'}
            </button>

            <div className="mt-4 text-xs text-gray-400">
              ⚠️ <strong>Early Unlock Penalty:</strong> Unlock early with a 10-20% penalty on rewards. Consider carefully!
            </div>
          </motion.div>
        </>
      )}

      {activeView === 'positions' && (
        <>
          {/* My Positions */}
          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">My Locked Positions</h2>
            
            {lockedPositions.length === 0 ? (
              <div className="text-center p-8 bg-gray-800 rounded">
                <div className="text-gray-400 mb-2">No locked positions yet</div>
                <div className="text-sm text-gray-500">Lock LP tokens to start earning rewards</div>
              </div>
            ) : (
              <div className="space-y-4">
                {lockedPositions.map((position, index) => (
                  <div key={index} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-lg font-bold text-orange-400">{position.amount} LP</div>
                        <div className="text-sm text-gray-400">{position.duration} days lock ({position.apy}% APY)</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">⏰ {position.daysRemaining}d remaining</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center p-2 bg-gray-900 rounded">
                        <div className="text-xs text-gray-400">Locked Date</div>
                        <div className="text-sm font-medium">{position.lockedDate}</div>
                      </div>
                      <div className="text-center p-2 bg-gray-900 rounded">
                        <div className="text-xs text-gray-400">Unlock Date</div>
                        <div className="text-sm font-medium">{position.unlockDate}</div>
                      </div>
                      <div className="text-center p-2 bg-gray-900 rounded">
                        <div className="text-xs text-gray-400">Instant Bonus</div>
                        <div className="text-sm font-medium text-green-400">{position.instantBonus} AfroX</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm text-gray-400">Mining Reward</div>
                        <div className="text-lg font-bold text-blue-400">{position.miningReward} AfroX</div>
                      </div>
                      {position.bonusClaimed ? (
                        <div className="text-sm text-gray-400">✓ Bonus Claimed</div>
                      ) : (
                        <button
                          onClick={() => handleEarlyUnlock(index)}
                          className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
                        >
                          Early Unlock (15% Penalty)
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Leaderboard */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">🏆 LP Mining Leaderboard</h2>
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((item) => (
              <div key={item.rank} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold text-orange-400">#{item.rank}</div>
                  <div className="text-sm font-medium">{item.wallet}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-400">{prettyNumber(item.totalLP)} LP</div>
                  <div className="text-xs text-green-400">{prettyNumber(item.rewards)} AfroX earned</div>
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
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🔒 Lock Your LP Tokens</h3>
            <p>Deposit Uniswap/SushiSwap LP tokens for 30-365 days. Longer locks earn higher rewards!</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🎁 Instant Bonus (5%)</h3>
            <p>Claim 5% bonus after 7 days. Your referrer also gets 5% - double rewards!</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">⛏️ Mining Rewards</h3>
            <p>Earn 5-150% mining rewards based on lock duration. Released at unlock.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">⚠️ Early Unlock</h3>
            <p>Need funds early? Unlock with 10-20% penalty on rewards. Consider carefully!</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
