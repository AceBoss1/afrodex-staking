// src/lib/supabaseClient.js
// UPDATED: Complete Supabase integration for AfroX DeFi Hub
// This file now properly records staking, referral, and LP mining events

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Missing Supabase credentials in environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Generate referral code from wallet address
 * Format: First 8 chars after 0x, uppercase
 */
export function generateReferralCode(address) {
  if (!address) return '';
  return address.slice(2, 10).toUpperCase();
}

/**
 * Create referral link
 */
export function createReferralLink(code) {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/?ref=${code}`;
  }
  return `https://hub.afrox.one/?ref=${code}`;
}

/**
 * Determine badge tier from staked amount
 */
export function getBadgeTierFromStake(stakedAmount) {
  const staked = Number(stakedAmount || 0);
  if (staked >= 10e12) return 'Diamond Custodian';
  if (staked >= 1e12) return 'Platinum Sentinel';
  if (staked >= 500e9) return 'Marshal';
  if (staked >= 100e9) return 'General';
  if (staked >= 50e9) return 'Commander';
  if (staked >= 10e9) return 'Captain';
  if (staked >= 1e9) return 'Cadet';
  return 'Starter';
}

// =============================================
// USER MANAGEMENT
// =============================================

/**
 * Create or update user in database
 */
export async function upsertUser(walletAddress, referredByWallet = null, stakedAmount = 0) {
  try {
    const lowerWallet = walletAddress.toLowerCase();
    const referralCode = generateReferralCode(walletAddress);
    const badgeTier = getBadgeTierFromStake(stakedAmount);
    const isEligible = stakedAmount >= 1e9; // ≥1B

    const { data, error } = await supabase
      .from('users')
      .upsert({
        wallet_address: lowerWallet,
        referral_code: referralCode,
        referred_by_wallet: referredByWallet?.toLowerCase() || null,
        badge_tier: badgeTier,
        total_staked: stakedAmount,
        is_eligible_ambassador: isEligible,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'wallet_address'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting user:', error);
      return null;
    }

    console.log('✅ User upserted:', lowerWallet);
    return data;
  } catch (error) {
    console.error('Error in upsertUser:', error);
    return null;
  }
}

/**
 * Get user by wallet address
 */
export async function getUser(walletAddress) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user:', error);
    }
    return data;
  } catch (error) {
    console.error('Error in getUser:', error);
    return null;
  }
}

/**
 * Update user's staking info
 */
export async function updateUserStake(walletAddress, stakedAmount, badgeTier = null) {
  try {
    const tier = badgeTier || getBadgeTierFromStake(stakedAmount);
    const isEligible = stakedAmount >= 1e9;

    const { data, error } = await supabase
      .from('users')
      .update({
        total_staked: stakedAmount,
        badge_tier: tier,
        is_eligible_ambassador: isEligible,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress.toLowerCase())
      .select()
      .single();

    if (error) {
      console.error('Error updating user stake:', error);
      return null;
    }

    console.log('✅ User stake updated:', walletAddress.toLowerCase(), stakedAmount);
    return data;
  } catch (error) {
    console.error('Error in updateUserStake:', error);
    return null;
  }
}

// =============================================
// STAKING EVENTS
// =============================================

/**
 * Record a staking event (stake, unstake, claim)
 */
export async function recordStakingEvent(walletAddress, eventType, amount, txHash = null, blockNumber = null) {
  try {
    // First ensure user exists
    await upsertUser(walletAddress, null, 0);

    const { data, error } = await supabase
      .from('staking_events')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        event_type: eventType, // 'stake', 'unstake', 'claim'
        amount: amount,
        tx_hash: txHash,
        block_number: blockNumber,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      // Ignore duplicate tx_hash errors
      if (error.code === '23505') {
        console.log('Staking event already recorded (duplicate tx_hash)');
        return null;
      }
      console.error('Error recording staking event:', error);
      return null;
    }

    console.log(`✅ Staking event recorded: ${eventType} ${amount} for ${walletAddress.slice(0, 10)}...`);

    // If this is a stake event, update the user's first_stake_date
    if (eventType === 'stake') {
      await supabase
        .from('users')
        .update({ 
          first_stake_date: new Date().toISOString(),
          last_activity_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress.toLowerCase())
        .is('first_stake_date', null);
    }

    return data;
  } catch (error) {
    console.error('Error in recordStakingEvent:', error);
    return null;
  }
}

/**
 * Get staking history for a user
 */
export async function getStakingHistory(walletAddress, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('staking_events')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching staking history:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getStakingHistory:', error);
    return [];
  }
}

// =============================================
// REFERRAL MANAGEMENT
// =============================================

/**
 * Register a referral (L1-L5 automatically)
 */
