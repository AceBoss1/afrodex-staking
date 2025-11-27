// src/components/GovernanceDashboard.jsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUSD, calculateUSDValue } from '../lib/priceUtils';
import { BADGE_TIERS } from './AfrodexStaking';

export default function GovernanceDashboard({ stakedBalance, badgeTier, afroxPrice }) {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('active');
  const [proposals, setProposals] = useState([]);
  const [historyProposals, setHistoryProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalCategory, setProposalCategory] = useState('governance');
  const [votingDuration, setVotingDuration] = useState(7);

  const currentTier = badgeTier || BADGE_TIERS[BADGE_TIERS.length - 1];
  const canPropose = currentTier.canPropose;
  const votingPower = currentTier.levels || 0;

  const categories = [{ value: 'rewards', label: '🎁 Rewards' }, { value: 'governance', label: '🏛️ Governance' }, { value: 'tokenomics', label: '📊 Tokenomics' }, { value: 'partnerships', label: '🤝 Partnerships' }, { value: 'development', label: '💻 Development' }, { value: 'community', label: '👥 Community' }, { value: 'other', label: '📋 Other' }];
  const durationOptions = [{ days: 3, label: '3 Days' }, { days: 5, label: '5 Days' }, { days: 7, label: '7 Days' }, { days: 14, label: '14 Days' }];

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      // Load from Supabase in production
      setProposals([]);
      setHistoryProposals([]);
    } catch (e) { console.error('Error loading proposals:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isConnected) loadProposals(); }, [isConnected, loadProposals]);

  function prettyNumber(num, decimals = 2) { const n = Number(num || 0); if (n >= 1e12) return (n / 1e12).toFixed(decimals) + 'T'; if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K'; return n.toFixed(decimals); }
  function shortAddr(addr) { return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'; }
  function getTimeRemaining(endsAt) { const diff = new Date(endsAt) - new Date(); const days = Math.floor(diff / (1000 * 60 * 60 * 24)); const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); if (days > 0) return `${days}d ${hours}h remaining`; if (hours > 0) return `${hours}h remaining`; return 'Ending soon'; }
  function getQuorumProgress(votesFor, votesAgainst, quorum) { return Math.min(100, ((votesFor + votesAgainst) / quorum) * 100); }

  async function handleCreateProposal() { if (!proposalTitle || !proposalDescription) { alert('Please fill in all fields'); return; } if (!canPropose) { alert('You need at least General tier (100B+ staked) to create proposals'); return; } setLoading(true); try { alert('Proposal created!'); setProposalTitle(''); setProposalDescription(''); await loadProposals(); } catch (e) { alert('Failed: ' + e.message); } finally { setLoading(false); } }
  async function handleVote(proposalId, support) { if (votingPower <= 0) { alert('Stake AfroX to vote'); return; } setLoading(true); try { alert(`Vote ${support ? 'FOR' : 'AGAINST'} submitted!`); await loadProposals(); } catch (e) { alert('Failed: ' + e.message); } finally { setLoading(false); } }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  if (!isConnected) return <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700"><h2 className="text-2xl font-bold text-orange-400 mb-4">Connect Your Wallet</h2><p className="text-gray-300">Connect to access Community of Trust Dashboard</p></div>;

  return (
    <div className="pb-4">
      <div className="mb-6"><h2 className="text-xl font-bold text-gray-300">Community of Trust Dashboard</h2><p className="text-sm text-gray-500">Participate in governance decisions and shape the future of AfroX</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}><div className="text-sm text-gray-400">Staked Balance</div><div className="text-2xl font-bold text-orange-400 mt-1">{prettyNumber(stakedBalance)} AfroX</div>{afroxPrice && <div className="text-xs text-gray-500 mt-1">≈ {formatUSD(calculateUSDValue(stakedBalance, afroxPrice))}</div>}</motion.div>
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}><div className="text-sm text-gray-400">Current Tier</div><div className="text-2xl font-bold text-orange-400 mt-1 flex items-center gap-2"><span className="text-3xl">{currentTier.emoji}</span><span>{currentTier.name}</span></div></motion.div>
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}><div className="text-sm text-gray-400">Voting Power</div><div className="text-2xl font-bold text-purple-400 mt-1">{votingPower}x</div></motion.div>
        <motion.div className="bg-gray-900 p-4 rounded-xl border border-orange-600/10" whileHover={cardGlow}><div className="text-sm text-gray-400">Can Propose</div><div className={`text-2xl font-bold mt-1 ${canPropose ? 'text-green-400' : 'text-red-400'}`}>{canPropose ? '✓ Yes' : '✗ No'}</div></motion.div>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded flex items-center gap-2 ${activeTab === 'active' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>📋 Active Proposals</button>
        <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded flex items-center gap-2 ${activeTab === 'create' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>✏️ Create Proposal</button>
        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded flex items-center gap-2 ${activeTab === 'history' ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-300'}`}>📚 History</button>
      </div>

      {activeTab === 'active' && (
        <motion.div className="space-y-4">
          {proposals.length > 0 ? proposals.map((proposal) => {
            const totalVotes = proposal.votesFor + proposal.votesAgainst;
            const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
            const quorumPct = getQuorumProgress(proposal.votesFor, proposal.votesAgainst, proposal.quorum);
            return (
              <motion.div key={proposal.id} className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
                <div className="flex justify-between items-start mb-4"><div><div className="flex items-center gap-2 mb-1"><span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">{categories.find(c => c.value === proposal.category)?.label}</span><span className="text-xs text-gray-500">by {shortAddr(proposal.proposer)}</span></div><h3 className="text-xl font-bold text-white">{proposal.title}</h3><p className="text-sm text-gray-400 mt-2">{proposal.description}</p></div><div className="text-right"><div className="text-xs text-orange-400">{getTimeRemaining(proposal.endsAt)}</div></div></div>
                <div className="mb-4"><div className="flex justify-between text-sm mb-1"><span className="text-green-400">For: {prettyNumber(proposal.votesFor)} ({forPct.toFixed(1)}%)</span><span className="text-red-400">Against: {prettyNumber(proposal.votesAgainst)} ({(100 - forPct).toFixed(1)}%)</span></div><div className="h-3 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-500 to-green-600" style={{ width: `${forPct}%` }}></div></div></div>
                <div className="mb-4"><div className="flex justify-between text-xs text-gray-400 mb-1"><span>Quorum Progress</span><span>{quorumPct.toFixed(1)}% of {prettyNumber(proposal.quorum)} required</span></div><div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className={`h-full ${quorumPct >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, quorumPct)}%` }}></div></div></div>
                <div className="flex gap-3"><button onClick={() => handleVote(proposal.id, true)} disabled={loading || votingPower <= 0} className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50">👍 Vote For</button><button onClick={() => handleVote(proposal.id, false)} disabled={loading || votingPower <= 0} className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50">👎 Vote Against</button></div>
              </motion.div>
            );
          }) : <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700"><div className="text-4xl mb-3">📭</div><div className="text-gray-400">No active proposals</div><div className="text-sm text-gray-500 mt-1">Check back later or create a new proposal</div></div>}
        </motion.div>
      )}

      {activeTab === 'create' && (
        <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
          <h2 className="text-xl font-bold mb-6">Create New Proposal</h2>
          {!canPropose ? (<div className="text-center p-8 bg-gray-800 rounded-lg"><div className="text-4xl mb-3">🔒</div><div className="text-gray-400 mb-2">You need at least <span className="text-orange-400 font-bold">General tier</span> to create proposals</div><div className="text-sm text-gray-500">Stake ≥100B AfroX to unlock</div></div>) : (
            <>
              <div className="mb-4"><label className="block text-sm text-gray-400 mb-2">Proposal Title</label><input type="text" value={proposalTitle} onChange={(e) => setProposalTitle(e.target.value)} placeholder="Enter title" className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700" /></div>
              <div className="mb-4"><label className="block text-sm text-gray-400 mb-2">Category</label><select value={proposalCategory} onChange={(e) => setProposalCategory(e.target.value)} className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700">{categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}</select></div>
              <div className="mb-4"><label className="block text-sm text-gray-400 mb-2">Description</label><textarea value={proposalDescription} onChange={(e) => setProposalDescription(e.target.value)} placeholder="Describe your proposal..." rows={6} className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700" /></div>
              <div className="mb-6"><label className="block text-sm text-gray-400 mb-2">Voting Duration</label><div className="grid grid-cols-4 gap-3">{durationOptions.map(opt => <button key={opt.days} onClick={() => setVotingDuration(opt.days)} className={`p-3 rounded-lg border-2 ${votingDuration === opt.days ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800'}`}>{opt.label}</button>)}</div></div>
              <button onClick={handleCreateProposal} disabled={loading || !proposalTitle || !proposalDescription} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold disabled:opacity-50">{loading ? 'Creating...' : 'Submit Proposal'}</button>
            </>
          )}
        </motion.div>
      )}

      {activeTab === 'history' && (
        <motion.div className="space-y-4">
          {historyProposals.length > 0 ? historyProposals.map((proposal) => (
            <motion.div key={proposal.id} className="bg-gray-900 p-6 rounded-xl border border-orange-600/20" whileHover={cardGlow}>
              <div className="flex justify-between items-start"><div><div className="flex items-center gap-2 mb-1"><span className={`text-xs px-2 py-1 rounded font-bold ${proposal.status === 'passed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{proposal.status === 'passed' ? '✓ Passed' : '✗ Rejected'}</span><span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">{categories.find(c => c.value === proposal.category)?.label}</span></div><h3 className="text-lg font-bold text-white">{proposal.title}</h3><div className="text-xs text-gray-500 mt-1">by {shortAddr(proposal.proposer)}</div></div><div className="text-right text-xs text-gray-500">{new Date(proposal.executedAt).toLocaleDateString()}</div></div>
              <div className="mt-4 flex gap-4 text-sm"><span className="text-green-400">For: {prettyNumber(proposal.votesFor)}</span><span className="text-red-400">Against: {prettyNumber(proposal.votesAgainst)}</span></div>
            </motion.div>
          )) : <div className="text-center p-12 bg-gray-900 rounded-xl border border-gray-700"><div className="text-4xl mb-3">📚</div><div className="text-gray-400">No proposal history yet</div></div>}
        </motion.div>
      )}

      <motion.div className="bg-gray-900 p-6 rounded-xl border border-orange-600/20 mt-6" whileHover={cardGlow}>
        <h2 className="text-xl font-bold mb-4">Governance Tier Requirements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{BADGE_TIERS.map((tier) => (<div key={tier.name} className={`p-4 rounded-lg border text-center ${tier.name === currentTier.name ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 bg-gray-800/50'}`}><div className="text-2xl mb-1">{tier.emoji}</div><div className="text-sm font-bold text-gray-300">{tier.name}</div><div className="text-xs text-gray-500 mt-1">{tier.threshold}</div><div className="text-xs text-purple-400 mt-1">{tier.levels}x vote</div><div className={`text-xs mt-1 ${tier.canPropose ? 'text-green-400' : 'text-gray-600'}`}>{tier.canPropose ? '✓ Can propose' : '✗ Cannot propose'}</div></div>))}</div>
      </motion.div>
    </div>
  );
}
