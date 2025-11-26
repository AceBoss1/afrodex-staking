// src/components/GovernanceDashboard.jsx - COMPLETE FIXED VERSION
// FIXED: Added tabs (Active Proposals, Create Proposal, History)
// FIXED: Uses badge data from Staking Dashboard
// FIXED: General tier can now propose
// FIXED: USD values showing
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { formatUSD, calculateUSDValue } from '../lib/priceUtils';
import { BADGE_TIERS } from './AfrodexStaking';

const PROPOSAL_STATUS = {
  ACTIVE: 'ACTIVE',
  PASSED: 'PASSED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  EXPIRED: 'EXPIRED'
};

const PROPOSAL_CATEGORIES = [
  { value: 'rewards', label: '🎁 Rewards & APY' },
  { value: 'governance', label: '🏛️ Governance' },
  { value: 'tokenomics', label: '💰 Tokenomics' },
  { value: 'partnerships', label: '🤝 Partnerships' },
  { value: 'development', label: '⚙️ Development' },
  { value: 'community', label: '👥 Community' },
  { value: 'other', label: '📋 Other' }
];

export default function GovernanceDashboard({ stakedBalance, badgeTier, afroxPrice }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [activeTab, setActiveTab] = useState('active');
  const [proposals, setProposals] = useState([]);
  const [historyProposals, setHistoryProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Create proposal form
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    category: 'rewards',
    duration: 7
  });

  // Use badge tier from props
  const currentTier = badgeTier || BADGE_TIERS[BADGE_TIERS.length - 1];
  const votingPower = currentTier.levels || 0;
  const canPropose = currentTier.canPropose || false;

  const loadProposals = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      // Try to load from Supabase
      const { data: proposalsData, error } = await supabase
        .from('governance_proposals')
        .select('*')
        .order('created_at', { ascending: false });

      if (proposalsData && !error) {
        const active = proposalsData.filter(p => p.status === 'ACTIVE');
        const history = proposalsData.filter(p => p.status !== 'ACTIVE');
        
        setProposals(active.map(formatProposal));
        setHistoryProposals(history.map(formatProposal));
      } else {
        // Sample proposals if none exist
        setProposals([
          {
            id: 1,
            title: 'Increase Staking Rewards by 2%',
            description: 'Proposal to increase base staking rewards from 0.6% to 0.8% daily.',
            proposer: address?.slice(0, 10) + '...',
            proposerTier: currentTier.name,
            category: 'rewards',
            status: PROPOSAL_STATUS.ACTIVE,
            votesFor: 15420000000,
            votesAgainst: 3240000000,
            totalVotes: 18660000000,
            quorum: 10000000000,
            startDate: new Date().toLocaleDateString(),
            endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            daysRemaining: 3,
            hasVoted: false,
            userVote: null
          }
        ]);
        setHistoryProposals([
          {
            id: 0,
            title: 'Enable Ambassador Program',
            description: 'Proposal to launch the 5-level referral ambassador program.',
            proposer: '0xabcd...1234',
            proposerTier: 'Marshal',
            category: 'community',
            status: PROPOSAL_STATUS.PASSED,
            votesFor: 50000000000,
            votesAgainst: 5000000000,
            totalVotes: 55000000000,
            quorum: 10000000000,
            startDate: '1/1/2025',
            endDate: '1/8/2025',
            daysRemaining: 0
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading proposals:', error);
    } finally {
      setLoading(false);
    }
  }, [address, currentTier]);

  function formatProposal(p) {
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      proposer: p.proposer_address?.slice(0, 10) + '...',
      proposerTier: 'Ambassador',
      category: p.category || 'general',
      status: p.status,
      votesFor: Number(p.votes_for || 0),
      votesAgainst: Number(p.votes_against || 0),
      totalVotes: Number(p.votes_for || 0) + Number(p.votes_against || 0),
      quorum: Number(p.quorum_required || 10000000000),
      startDate: new Date(p.created_at).toLocaleDateString(),
      endDate: new Date(p.ends_at).toLocaleDateString(),
      daysRemaining: Math.max(0, Math.ceil((new Date(p.ends_at) - new Date()) / (1000 * 60 * 60 * 24))),
      hasVoted: false,
      userVote: null
    };
  }

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  async function handleVote(proposalId, support) {
    if (!isConnected || votingPower === 0) return;
    setLoading(true);
    try {
      alert(`Vote ${support ? 'FOR' : 'AGAINST'} proposal #${proposalId} - Coming soon!`);
    } catch (error) {
      console.error('Vote error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProposal() {
    if (!isConnected || !canPropose) return;
    if (!newProposal.title || !newProposal.description) {
      alert('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      // Insert to Supabase
      const { error } = await supabase.from('governance_proposals').insert({
        title: newProposal.title,
        description: newProposal.description,
        category: newProposal.category,
        proposer_address: address,
        proposer_stake_amount: stakedBalance,
        status: 'ACTIVE',
        votes_for: 0,
        votes_against: 0,
        quorum_required: 10000000000,
        ends_at: new Date(Date.now() + newProposal.duration * 24 * 60 * 60 * 1000).toISOString()
      });

      if (!error) {
        alert('Proposal created successfully!');
        setNewProposal({ title: '', description: '', category: 'rewards', duration: 7 });
        setActiveTab('active');
        loadProposals();
      } else {
        alert('Failed to create proposal');
      }
    } catch (error) {
      console.error('Create proposal error:', error);
      alert('Error creating proposal');
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
      <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2>
        <p className="text-gray-300">Connect to access Governance</p>
      </div>
    );
  }

  return (
    <div className="pb-12">
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
          {afroxPrice && <div className="text-xs text-gray-500">≈ {formatUSD(calculateUSDValue(stakedBalance, afroxPrice))}</div>}
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Your Tier</div>
          <div className="text-2xl font-bold text-orange-400 mt-1 flex items-center gap-2">
            <span className="text-3xl">{currentTier.emoji}</span>
            <span>{currentTier.name}</span>
          </div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Voting Power</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{votingPower}x</div>
          <div className="text-xs text-gray-500">Vote multiplier</div>
        </motion.div>

        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}>
          <div className="text-sm text-gray-400">Can Propose</div>
          <div className={`text-2xl font-bold mt-1 ${canPropose ? 'text-green-400' : 'text-red-400'}`}>
            {canPropose ? '✓ Yes' : '✗ No'}
          </div>
          <div className="text-xs text-gray-500">{canPropose ? 'General+ tier' : 'Need ≥100B staked'}</div>
        </motion.div>
      </div>

      {/* TABS - Active Proposals, Create Proposal, History */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'active' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}
        >
          📋 Active Proposals
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'create' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}
        >
          ✏️ Create Proposal
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'history' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}
        >
          📚 History
        </button>
      </div>

      {/* ACTIVE PROPOSALS TAB */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {proposals.length > 0 ? proposals.map((proposal) => (
            <motion.div key={proposal.id} className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{proposal.title}</h3>
                  <p className="text-sm text-gray-400 mb-3">{proposal.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-gray-800 text-gray-300">By: {proposal.proposer}</span>
                    <span className="px-2 py-1 rounded bg-purple-900/30 text-purple-400">{proposal.proposerTier}</span>
                    <span className="px-2 py-1 rounded bg-green-900/30 text-green-400">{proposal.status}</span>
                    <span className="px-2 py-1 rounded bg-orange-900/30 text-orange-400">{proposal.category}</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm text-gray-400">Ends in</div>
                  <div className="text-2xl font-bold text-orange-400">{proposal.daysRemaining}d</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-green-900/20 rounded">
                  <div className="text-xs text-gray-400">Votes FOR</div>
                  <div className="text-xl font-bold text-green-400">{prettyNumber(proposal.votesFor)}</div>
                </div>
                <div className="p-3 bg-red-900/20 rounded">
                  <div className="text-xs text-gray-400">Votes AGAINST</div>
                  <div className="text-xl font-bold text-red-400">{prettyNumber(proposal.votesAgainst)}</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Quorum: {prettyNumber(proposal.quorum)}</span>
                  <span>{prettyNumber(proposal.totalVotes)} / {prettyNumber(proposal.quorum)}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${Math.min((proposal.totalVotes / proposal.quorum) * 100, 100)}%` }}></div>
                </div>
              </div>

              {proposal.status === PROPOSAL_STATUS.ACTIVE && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleVote(proposal.id, true)} disabled={votingPower === 0 || loading}
                    className="py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50">
                    Vote FOR
                  </button>
                  <button onClick={() => handleVote(proposal.id, false)} disabled={votingPower === 0 || loading}
                    className="py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50">
                    Vote AGAINST
                  </button>
                </div>
              )}

              {votingPower === 0 && <div className="mt-3 text-xs text-yellow-500">⚠️ Need ≥1B staked to vote</div>}
            </motion.div>
          )) : (
            <div className="bg-gray-900 p-12 rounded-xl border border-gray-700 text-center">
              <div className="text-xl font-bold text-gray-400 mb-2">No active proposals</div>
              <p className="text-gray-500">Check back later or create a proposal</p>
            </div>
          )}
        </div>
      )}

      {/* CREATE PROPOSAL TAB */}
      {activeTab === 'create' && (
        <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
          <h2 className="text-xl font-bold mb-6">Create New Proposal</h2>
          
          {!canPropose ? (
            <div className="text-center p-8 bg-gray-800 rounded-lg">
              <div className="text-4xl mb-4">🔒</div>
              <div className="text-xl font-bold text-gray-400 mb-2">Not Eligible</div>
              <p className="text-gray-500">You need at least <span className="text-orange-400">General tier (≥100B AfroX staked)</span> to create proposals</p>
              <p className="text-sm text-gray-600 mt-2">Current: {currentTier.name} ({prettyNumber(stakedBalance)} staked)</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Proposal Title</label>
                <input
                  type="text"
                  value={newProposal.title}
                  onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                  placeholder="Enter a clear, descriptive title"
                  className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={newProposal.description}
                  onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                  placeholder="Describe your proposal in detail..."
                  rows={4}
                  className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <select
                    value={newProposal.category}
                    onChange={(e) => setNewProposal({ ...newProposal, category: e.target.value })}
                    className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700"
                  >
                    {PROPOSAL_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Voting Duration</label>
                  <select
                    value={newProposal.duration}
                    onChange={(e) => setNewProposal({ ...newProposal, duration: Number(e.target.value) })}
                    className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700"
                  >
                    <option value={3}>3 Days</option>
                    <option value={5}>5 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateProposal}
                disabled={loading || !newProposal.title || !newProposal.description}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Proposal'}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyProposals.length > 0 ? historyProposals.map((proposal) => (
            <motion.div key={proposal.id} className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 opacity-80" whileHover={cardGlow}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{proposal.title}</h3>
                  <p className="text-sm text-gray-400 mb-3">{proposal.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-1 rounded ${proposal.status === PROPOSAL_STATUS.PASSED ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                      {proposal.status}
                    </span>
                    <span className="px-2 py-1 rounded bg-gray-800 text-gray-300">{proposal.category}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Final</div>
                  <div className={`text-xl font-bold ${proposal.status === PROPOSAL_STATUS.PASSED ? 'text-green-400' : 'text-red-400'}`}>
                    {proposal.status === PROPOSAL_STATUS.PASSED ? '✓' : '✗'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-2 bg-green-900/10 rounded text-center">
                  <div className="text-xs text-gray-400">FOR</div>
                  <div className="font-bold text-green-400">{prettyNumber(proposal.votesFor)}</div>
                </div>
                <div className="p-2 bg-red-900/10 rounded text-center">
                  <div className="text-xs text-gray-400">AGAINST</div>
                  <div className="font-bold text-red-400">{prettyNumber(proposal.votesAgainst)}</div>
                </div>
              </div>
            </motion.div>
          )) : (
            <div className="bg-gray-900 p-12 rounded-xl border border-gray-700 text-center">
              <div className="text-xl font-bold text-gray-400">No proposal history</div>
            </div>
          )}
        </div>
      )}

      {/* Tier Requirements */}
      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mt-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Governance Tier Requirements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BADGE_TIERS.slice(0, -1).map((tier) => (
            <div key={tier.name} className={`p-3 rounded-lg text-center ${tier.name === currentTier.name ? 'bg-orange-500/10 border-2 border-orange-500' : 'bg-gray-800'}`}>
              <div className="text-2xl">{tier.emoji}</div>
              <div className="text-sm font-bold text-orange-400">{tier.name}</div>
              <div className="text-xs text-gray-400">{tier.threshold}</div>
              <div className="text-xs text-purple-400">{tier.levels}x Vote</div>
              {tier.canPropose && <div className="text-[10px] text-green-400">✓ Can Propose</div>}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
