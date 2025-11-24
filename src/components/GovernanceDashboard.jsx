// src/components/GovernanceDashboard.jsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, parseUnits } from 'viem';
import { STAKING_ABI, AFROX_PROXY_ABI } from '../lib/abis';
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe } from '../lib/contracts';

// Governance roles and their requirements
const GOVERNANCE_TIERS = {
  'Diamond Custodian': {
    minStake: 10e12, // 10T
    emoji: '❇️',
    votingPower: 5,
    proposalPower: true,
    description: 'Supreme governance authority',
    color: 'from-cyan-400 to-blue-600'
  },
  'Platinum Sentinel': {
    minStake: 1e12, // 1T
    emoji: '💠',
    votingPower: 4,
    proposalPower: true,
    description: 'Elite decision makers',
    color: 'from-purple-400 to-pink-600'
  },
  'Marshal': {
    minStake: 500e9, // 500B
    emoji: '〽️',
    votingPower: 3,
    proposalPower: true,
    description: 'Senior community leaders',
    color: 'from-orange-400 to-red-600'
  },
  'General': {
    minStake: 100e9, // 100B
    emoji: '⭐',
    votingPower: 2,
    proposalPower: false,
    description: 'Trusted governors',
    color: 'from-yellow-400 to-orange-600'
  },
  'Commander': {
    minStake: 50e9, // 50B
    emoji: '⚜️',
    votingPower: 2,
    proposalPower: false,
    description: 'Active participants',
    color: 'from-green-400 to-teal-600'
  },
  'Captain': {
    minStake: 10e9, // 10B
    emoji: '🔱',
    votingPower: 1,
    proposalPower: false,
    description: 'Community members',
    color: 'from-blue-400 to-indigo-600'
  },
  'Cadet': {
    minStake: 1e9, // 1B
    emoji: '🔰',
    votingPower: 1,
    proposalPower: false,
    description: 'Entry-level governance',
    color: 'from-gray-400 to-gray-600'
  }
};

// Proposal states
const PROPOSAL_STATUS = {
  ACTIVE: 'Active',
  PASSED: 'Passed',
  REJECTED: 'Rejected',
  EXECUTED: 'Executed',
  EXPIRED: 'Expired'
};

