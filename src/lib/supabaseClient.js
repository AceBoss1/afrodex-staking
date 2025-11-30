// src/lib/supabaseClient.js - COMPLETE VERSION WITH ALL EXPORTS

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Missing Supabase credentials in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =============================================
// GOVERNANCE FUNCTIONS
// =============================================

export async function getGovernanceProposals() {
  try {
    const { data, error } = await supabase
      .from('governance_proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting proposals:', error);
    return [];
  }
}

export async function submitVote(proposalId, walletAddress, support, voteAmount) {
  try {
    const { data, error } = await supabase
      .from('governance_votes')
      .insert({
        proposal_id: proposalId,
        wallet_address: walletAddress.toLowerCase(),
        support,
        vote_amount: voteAmount,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error submitting vote:', error);
    return { success: false, error: error.message };
  }
}

export async function createProposal(proposalData) {
  try {
    const { data, error } = await supabase
      .from('governance_proposals')
      .insert({
        title: proposalData.title,
        description: proposalData.description,
        category: proposalData.category,
        proposer: proposalData.proposer.toLowerCase(),
        voting_duration_days: proposalData.votingDurationDays,
        status: 'active',
        votes_for: 0,
        votes_against: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating proposal:', error);
    return { success: false, error: error.message };
  }
}

// =============================================
// LP MINING FUNCTIONS
// =============================================

export async function getLPMiningLeaderboard(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('lp_mining_leaderboard')
      .select('*')
      .order('total_lp_locked', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting LP mining leaderboard:', error);
    return [];
  }
}

export async function getLPMiningPositions(walletAddress) {
  try {
    const { data, error } = await supabase
      .from('lp_mining_positions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('locked_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting LP positions:', error);
    return [];
  }
}

// =============================================
// AMBASSADOR FUNCTIONS
// =============================================

export function generateReferralCode(address) {
  if (!address) return '';
  return address.slice(2, 10);
}

export function createReferralLink(code) {
  return `https://dashboard.afrox.one/?ref=${code}`;
}

export async function registerReferral(referrerAddress, refereeAddress) {
  try {
    const referrerCode = generateReferralCode(referrerAddress);
    
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_address', referrerAddress.toLowerCase())
      .eq('referee_address', refereeAddress.toLowerCase())
      .single();

    if (existing) {
      return { success: true, message: 'Referral already exists' };
    }

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_address: referrerAddress.toLowerCase(),
        referee_address: refereeAddress.toLowerCase(),
        referral_code: referrerCode,
        level: 1,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error registering referral:', error);
    return { success: false, error: error.message };
  }
}

export async function getAmbassadorStats(address) {
  try {
    const lowerAddress = address.toLowerCase();

    const { data: referrals } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_address', lowerAddress);

    if (!referrals) {
      return {
        totalReferrals: 0,
        l1: 0,
        l2: 0,
        l3: 0,
        l4: 0,
        l5: 0,
        totalEarned: 0,
        pendingCommissions: 0
      };
    }

    const stats = {
      totalReferrals: referrals.length,
      l1: referrals.filter(r => r.level === 1).length,
      l2: referrals.filter(r => r.level === 2).length,
      l3: referrals.filter(r => r.level === 3).length,
      l4: referrals.filter(r => r.level === 4).length,
      l5: referrals.filter(r => r.level === 5).length
    };

    const { data: commissions } = await supabase
      .from('commissions')
      .select('*')
      .eq('ambassador_address', lowerAddress);

    if (commissions) {
      stats.totalEarned = commissions
        .filter(c => c.claimed)
        .reduce((sum, c) => sum + parseFloat(c.amount), 0);
      
      stats.pendingCommissions = commissions
        .filter(c => !c.claimed)
        .reduce((sum, c) => sum + parseFloat(c.amount), 0);
    } else {
      stats.totalEarned = 0;
      stats.pendingCommissions = 0;
    }

    return stats;
  } catch (error) {
    console.error('Error getting ambassador stats:', error);
    return null;
  }
}

export async function getReferralTree(address, maxDepth = 5) {
  try {
    const { data: tree } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_address', address.toLowerCase())
      .lte('level', maxDepth)
      .order('level', { ascending: true });

    return tree || [];
  } catch (error) {
    console.error('Error getting referral tree:', error);
    return [];
  }
}

export async function getAmbassadorLeaderboard(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('ambassador_leaderboard')
      .select('*')
      .order('total_earned', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}
