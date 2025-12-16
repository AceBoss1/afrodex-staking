// src/components/LPMiningDashboard.jsx - COMPLETE FIXED VERSION
// FIXED: Real leaderboard data from Supabase (no mock data)
// FIXED: Rewards based on AfroX value
// FIXED: Referrer gets 5%
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { formatUSD, calculateUSDValue } from '../lib/priceUtils';
import { getLPMiningLeaderboard, getLPMiningPositions } from '../lib/supabaseClient';

const LP_ABI = [
  { inputs: [{ type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getReserves', outputs: [{ type: 'uint112' }, { type: 'uint112' }, { type: 'uint32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' }
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

  const lockOptions = useMemo(() => [
    { days: 30, label: '30 Days', instantBonusPct: 5, miningBonusPct: 13, totalApy: 18 },
    { days: 60, label: '60 Days', instantBonusPct: 5, miningBonusPct: 31, totalApy: 36 },
    { days: 90, label: '90 Days', instantBonusPct: 5, miningBonusPct: 49, totalApy: 54 },
    { days: 180, label: '180 Days', instantBonusPct: 5, miningBonusPct: 103, totalApy: 108 },
    { days: 365, label: '365 Days', instantBonusPct: 5, miningBonusPct: 211, totalApy: 216 }
  ], []);

  const loadLPData = useCallback(async () => {
    if (!address || !isConnected || !publicClient) return;
    setLoading(true);
    setError(null);
    
    try {
      if (!AFROX_WETH_PAIR) {
        setError('LP Pair address not configured');
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
      } catch (e) {
        setError('Failed to read LP balance');
        setLpTokens([]);
        return;
      }

      if (balance > 0n) {
        const [token0, reserves, totalSupply, decimals] = await Promise.all([
          publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'token0' }),
          publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'getReserves' }),
          publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'totalSupply' }),
          publicClient.readContract({ address: AFROX_WETH_PAIR, abi: LP_ABI, functionName: 'decimals' }).catch(() => 18)
        ]);

        const userShare = Number(balance) / Number(totalSupply);
        const isAfroXToken0 = AFROX_TOKEN && token0.toLowerCase() === AFROX_TOKEN.toLowerCase();
        const afroxReserve = Number(isAfroXToken0 ? reserves[0] : reserves[1]) / 1e4;
        const wethReserve = Number(isAfroXToken0 ? reserves[1] : reserves[0]) / 1e18;
        const userAfroX = afroxReserve * userShare;
        const userWETH = wethReserve * userShare;
        const lpBalanceHuman = Number(formatUnits(balance, Number(decimals)));

        setLpTokens([{
          address: AFROX_WETH_PAIR,
          balance: lpBalanceHuman,
          pairName: 'AfroX-WETH',
          dex: 'Uniswap V2',
          userAfroX,
          userWETH,
          afroxValueUSD: afroxPrice ? userAfroX * afroxPrice : 0,
          wethValueUSD: userWETH * 3000,
          totalValueUSD: (afroxPrice ? userAfroX * afroxPrice : 0) + (userWETH * 3000),
          shareOfPool: userShare * 100,
          afroxPerLP: lpBalanceHuman > 0 ? userAfroX / lpBalanceHuman : 0
        }]);
      } else {
        setLpTokens([]);
      }

      // Load REAL leaderboard from Supabase
      try {
        const data = await getLPMiningLeaderboard(10);
        if (data?.length > 0) {
          setLeaderboard(data.map((item, i) => ({
            rank: i + 1,
            wallet: item.wallet_address || item.wallet,
            totalLP: item.total_lp_locked || 0,
            rewards: item.total_rewards_earned || 0,
            afroxValue: item.afrox_value || 0
          })));
        } else {
          setLeaderboard([]);
        }
      } catch (e) {
        setLeaderboard([]);
      }

      // Load user positions
      try {
        const positions = await getLPMiningPositions(address);
        setLockedPositions(positions || []);
      } catch (e) {
        setLockedPositions([]);
      }

    } catch (e) {
      setError('Error loading data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, publicClient, AFROX_TOKEN, AFROX_WETH_PAIR, afroxPrice]);

  useEffect(() => { loadLPData(); }, [loadLPData]);

  const getAfroxValueFromLP = useCallback((lpAmount) => {
    if (!selectedToken || !lpAmount) return 0;
    return Number(lpAmount) * (selectedToken.afroxPerLP || 0);
  }, [selectedToken]);

  const calculateRewards = useCallback((afroxValue, days) => {
    const option = lockOptions.find(opt => opt.days === days);
    if (!option) return { instant: 0, mining: 0, total: 0, referrerBonus: 0 };
    return {
      instant: afroxValue * (option.instantBonusPct / 100),
      mining: afroxValue * (option.miningBonusPct / 100),
      total: afroxValue * (option.totalApy / 100),
      referrerBonus: afroxValue * (option.instantBonusPct / 100)
    };
  }, [lockOptions]);

  const rewards = useMemo(() => {
    let afroxValue = lockAmount && selectedToken ? getAfroxValueFromLP(lockAmount) : (selectedToken?.userAfroX || 0);
    return { ...calculateRewards(afroxValue, lockDuration), afroxValue };
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
      <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
        <p className="text-gray-300">Connect to access LP Token Lock-Mining</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-300">LP Token Lock-Mining Dashboard</h2>
        <p className="text-sm text-gray-500">Lock LP tokens and earn mining rewards + instant bonuses based on your AfroX value</p>
      </div>

      {error && <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-xl text-red-300">⚠️ {error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">LP Balance</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{loading ? 'Loading...' : lpTokens[0] ? `${Number(lpTokens[0].balance).toFixed(8)} LP` : '0 LP'}</div>
          {lpTokens[0]?.totalValueUSD > 0 && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(lpTokens[0].totalValueUSD)}</div>}
        </motion.div>
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Your AfroX in LP</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{lpTokens[0]?.userAfroX ? `${prettyNumber(lpTokens[0].userAfroX)} AfroX` : '0 AfroX'}</div>
          {lpTokens[0]?.afroxValueUSD > 0 && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(lpTokens[0].afroxValueUSD)}</div>}
          <div className="text-xs text-green-400 mt-1">Rewards based on this</div>
        </motion.div>
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Your WETH in LP</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{lpTokens[0]?.userWETH ? `${lpTokens[0].userWETH.toFixed(6)} WETH` : '0 WETH'}</div>
          {lpTokens[0]?.wethValueUSD > 0 && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(lpTokens[0].wethValueUSD)}</div>}
        </motion.div>
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Share of Pool</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{lpTokens[0]?.shareOfPool ? `${lpTokens[0].shareOfPool.toFixed(6)}%` : '0%'}</div>
        </motion.div>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={() => setActiveView('lock')} className={`px-4 py-2 rounded ${activeView === 'lock' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>🔒 Lock LP Tokens</button>
        <button onClick={() => setActiveView('positions')} className={`px-4 py-2 rounded ${activeView === 'positions' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>📊 My Positions</button>
        <button onClick={loadLPData} disabled={loading} className="px-4 py-2 rounded bg-gray-800 text-gray-300 hover:bg-gray-700">🔄 Refresh</button>
      </div>

      {activeView === 'lock' && (
        <>
          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">Select Lock Duration</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {lockOptions.map((option) => (
                <div key={option.days} onClick={() => setLockDuration(option.days)} className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${lockDuration === option.days ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800 hover:border-orange-500/50'}`}>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-400">{option.label}</div>
                    <div className="text-sm font-bold text-green-400 mt-2">APY: {option.totalApy}%</div>
                    <div className="text-[10px] text-gray-500 mt-1">Instant: {option.instantBonusPct}% | Mining: {option.miningBonusPct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
            <h2 className="text-xl font-bold mb-4">Lock LP Tokens</h2>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Select LP Token</label>
              <select value={selectedToken?.address || ''} onChange={(e) => setSelectedToken(lpTokens.find(t => t.address === e.target.value))} className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700">
                <option value="">{loading ? 'Loading...' : lpTokens.length === 0 ? 'No LP tokens found' : 'Select LP token'}</option>
                {lpTokens.map((token) => <option key={token.address} value={token.address}>{token.pairName} - {Number(token.balance).toFixed(8)} LP ({prettyNumber(token.userAfroX)} AfroX)</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Amount to Lock</label>
              <div className="flex gap-2">
                <input type="number" value={lockAmount} onChange={(e) => setLockAmount(e.target.value)} placeholder="0.0" step="0.00000001" className="flex-1 p-3 rounded bg-gray-800 text-white border border-gray-700" />
                <button onClick={() => setLockAmount(String(selectedToken?.balance || '0'))} className="px-4 rounded bg-gray-700 text-sm">MAX</button>
              </div>
              {selectedToken && <div className="text-xs text-blue-400 mt-2">= {prettyNumber(rewards.afroxValue)} AfroX value</div>}
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg mb-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-3">🎁 Rewards Breakdown (Based on {prettyNumber(rewards.afroxValue)} AfroX)</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Lock Duration:</span><span className="font-bold text-white">{lockDuration} days</span></div>
                <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/30">
                  <div className="flex justify-between"><span className="text-green-400 font-semibold">⚡ Instant Bonus ({selectedOption?.instantBonusPct}%):</span><span className="font-bold text-green-400 text-lg">{prettyNumber(rewards.instant)} AfroX</span></div>
                  {afroxPrice && <div className="text-xs text-gray-500 text-right">≈ {formatUSD(calculateUSDValue(rewards.instant, afroxPrice))}</div>}
                  <div className="text-xs text-green-400 mt-2">✓ Claimable after 7 days</div>
                </div>
                <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <div className="flex justify-between"><span className="text-purple-400 font-semibold">👥 Your Referrer Gets ({selectedOption?.instantBonusPct}%):</span><span className="font-bold text-purple-400 text-lg">{prettyNumber(rewards.referrerBonus)} AfroX</span></div>
                  {afroxPrice && <div className="text-xs text-gray-500 text-right">≈ {formatUSD(calculateUSDValue(rewards.referrerBonus, afroxPrice))}</div>}
                  <div className="text-xs text-purple-400 mt-2">✓ Claimable after 7 days</div>
                </div>
                <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
                  <div className="flex justify-between"><span className="text-blue-400 font-semibold">⛏️ Mining Reward ({selectedOption?.miningBonusPct}%):</span><span className="font-bold text-blue-400 text-lg">{prettyNumber(rewards.mining)} AfroX</span></div>
                  {afroxPrice && <div className="text-xs text-gray-500 text-right">≈ {formatUSD(calculateUSDValue(rewards.mining, afroxPrice))}</div>}
                </div>
                <div className="text-xs text-blue-400">↳ Released at unlock ({lockDuration} days)</div>
                <div className="flex justify-between border-t border-gray-700 pt-3">
                  <span className="text-white font-bold">Total Rewards ({selectedOption?.totalApy}% APY):</span>
                  <div className="text-right"><span className="font-bold text-orange-400 text-xl">{prettyNumber(rewards.total)} AfroX</span>{afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(rewards.total, afroxPrice))}</div>}</div>
                </div>
              </div>
            </div>
            <button disabled={!selectedToken || !lockAmount || loading} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold disabled:opacity-50">{loading ? 'Processing...' : 'Lock LP Tokens'}</button>
            <div className="mt-4 text-xs text-gray-400">⚠️ <strong>Early Unlock Penalty:</strong> 10-20% penalty on rewards if you unlock early.</div>
          </motion.div>
        </>
      )}

      {activeView === 'positions' && (
        <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
          <h2 className="text-xl font-bold mb-4">My Locked Positions</h2>
          {lockedPositions.length === 0 ? (
            <div className="text-center p-8 bg-gray-800 rounded"><div className="text-4xl mb-3">🔓</div><div className="text-gray-400">No locked positions yet</div></div>
          ) : (
            <div className="space-y-4">
              {lockedPositions.map((pos, i) => (
                <div key={i} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <div><span className="text-orange-400 font-semibold">{pos.lock_duration || pos.lockDuration} Days Lock</span><div className="text-xs text-gray-500">Locked: {new Date(pos.locked_at || pos.lockedAt).toLocaleDateString()}</div></div>
                    <span className={`px-2 py-1 rounded text-xs ${pos.status === 'locked' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{pos.status || 'Locked'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-400">LP Locked:</span><span className="ml-2">{Number(pos.lp_amount || 0).toFixed(8)}</span></div>
                    <div><span className="text-gray-400">AfroX Value:</span><span className="ml-2 text-blue-400">{prettyNumber(pos.afrox_value || 0)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* REAL Leaderboard */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">🏆 LP Mining Leaderboard</h2>
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((item) => (
              <div key={item.rank} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div className="flex items-center gap-3">
                  <div className={`text-lg font-bold ${item.rank === 1 ? 'text-yellow-400' : item.rank === 2 ? 'text-gray-300' : item.rank === 3 ? 'text-orange-600' : 'text-gray-500'}`}>#{item.rank}</div>
                  <span className="text-sm">{shortAddr(item.wallet)}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-400">{prettyNumber(item.afroxValue || item.totalLP)} {item.afroxValue ? 'AfroX' : 'LP'}</div>
                  <div className="text-xs text-green-400">{prettyNumber(item.rewards)} AfroX earned</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-800 rounded text-gray-400"><div className="text-2xl mb-2">🏆</div><div>No LP miners yet. Be the first!</div></div>
        )}
      </motion.div>

      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">How LP Token Lock-Mining Works</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div><h3 className="font-semibold text-orange-400 mb-2">🔒 Lock Your LP Tokens</h3><p>Deposit Uniswap LP tokens for 30-365 days. Rewards are based on your <strong>AfroX value</strong>!</p></div>
          <div><h3 className="font-semibold text-orange-400 mb-2">🎁 Instant Bonus (5%)</h3><p>Receive <strong>5%</strong> as instant bonus after 7 days. Your referrer also gets <strong>5%</strong>!</p></div>
          <div><h3 className="font-semibold text-orange-400 mb-2">⛏️ Mining Rewards</h3><p>Earn 13-211% additional mining rewards based on lock duration.</p></div>
          <div><h3 className="font-semibold text-orange-400 mb-2">⚠️ Early Unlock</h3><p>Need funds early? Unlock with 10-20% penalty on rewards.</p></div>
        </div>
      </motion.div>
    </div>
  );
}