export default function GovernanceDashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [stakedBalance, setStakedBalance] = useState('0');
  const [userTier, setUserTier] = useState(null);
  const [votingPower, setVotingPower] = useState(0);
  const [proposals, setProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    category: 'general',
    votingPeriod: 7
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('proposals'); // proposals, create, history

  // Calculate user's governance tier
  const calculateTier = useCallback((stakedAmount) => {
    const staked = Number(stakedAmount);
    
    for (const [tierName, tierData] of Object.entries(GOVERNANCE_TIERS)) {
      if (staked >= tierData.minStake) {
        return {
          name: tierName,
          ...tierData
        };
      }
    }
    
    return null;
  }, []);

  // Load governance data
  const loadGovernanceData = useCallback(async () => {
    if (!address || !isConnected || !publicClient) return;

    setLoading(true);
    try {
      // Fetch real staked balance from contract
      const stakeInfo = await readContractSafe(publicClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'viewStakeInfoOf',
        args: [address],
      });

      let actualStaked = '0';
      if (stakeInfo) {
        const stakeBalRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
        
        // Get decimals
        const decimalsRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_PROXY_ABI,
          functionName: 'decimals',
          args: [],
        });
        const decimals = decimalsRaw !== null ? Number(decimalsRaw) : 18;
        
        actualStaked = formatUnits(stakeBalRaw, decimals);
      }
      
      setStakedBalance(actualStaked);
      
      const tier = calculateTier(actualStaked);
      setUserTier(tier);
      setVotingPower(tier?.votingPower || 0);

      // Load mock proposals
      setProposals([
        {
          id: 1,
          title: 'Increase Staking Rewards by 2%',
          description: 'Proposal to increase base staking rewards from 0.6% to 0.8% daily to attract more stakers and increase liquidity.',
          proposer: '0x1234...5678',
          proposerTier: 'Marshal',
          category: 'rewards',
          status: PROPOSAL_STATUS.ACTIVE,
          votesFor: 15420000,
          votesAgainst: 3240000,
          totalVotes: 18660000,
          quorum: 10000000,
          startDate: '2025-01-15',
          endDate: '2025-01-22',
          daysRemaining: 3,
          hasVoted: false,
          userVote: null
        },
        {
          id: 2,
          title: 'Add USDC-AfroX LP Mining Pool',
          description: 'Create a new LP mining pool for USDC-AfroX pairs with 50% APY rewards to increase stablecoin liquidity.',
          proposer: '0x8765...4321',
          proposerTier: 'Platinum Sentinel',
          category: 'liquidity',
          status: PROPOSAL_STATUS.ACTIVE,
          votesFor: 22100000,
          votesAgainst: 1800000,
          totalVotes: 23900000,
          quorum: 10000000,
          startDate: '2025-01-14',
          endDate: '2025-01-21',
          daysRemaining: 2,
          hasVoted: true,
          userVote: 'for'
        },
        {
          id: 3,
          title: 'Reduce Early Unlock Penalty to 10%',
          description: 'Lower the early unlock penalty from 15% to 10% to provide more flexibility for LP miners who need emergency liquidity.',
          proposer: '0xabcd...ef01',
          proposerTier: 'General',
          category: 'parameters',
          status: PROPOSAL_STATUS.PASSED,
          votesFor: 18900000,
          votesAgainst: 5200000,
          totalVotes: 24100000,
          quorum: 10000000,
          startDate: '2025-01-08',
          endDate: '2025-01-15',
          daysRemaining: 0,
          hasVoted: true,
          userVote: 'for'
        }
      ]);

    } catch (error) {
      console.error('Error loading governance data:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, publicClient, calculateTier]);

  useEffect(() => {
    loadGovernanceData();
  }, [loadGovernanceData]);

  // Vote on proposal
  async function handleVote(proposalId, support) {
    if (!userTier) {
      alert('You need to stake at least 1B AfroX to vote');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement smart contract voting
      alert(`Vote ${support ? 'FOR' : 'AGAINST'} proposal #${proposalId}\n\nVoting power: ${votingPower}x`);
      
      // Update local state
      setProposals(prev => prev.map(p => 
        p.id === proposalId 
          ? { ...p, hasVoted: true, userVote: support ? 'for' : 'against' }
          : p
      ));
      
      await loadGovernanceData();
    } catch (error) {
      console.error('Voting error:', error);
      alert('Failed to submit vote');
    } finally {
      setLoading(false);
    }
  }

  // Create new proposal
  async function handleCreateProposal() {
    if (!userTier || !userTier.proposalPower) {
      alert('You need to be at least Marshal tier (500B staked) to create proposals');
      return;
    }

    if (!newProposal.title || !newProposal.description) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement smart contract proposal creation
      alert(`Proposal created!\n\nTitle: ${newProposal.title}\nCategory: ${newProposal.category}\nVoting period: ${newProposal.votingPeriod} days`);
      
      setNewProposal({
        title: '',
        description: '',
        category: 'general',
        votingPeriod: 7
      });
      
      setActiveTab('proposals');
      await loadGovernanceData();
    } catch (error) {
      console.error('Proposal creation error:', error);
      alert('Failed to create proposal');
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

  function getStatusColor(status) {
    switch (status) {
      case PROPOSAL_STATUS.ACTIVE: return 'text-blue-400 bg-blue-400/10';
      case PROPOSAL_STATUS.PASSED: return 'text-green-400 bg-green-400/10';
      case PROPOSAL_STATUS.REJECTED: return 'text-red-400 bg-red-400/10';
      case PROPOSAL_STATUS.EXECUTED: return 'text-purple-400 bg-purple-400/10';
      case PROPOSAL_STATUS.EXPIRED: return 'text-gray-400 bg-gray-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-300">Please connect your wallet to access the Community of Trust Dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-400 mb-2">Community of Trust Dashboard</h1>
        <p className="text-gray-400">Decentralized governance powered by staking tiers</p>
      </div>

      {/* User Governance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          className={`p-6 rounded-xl border border-orange-600/20 bg-gradient-to-br ${userTier?.color || 'from-gray-700 to-gray-900'}`}
          whileHover={cardGlow}
        >
          <div className="text-sm text-white/80 mb-2">Your Governance Tier</div>
          {userTier ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{userTier.emoji}</span>
                <div className="text-2xl font-bold text-white">{userTier.name}</div>
              </div>
              <div className="text-sm text-white/70">{userTier.description}</div>
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="text-xs text-white/60">Voting Power: {userTier.votingPower}x</div>
                <div className="text-xs text-white/60">Can Create Proposals: {userTier.proposalPower ? '✓ Yes' : '✗ No'}</div>
              </div>
            </>
          ) : (
            <div className="text-gray-400">
              <div className="mb-2">Not Eligible</div>
              <div className="text-sm">Stake at least 1B AfroX to participate</div>
            </div>
          )}
        </motion.div>

        <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Your Staked Balance</div>
          <div className="text-2xl font-bold text-orange-400 mt-2">{prettyNumber(stakedBalance)} AfroX</div>
          <div className="text-xs text-gray-500 mt-1">Required for governance</div>
          <div className="mt-4 text-xs text-gray-400">
            {userTier && (
              <div>
                Next Tier: {Object.keys(GOVERNANCE_TIERS)[Object.keys(GOVERNANCE_TIERS).indexOf(userTier.name) - 1] || 'Max Tier Reached'}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Active Proposals</div>
          <div className="text-2xl font-bold text-blue-400 mt-2">
            {proposals.filter(p => p.status === PROPOSAL_STATUS.ACTIVE).length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Awaiting your vote</div>
          <div className="mt-4 text-xs text-gray-400">
            Total Proposals: {proposals.length}
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-6 border-b border-gray-800 pb-4">
        <button
          onClick={() => setActiveTab('proposals')}
          className={`px-4 py-2 rounded-t ${activeTab === 'proposals' ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'}`}
        >
          📋 Active Proposals
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 rounded-t ${activeTab === 'create' ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'}`}
          disabled={!userTier?.proposalPower}
        >
          ✍️ Create Proposal
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-t ${activeTab === 'history' ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'}`}
        >
          📚 History
        </button>
      </div>

      {/* Proposals List */}
      {activeTab === 'proposals' && (
        <div className="space-y-4">
          {proposals
            .filter(p => p.status === PROPOSAL_STATUS.ACTIVE)
            .map(proposal => (
            <motion.div
              key={proposal.id}
              className="bg-gray-900 p-6 rounded-xl border border-orange-600/10"
              whileHover={cardGlow}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{proposal.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                      {proposal.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{proposal.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Proposer: {proposal.proposer} ({proposal.proposerTier})</span>
                    <span>•</span>
                    <span>Category: {proposal.category}</span>
                    <span>•</span>
                    <span className="text-orange-400">{proposal.daysRemaining} days remaining</span>
                  </div>
                </div>
              </div>

              {/* Voting Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-400">For: {prettyNumber(proposal.votesFor)} ({Math.round(proposal.votesFor / proposal.totalVotes * 100)}%)</span>
                  <span className="text-red-400">Against: {prettyNumber(proposal.votesAgainst)} ({Math.round(proposal.votesAgainst / proposal.totalVotes * 100)}%)</span>
                </div>
                <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-green-500"
                    style={{ width: `${(proposal.votesFor / proposal.totalVotes) * 100}%` }}
                  />
                  <div 
                    className="absolute right-0 top-0 h-full bg-red-500"
                    style={{ width: `${(proposal.votesAgainst / proposal.totalVotes) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Quorum: {prettyNumber(proposal.quorum)} / Total Votes: {prettyNumber(proposal.totalVotes)}
                </div>
              </div>

              {/* Voting Buttons */}
              {proposal.hasVoted ? (
                <div className="text-center p-3 bg-gray-800 rounded">
                  <span className="text-sm text-gray-400">
                    ✓ You voted <span className={proposal.userVote === 'for' ? 'text-green-400' : 'text-red-400'}>
                      {proposal.userVote === 'for' ? 'FOR' : 'AGAINST'}
                    </span> this proposal
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleVote(proposal.id, true)}
                    disabled={!userTier || loading}
                    className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✓ Vote FOR
                  </button>
                  <button
                    onClick={() => handleVote(proposal.id, false)}
                    disabled={!userTier || loading}
                    className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✗ Vote AGAINST
                  </button>
                </div>
              )}
            </motion.div>
          ))}

          {proposals.filter(p => p.status === PROPOSAL_STATUS.ACTIVE).length === 0 && (
            <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-800">
              <div className="text-gray-400 mb-2">No active proposals</div>
              <div className="text-sm text-gray-500">Check back later or create a proposal</div>
            </div>
          )}
        </div>
      )}

      {/* Create Proposal */}
      {activeTab === 'create' && (
        <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
          <h2 className="text-xl font-bold mb-4">Create New Proposal</h2>
          
          {userTier?.proposalPower ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Proposal Title</label>
                <input
                  type="text"
                  value={newProposal.title}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Increase Staking Rewards by 2%"
                  className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={newProposal.description}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide detailed information about your proposal..."
                  className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 h-32"
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 mt-1">{newProposal.description.length}/500 characters</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <select
                    value={newProposal.category}
                    onChange={(e) => setNewProposal(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700"
                  >
                    <option value="general">General</option>
                    <option value="rewards">Rewards & Incentives</option>
                    <option value="liquidity">Liquidity & Pools</option>
                    <option value="parameters">Protocol Parameters</option>
                    <option value="governance">Governance Changes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Voting Period</label>
                  <select
                    value={newProposal.votingPeriod}
                    onChange={(e) => setNewProposal(prev => ({ ...prev, votingPeriod: Number(e.target.value) }))}
                    className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700"
                  >
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateProposal}
                disabled={loading || !newProposal.title || !newProposal.description}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Submit Proposal'}
              </button>

              <div className="text-xs text-gray-400 p-3 bg-gray-800/50 rounded">
                <strong>Note:</strong> Your proposal will be visible to all community members. Make sure it&apos;s clear, detailed, and beneficial to the AfroX ecosystem.
              </div>
            </div>
          ) : (
            <div className="text-center p-8 bg-gray-800 rounded">
              <div className="text-2xl mb-4">🔒</div>
              <div className="text-gray-400 mb-2">Proposal Creation Locked</div>
              <div className="text-sm text-gray-500 mb-4">
                You need to stake at least 500B AfroX (Marshal tier) to create proposals
              </div>
              <div className="text-xs text-gray-600">
                Current tier: {userTier?.name || 'None'} • Required: Marshal or higher
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {proposals
            .filter(p => p.status !== PROPOSAL_STATUS.ACTIVE)
            .map(proposal => (
            <motion.div
              key={proposal.id}
              className="bg-gray-900 p-6 rounded-xl border border-gray-800"
              whileHover={{ boxShadow: '0 0 12px rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{proposal.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                      {proposal.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mb-3">{proposal.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Ended: {proposal.endDate}</span>
                    <span>•</span>
                    <span>For: {prettyNumber(proposal.votesFor)} ({Math.round(proposal.votesFor / proposal.totalVotes * 100)}%)</span>
                    <span>•</span>
                    <span>Against: {prettyNumber(proposal.votesAgainst)} ({Math.round(proposal.votesAgainst / proposal.totalVotes * 100)}%)</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Governance Tiers Info */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mt-8" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Governance Tier System</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(GOVERNANCE_TIERS).map(([tierName, tierData]) => (
            <div key={tierName} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{tierData.emoji}</span>
                <div>
                  <div className="font-bold text-white">{tierName}</div>
                  <div className="text-xs text-gray-400">{tierData.description}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1 mt-2">
                <div>Min Stake: {prettyNumber(tierData.minStake)} AfroX</div>
                <div>Voting Power: {tierData.votingPower}x</div>
                <div>Create Proposals: {tierData.proposalPower ? '✓ Yes' : '✗ No'}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  );
}