export async function registerReferral(referrerAddress, refereeAddress) {
  try {
    // Don't allow self-referral
    if (referrerAddress.toLowerCase() === refereeAddress.toLowerCase()) {
      console.warn('Self-referral attempted, ignoring');
      return { success: false, error: 'Self-referral not allowed' };
    }

    const referrerLower = referrerAddress.toLowerCase();
    const refereeLower = refereeAddress.toLowerCase();
    const referrerCode = generateReferralCode(referrerAddress);

    // Check if this referral already exists
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_address', referrerLower)
      .eq('referee_address', refereeLower)
      .eq('level', 1)
      .single();

    if (existing) {
      console.log('Referral already exists');
      return { success: true, message: 'Referral already registered' };
    }

    // Insert L1 (direct) referral
    const { error: l1Error } = await supabase
      .from('referrals')
      .insert({
        referrer_address: referrerLower,
        referee_address: refereeLower,
        referral_code: referrerCode,
        level: 1,
        created_at: new Date().toISOString()
      });

    if (l1Error && l1Error.code !== '23505') {
      console.error('Error inserting L1 referral:', l1Error);
      return { success: false, error: l1Error.message };
    }

    // Get referrer's upline for L2-L5
    const { data: upline } = await supabase
      .from('referrals')
      .select('referrer_address, level')
      .eq('referee_address', referrerLower)
      .lt('level', 5)
      .order('level', { ascending: true });

    // Build L2-L5 relationships
    if (upline && upline.length > 0) {
      for (const ancestor of upline) {
        const newLevel = ancestor.level + 1;
        if (newLevel <= 5) {
          await supabase
            .from('referrals')
            .insert({
              referrer_address: ancestor.referrer_address,
              referee_address: refereeLower,
              referral_code: generateReferralCode(ancestor.referrer_address),
              level: newLevel,
              created_at: new Date().toISOString()
            })
            .single();
        }
      }
    }

    // Record the signup event
    await supabase
      .from('referral_events')
      .insert({
        referrer_address: referrerLower,
        referee_address: refereeLower,
        event_type: 'signup',
        level: 1,
        created_at: new Date().toISOString()
      });

    // Update referee's user record
    await supabase
      .from('users')
      .update({ referred_by_wallet: referrerLower })
      .eq('wallet_address', refereeLower);

    // Update ambassador leaderboard
    await updateAmbassadorLeaderboard(referrerLower);

    console.log(`✅ Referral registered: ${referrerLower.slice(0, 10)}... → ${refereeLower.slice(0, 10)}...`);
    return { success: true };
  } catch (error) {
    console.error('Error in registerReferral:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get ambassador stats
 */
export async function getAmbassadorStats(walletAddress) {
  try {
    const lowerWallet = walletAddress.toLowerCase();

    // Get referral counts by level
    const { data: referrals } = await supabase
      .from('referrals')
      .select('level')
      .eq('referrer_address', lowerWallet);

    const stats = {
      totalReferrals: referrals?.length || 0,
      l1: referrals?.filter(r => r.level === 1).length || 0,
      l2: referrals?.filter(r => r.level === 2).length || 0,
      l3: referrals?.filter(r => r.level === 3).length || 0,
      l4: referrals?.filter(r => r.level === 4).length || 0,
      l5: referrals?.filter(r => r.level === 5).length || 0,
      totalEarned: 0,
      totalClaimed: 0,
      pendingCommissions: 0
    };

    // Get commission totals
    const { data: commissions } = await supabase
      .from('commissions')
      .select('amount, claimed')
      .eq('ambassador_address', lowerWallet);

    if (commissions) {
      stats.totalEarned = commissions
        .filter(c => c.claimed)
        .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      stats.pendingCommissions = commissions
        .filter(c => !c.claimed)
        .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      stats.totalClaimed = stats.totalEarned;
    }

    return stats;
  } catch (error) {
    console.error('Error in getAmbassadorStats:', error);
    return {
      totalReferrals: 0,
      l1: 0, l2: 0, l3: 0, l4: 0, l5: 0,
      totalEarned: 0,
      totalClaimed: 0,
      pendingCommissions: 0
    };
  }
}

/**
 * Get referral tree (all levels)
 */
export async function getReferralTree(walletAddress, maxDepth = 5) {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_address', walletAddress.toLowerCase())
      .lte('level', maxDepth)
      .order('level', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching referral tree:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getReferralTree:', error);
    return [];
  }
}

/**
 * Get ambassador leaderboard
 */
export async function getAmbassadorLeaderboard(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('ambassador_leaderboard')
      .select('*')
      .order('total_earned', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getAmbassadorLeaderboard:', error);
    return [];
  }
}

/**
 * Update ambassador leaderboard entry
 */
export async function updateAmbassadorLeaderboard(ambassadorAddress) {
  try {
    const stats = await getAmbassadorStats(ambassadorAddress);
    const lowerWallet = ambassadorAddress.toLowerCase();

    const { error } = await supabase
      .from('ambassador_leaderboard')
      .upsert({
        ambassador_address: lowerWallet,
        wallet: lowerWallet,
        total_referrals: stats.totalReferrals,
        l1_count: stats.l1,
        l2_count: stats.l2,
        l3_count: stats.l3,
        l4_count: stats.l4,
        l5_count: stats.l5,
        total_earned: stats.totalEarned,
        pending_commissions: stats.pendingCommissions,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'ambassador_address'
      });

    if (error) {
      console.error('Error updating leaderboard:', error);
    }
  } catch (error) {
    console.error('Error in updateAmbassadorLeaderboard:', error);
  }
}

// =============================================
// LP MINING
// =============================================

/**
 * Record LP mining position
 */
export async function recordLPMiningPosition(
  walletAddress,
  lpPairAddress,
  lpAmount,
  afroxValue,
  wethValue,
  lockDuration,
  instantBonus,
  miningRewards,
  referrerAddress = null,
  txHash = null
) {
  try {
    const unlockAt = new Date();
    unlockAt.setDate(unlockAt.getDate() + lockDuration);

    const { data, error } = await supabase
      .from('lp_mining_positions')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        lp_pair_address: lpPairAddress.toLowerCase(),
        lp_amount: lpAmount,
        afrox_value: afroxValue,
        weth_value: wethValue,
        lock_duration: lockDuration,
        locked_at: new Date().toISOString(),
        unlock_at: unlockAt.toISOString(),
        instant_bonus: instantBonus,
        mining_rewards: miningRewards,
        total_rewards: instantBonus + miningRewards,
        status: 'locked',
        referrer_address: referrerAddress?.toLowerCase() || null,
        referrer_bonus: referrerAddress ? instantBonus : 0,
        tx_hash: txHash,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording LP mining position:', error);
      return null;
    }

    // Update LP mining leaderboard
    await updateLPMiningLeaderboard(walletAddress);

    console.log(`✅ LP mining position recorded: ${lpAmount} LP for ${walletAddress.slice(0, 10)}...`);
    return data;
  } catch (error) {
    console.error('Error in recordLPMiningPosition:', error);
    return null;
  }
}

/**
 * Get LP mining positions for a user
 */
export async function getLPMiningPositions(walletAddress) {
  try {
    const { data, error } = await supabase
      .from('lp_mining_positions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching LP positions:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getLPMiningPositions:', error);
    return [];
  }
}

/**
 * Get LP mining leaderboard
 */
export async function getLPMiningLeaderboard(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('lp_mining_leaderboard')
      .select('*')
      .order('afrox_value', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching LP leaderboard:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getLPMiningLeaderboard:', error);
    return [];
  }
}

/**
 * Update LP mining leaderboard
 */
export async function updateLPMiningLeaderboard(walletAddress) {
  try {
    const lowerWallet = walletAddress.toLowerCase();

    // Get aggregated stats for this user
    const { data: positions } = await supabase
      .from('lp_mining_positions')
      .select('lp_amount, afrox_value, total_rewards')
      .eq('wallet_address', lowerWallet)
      .eq('status', 'locked');

    const stats = {
      total_lp_locked: positions?.reduce((sum, p) => sum + parseFloat(p.lp_amount || 0), 0) || 0,
      afrox_value: positions?.reduce((sum, p) => sum + parseFloat(p.afrox_value || 0), 0) || 0,
      total_rewards_earned: positions?.reduce((sum, p) => sum + parseFloat(p.total_rewards || 0), 0) || 0,
      position_count: positions?.length || 0
    };

    await supabase
      .from('lp_mining_leaderboard')
      .upsert({
        wallet_address: lowerWallet,
        wallet: lowerWallet,
        ...stats,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'wallet_address'
      });
  } catch (error) {
    console.error('Error updating LP leaderboard:', error);
  }
}

// =============================================
// GOVERNANCE
// =============================================

/**
 * Get governance proposals
 */
export async function getGovernanceProposals(status = null) {
  try {
    let query = supabase
      .from('governance_proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching proposals:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getGovernanceProposals:', error);
    return [];
  }
}

/**
 * Submit a vote
 */
export async function submitVote(proposalId, voterAddress, support, voteWeight, badgeTier = null, optionId = null) {
  try {
    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('governance_votes')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('voter_address', voterAddress.toLowerCase())
      .single();

    if (existingVote) {
      throw new Error('You have already voted on this proposal');
    }

    // Record the vote
    const { error: voteError } = await supabase
      .from('governance_votes')
      .insert({
        proposal_id: proposalId,
        voter_address: voterAddress.toLowerCase(),
        vote_type: optionId ? 'option' : (support ? 'for' : 'against'),
        option_id: optionId,
        vote_weight: voteWeight,
        badge_tier: badgeTier,
        created_at: new Date().toISOString()
      });

    if (voteError) throw voteError;

    // Update proposal vote counts
    if (!optionId) {
      const updateField = support ? 'votes_for' : 'votes_against';
      
      // Get current votes
      const { data: proposal } = await supabase
        .from('governance_proposals')
        .select(updateField)
        .eq('id', proposalId)
        .single();

      const currentVotes = parseFloat(proposal?.[updateField] || 0);

      await supabase
        .from('governance_proposals')
        .update({ [updateField]: currentVotes + voteWeight })
        .eq('id', proposalId);
    }

    console.log(`✅ Vote recorded: ${support ? 'FOR' : 'AGAINST'} on ${proposalId}`);
    return { success: true };
  } catch (error) {
    console.error('Error submitting vote:', error);
    throw error;
  }
}

/**
 * Create a new proposal
 */
export async function createProposal(proposalData) {
  try {
    const proposalId = proposalData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + (proposalData.votingDurationDays || 7));

    const { data, error } = await supabase
      .from('governance_proposals')
      .insert({
        id: proposalId + '-' + Date.now(),
        title: proposalData.title,
        description: proposalData.description,
        category: proposalData.category,
        proposer: proposalData.proposer.toLowerCase(),
        voting_duration_days: proposalData.votingDurationDays || 7,
        quorum: 100000000000, // 100B
        votes_for: 0,
        votes_against: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        ends_at: endsAt.toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Proposal created: ${proposalData.title}`);
    return data;
  } catch (error) {
    console.error('Error creating proposal:', error);
    throw error;
  }
}

// =============================================
// COMMISSIONS
// =============================================

/**
 * Record commission for referral
 */
export async function recordCommission(
  ambassadorAddress,
  refereeAddress,
  amount,
  level,
  rate,
  eventType = 'staking'
) {
  try {
    const { data, error } = await supabase
      .from('commissions')
      .insert({
        ambassador_address: ambassadorAddress.toLowerCase(),
        referee_address: refereeAddress.toLowerCase(),
        commission_type: eventType,
        level: level,
        amount: amount,
        rate_applied: rate,
        is_eligible: true,
        is_claimable: false, // Becomes claimable after 30 days
        claimed: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update ambassador leaderboard
    await updateAmbassadorLeaderboard(ambassadorAddress);

    return data;
  } catch (error) {
    console.error('Error recording commission:', error);
    return null;
  }
}

/**
 * Get claimable commissions for user
 */
export async function getClaimableCommissions(walletAddress) {
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('ambassador_address', walletAddress.toLowerCase())
      .eq('is_claimable', true)
      .eq('claimed', false);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching claimable commissions:', error);
    return [];
  }
}

// =============================================
// LOOKUP BY REFERRAL CODE
// =============================================

/**
 * Find referrer by referral code
 */
export async function findReferrerByCode(referralCode) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('wallet_address, referral_code, badge_tier')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding referrer:', error);
    }
    return data;
  } catch (error) {
    console.error('Error in findReferrerByCode:', error);
    return null;
  }
}

// =============================================
// INITIALIZATION HELPER
// =============================================

/**
 * Initialize user on first connection
 * Call this when wallet connects
 */
export async function initializeUserOnConnect(walletAddress, referralCode = null) {
  try {
    // Check if user exists
    let user = await getUser(walletAddress);
    
    if (!user) {
      // New user - check for referrer
      let referrerAddress = null;
      if (referralCode) {
        const referrer = await findReferrerByCode(referralCode);
        if (referrer) {
          referrerAddress = referrer.wallet_address;
        }
      }

      // Create user
      user = await upsertUser(walletAddress, referrerAddress, 0);

      // Register referral if applicable
      if (referrerAddress) {
        await registerReferral(referrerAddress, walletAddress);
      }
    }

    return user;
  } catch (error) {
    console.error('Error initializing user:', error);
    return null;
  }
}

// Export all functions
export default {
  supabase,
  generateReferralCode,
  createReferralLink,
  getBadgeTierFromStake,
  upsertUser,
  getUser,
  updateUserStake,
  recordStakingEvent,
  getStakingHistory,
  registerReferral,
  getAmbassadorStats,
  getReferralTree,
  getAmbassadorLeaderboard,
  updateAmbassadorLeaderboard,
  recordLPMiningPosition,
  getLPMiningPositions,
  getLPMiningLeaderboard,
  getGovernanceProposals,
  submitVote,
  createProposal,
  recordCommission,
  getClaimableCommissions,
  findReferrerByCode,
  initializeUserOnConnect
};
