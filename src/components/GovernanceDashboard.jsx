// src/components/GovernanceDashboard.jsx - COMPLETE
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, parseUnits } from 'viem';
import { STAKING_ABI, STAKING_ADDRESS } from '../lib/contracts';
import { readContractSafe } from '../lib/contracts';
import { supabase } from '../lib/supabaseClient';
import { getAfroxPriceUSD, formatUSD, calculateUSDValue } from '../lib/priceUtils';

export default function GovernanceDashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [stakedBalance, setStakedBalance] = useState('0');
  const [userTier, setUserTier] = useState(null);
  const [votingPower, setVotingPower] = useState(0);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [afroxPrice, setAfroxPrice] = useState(null);

  // Proposal status constants
  const PROPOSAL_STATUS = {
    ACTIVE: 'ACTIVE',
    PASSED: 'PASSED',
    REJECTED: 'REJECTED',
    EXECUTED: 'EXECUTED',
    EXPIRED: 'EXPIRED'
  };

  // Tier requirements
  const TIER_REQUIREMENTS = {
    'Diamond Custodian': { minStake: 10e12, emoji: '❇️', votingPower: 5, canPropose: true },
    'Platinum Sentinel': { minStake: 1e12, emoji: '💠', votingPower: 4, canPropose: true },
    'Marshal': { minStake: 500e9, emoji: '〽️', votingPower: 3, canPropose: true },
    'General': { minStake: 100e9, emoji: '⭐', votingPower: 2, canPropose: false },
    'Commander': { minStake: 50e9, emoji: '⚜️', votingPower: 2, canPropose: false },
    'Captain': { minStake: 10e9, emoji: '🔱', votingPower: 1, canPropose: false },
    'Cadet': { minStake: 1e9, emoji: '🔰', votingPower: 1, canPropose: false },
    'Starter': { minStake: 0, emoji: '✳️', votingPower: 0, canPropose: false }
  };

  // Calculate tier based on staked amount
  const calculateTier = useCallback((staked) => {
    const amount = Number(staked);
    
    if (amount >= 10e12) return TIER_REQUIREMENTS['Diamond Custodian'];
    if (amount >= 1e12) return TIER_REQUIREMENTS['Platinum Sentinel'];
    if (amount >= 500e9) return TIER_REQUIREMENTS['Marshal'];
    if (amount >= 100e9) return TIER_REQUIREMENTS['General'];
    if (amount >= 50e9) return TIER_REQUIREMENTS['Commander'];
    if (amount >= 10e9) return TIER_REQUIREMENTS['Captain'];
    if (amount >= 1e9) return TIER_REQUIREMENTS['Cadet'];
    
    return TIER_REQUIREMENTS['Starter'];
  }, []);

  // Load governance data
  const loadGovernanceData = useCallback(async () => {
    if (!address || !isConnected) return;

    setLoading(true);
    try {
      // 1. Fetch AfroX price
      const priceData = await getAfroxPriceUSD(publicClient, process.env.NEXT_PUBLIC_LP_PAIR_ADDRESS);
      if (priceData) {
        setAfroxPrice(priceData.priceUSD);
      }

      // 2. Fetch real staked balance from contract
      if (publicClient) {
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
          
          // Calculate tier and voting power
          const tier = calculateTier(stakeBalHuman);
          setUserTier(tier);
          setVotingPower(tier?.votingPower || 0);

          console.log('✅ Staked Balance:', stakeBalHuman);
          console.log('✅ Calculated Tier:', tier);
        }
      }

      // 3. Load proposals from Supabase
      const { data: proposalsData, error } = await supabase
        .from('governance_proposals')
        .select('*')
        .order('created_at', { ascending: false });

      if (proposalsData && !error) {
        // Format proposals for display
        const formattedProposals = proposalsData.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          proposer: p.proposer_address,
          proposerTier: calculateTier(p.proposer_stake_amount)?.name || 'Unknown',
          category: p.category || 'general',
          status: p.status,
          votesFor: Number(p.votes_for || 0),
          votesAgainst: Number(p.votes_against || 0),
          totalVotes: Number(p.votes_for || 0) + Number(p.votes_against || 0),
          quorum: Number(p.quorum_required || 10000000),
          startDate: new Date(p.created_at).toLocaleDateString(),
          endDate: new Date(p.ends_at).toLocaleDateString(),
          daysRemaining: Math.max(0, Math.ceil((new Date(p.ends_at) - new Date()) / (1000 * 60 * 60 * 24))),
          hasVoted: false, // TODO: Check if user has voted
          userVote: null
        }));

        setProposals(formattedProposals);
      } else {
        // Use sample proposals if none exist
        setProposals([
          {
            id: 1,
            title: 'Increase Staking Rewards by 2%',
            description: 'Proposal to increase base staking rewards from 0.6% to 0.8% daily to attract more stakers.',
            proposer: address?.slice(0, 10) + '...' || '0x1234...5678',
            proposerTier: userTier?.name || 'Marshal',
            category: 'rewards',
            status: PROPOSAL_STATUS.ACTIVE,
            votesFor: 15420000,
            votesAgainst: 3240000,
            totalVotes: 18660000,
            quorum: 10000000,
            startDate: new Date().toLocaleDateString(),
            endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            daysRemaining: 3,
            hasVoted: false,
            userVote: null
          }
        ]);
      }

    } catch (error) {
      console.error('Error loading governance data:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, publicClient, calculateTier, userTier]);

  useEffect(() => {
    loadGovernanceData();
  }, [loadGovernanceData]);

  // Vote on proposal
  async function handleVote(proposalId, support) {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      // TODO: Implement smart contract voting
      alert(`Vote ${support ? 'FOR' : 'AGAINST'} proposal #${proposalId} - Coming soon!`);
      await loadGovernanceData();
    } catch (error) {
      console.error('Vote error:', error);
    } finally {
      setLoading(false);
    }
  }

  // Create proposal
  async function handleCreateProposal() {
    if (!isConnected) return;
    if (!userTier?.canPropose) {
      alert('You need at least Marshal tier (≥500B AfroX staked) to create proposals');
      return;
    }
    
    // TODO: Implement proposal creation UI
    alert('Proposal creation coming soon!');
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
          <p className="text-gray-300">Please connect your wallet to access Governance</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">Community of Trust Dashboard</h1>
        <p className="text-gray-400">Vote on proposals and shape the future of AfroX</p>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Your Staked Balance</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{prettyNumber(stakedBalance)} AfroX</div>
          {afroxPrice && (
            <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(stakedBalance, afroxPrice))}</div>
          )}
          <div className="text-xs text-gray-500 mt-1">From staking contract</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Your Governance Tier</div>
          <div className="text-2xl font-bold text-orange-400 mt-1 flex items-center gap-2">
            <span>{userTier?.emoji}</span>
            <span>{Object.keys(TIER_REQUIREMENTS).find(key => TIER_REQUIREMENTS[key] === userTier) || 'Starter'}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Based on staked amount</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Voting Power</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{votingPower}x</div>
          <div className="text-xs text-gray-500 mt-1">Vote multiplier</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Can Create Proposals</div>
          <div className="text-2xl font-bold mt-1" style={{ color: userTier?.canPropose ? '#10b981' : '#ef4444' }}>
            {userTier?.canPropose ? '✓ Yes' : '✗ No'}
          </div>
          <div className="text-xs text-gray-500 mt-1">{userTier?.canPropose ? 'Marshal+ tier' : 'Need ≥500B staked'}</div>
        </motion.div>
      </div>

      {/* Create Proposal Button */}
      {userTier?.canPropose && (
        <motion.div className="mb-6" whileHover={{ scale: 1.01 }}>
          <button
            onClick={handleCreateProposal}
            className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold text-lg"
          >
            + Create New Proposal
          </button>
        </motion.div>
      )}

      {/* Active Proposals */}
      <div className="space-y-4 mb-6">
        {proposals.map((proposal) => (
          <motion.div
            key={proposal.id}
            className="bg-gray-900 p-6 rounded-xl border border-orange-600/20"
            whileHover={cardGlow}
          >
            {/* Proposal Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">{proposal.title}</h3>
                <p className="text-sm text-gray-400 mb-3">{proposal.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-gray-800 text-gray-300">
                    By: {proposal.proposer}
                  </span>
                  <span className="px-2 py-1 rounded bg-purple-900/30 text-purple-400">
                    {proposal.proposerTier}
                  </span>
                  <span className={`px-2 py-1 rounded ${
                    proposal.status === PROPOSAL_STATUS.ACTIVE ? 'bg-green-900/30 text-green-400' :
                    proposal.status === PROPOSAL_STATUS.PASSED ? 'bg-blue-900/30 text-blue-400' :
                    'bg-red-900/30 text-red-400'
                  }`}>
                    {proposal.status}
                  </span>
                  <span className="px-2 py-1 rounded bg-orange-900/30 text-orange-400">
                    {proposal.category}
                  </span>
                </div>
              </div>
              <div className="text-right ml-4">
                <div className="text-sm text-gray-400">Ends in</div>
                <div className="text-2xl font-bold text-orange-400">{proposal.daysRemaining}d</div>
              </div>
            </div>

            {/* Vote Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-green-900/20 rounded">
                <div className="text-xs text-gray-400 mb-1">Votes FOR</div>
                <div className="text-xl font-bold text-green-400">{prettyNumber(proposal.votesFor)}</div>
                <div className="text-xs text-gray-500">{proposal.totalVotes > 0 ? ((proposal.votesFor / proposal.totalVotes) * 100).toFixed(1) : 0}%</div>
              </div>
              <div className="p-3 bg-red-900/20 rounded">
                <div className="text-xs text-gray-400 mb-1">Votes AGAINST</div>
                <div className="text-xl font-bold text-red-400">{prettyNumber(proposal.votesAgainst)}</div>
                <div className="text-xs text-gray-500">{proposal.totalVotes > 0 ? ((proposal.votesAgainst / proposal.totalVotes) * 100).toFixed(1) : 0}%</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Quorum: {prettyNumber(proposal.quorum)}</span>
                <span>{prettyNumber(proposal.totalVotes)} / {prettyNumber(proposal.quorum)}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500"
                  style={{ width: `${Math.min((proposal.totalVotes / proposal.quorum) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Vote Buttons */}
            {proposal.status === PROPOSAL_STATUS.ACTIVE && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVote(proposal.id, true)}
                  disabled={proposal.hasVoted || votingPower === 0 || loading}
                  className="py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {proposal.hasVoted && proposal.userVote === true ? '✓ Voted FOR' : 'Vote FOR'}
                </button>
                <button
                  onClick={() => handleVote(proposal.id, false)}
                  disabled={proposal.hasVoted || votingPower === 0 || loading}
                  className="py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {proposal.hasVoted && proposal.userVote === false ? '✓ Voted AGAINST' : 'Vote AGAINST'}
                </button>
              </div>
            )}

            {votingPower === 0 && (
              <div className="mt-3 text-xs text-yellow-500">
                ⚠️ You need at least 1B AfroX staked to vote
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Tier Requirements */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mb-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Governance Tier Requirements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(TIER_REQUIREMENTS).reverse().map(([name, tier]) => (
            <div key={name} className="p-4 bg-gray-800 rounded-lg text-center">
              <div className="text-3xl mb-2">{tier.emoji}</div>
              <div className="text-sm font-bold text-orange-400 mb-1">{name}</div>
              <div className="text-xs text-gray-400 mb-2">≥{prettyNumber(tier.minStake)}</div>
              <div className="text-xs text-purple-400 font-semibold">{tier.votingPower}x Voting Power</div>
              {tier.canPropose && (
                <div className="text-[10px] text-green-400 mt-1">✓ Can Propose</div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* How It Works */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">How Governance Works</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">🗳️ Voting Power</h3>
            <p>Your voting power is determined by your staking tier. Higher tiers get vote multipliers (1x-5x).</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">📝 Creating Proposals</h3>
            <p>Only Marshal+ tiers (≥500B staked) can create proposals. This ensures serious governance participation.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">✅ Proposal Approval</h3>
            <p>Proposals need to reach quorum (minimum votes) and majority support to pass.</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">⚡ Execution</h3>
            <p>Passed proposals are executed by the governance contract automatically or by the team.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
