// src/lib/ambassadorApi.js
// Supabase API functions for Ambassador Dashboard

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =============================================
// USER MANAGEMENT
// =============================================

/**
 * Create or get user
 * @param {string} walletAddress - User's wallet address
 * @param {string} referrerCode - Optional referral code
 */
export async function createOrGetUser(walletAddress, referrerCode = null) {
  try {
    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (existingUser) {
      return { user: existingUser, isNew: false };
    }

    // Find referrer if code provided
    let referrerWallet = null;
    if (referrerCode) {
      const { data: referrer } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('referral_code', referrerCode)
        .single();
      
      if (referrer) {
        referrerWallet = referrer.wallet_address;
      }
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          wallet_address: walletAddress.toLowerCase(),
          referred_by_wallet: referrerWallet,
          first_stake_date: null,
        },
      ])
      .select()
      .single();

    if (createError) throw createError;

    return { user: newUser, isNew: true };
  } catch (error) {
    console.error('Error creating/getting user:', error);
    throw error;
  }
}

/**
 * Update user's staking info
 */
export async function updateUserStake(walletAddress, stakedAmount, badgeTier) {
  try {
    const isEligible = stakedAmount >= 1000000000; // ≥1B

    const { data, error } = await supabase
      .from('users')
      .update({
        total_staked: stakedAmount,
        badge_tier: badgeTier,
        is_eligible_ambassador: isEligible,
        last_activity_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress.toLowerCase())
      .select()
      .single();

    if (error) throw error;

    // Update commission eligibility
    await supabase.rpc('update_commission_eligibility');

    return data;
  } catch (error) {
    console.error('Error updating user stake:', error);
    throw error;
  }
}

// =============================================
// REFERRAL MANAGEMENT
// =============================================

/**
 * Get user's referral stats
 */
export async function getAmbassadorStats(walletAddress) {
  try {
    const { data, error } = await supabase
      .from('ambassador_stats')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return data || {
      wallet_address: walletAddress.toLowerCase(),
      total_referrals: 0,
      l1_count: 0,
      l2_count: 0,
      l3_count: 0,
      l4_count: 0,
      l5_count: 0,
      total_commissions_earned: 0,
      total_commissions_claimed: 0,
      total_pending_commissions: 0,
      current_tier: 'Starter',
    };
  } catch (error) {
    console.error('Error getting ambassador stats:', error);
    throw error;
  }
}

/**
 * Get referral tree (all levels)
 */
export async function getReferralTree(walletAddress, level = null) {
  try {
    let query = supabase
      .from('referral_tree')
      .select(`
        *,
        descendant:users!referral_tree_descendant_wallet_fkey (
          wallet_address,
          badge_tier,
          total_staked,
          is_eligible_ambassador
        )
      `)
      .eq('ancestor_wallet', walletAddress.toLowerCase())
      .eq('is_active', true)
      .order('level', { ascending: true })
      .order('created_at', { ascending: true });

    if (level !== null) {
      query = query.eq('level', level);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error getting referral tree:', error);
    throw error;
  }
}

// =============================================
// COMMISSIONS MANAGEMENT
// =============================================

/**
 * Get claimable commissions
 */
export async function getClaimableCommissions(walletAddress) {
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('ambassador_wallet', walletAddress.toLowerCase())
      .eq('is_claimable', true)
      .eq('claimed', false)
      .order('earned_at', { ascending: false });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error getting claimable commissions:', error);
    throw error;
  }
}

/**
 * Create commission claim queue entry
 */
export async function createClaimQueue(walletAddress, commissionIds, totalAmount) {
  try {
    const { data, error } = await supabase
      .from('commission_claim_queue')
      .insert([
        {
          ambassador_wallet: walletAddress.toLowerCase(),
          total_claimable_amount: totalAmount,
          commission_ids: commissionIds,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating claim queue:', error);
    throw error;
  }
}

/**
 * Update claim status after blockchain transaction
 */
export async function updateClaimStatus(queueId, txHash, status = 'completed') {
  try {
    // Update queue
    await supabase
      .from('commission_claim_queue')
      .update({
        status,
        tx_hash: txHash,
        processed_at: new Date().toISOString(),
      })
      .eq('id', queueId);

    if (status === 'completed') {
      // Get the commission IDs from the queue
      const { data: queue } = await supabase
        .from('commission_claim_queue')
        .select('commission_ids')
        .eq('id', queueId)
        .single();

      if (queue && queue.commission_ids) {
        // Mark commissions as claimed
        await supabase
          .from('commissions')
          .update({
            claimed: true,
            claimed_at: new Date().toISOString(),
            tx_hash: txHash,
          })
          .in('id', queue.commission_ids);
      }
    }
  } catch (error) {
    console.error('Error updating claim status:', error);
    throw error;
  }
}

/**
 * Record 30-day reward claim event (triggers commissions)
 */
export async function recordThirtyDayRewardClaim(walletAddress, rewardAmount, txHash) {
  try {
    // Get user's referrer
    const { data: user } = await supabase
      .from('users')
      .select('referred_by_wallet, thirty_days_reward_claimed')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    if (!user || user.thirty_days_reward_claimed) {
      return; // Already claimed or no referrer
    }

    // Mark as claimed
    await supabase
      .from('users')
      .update({ thirty_days_reward_claimed: true })
      .eq('wallet_address', walletAddress.toLowerCase());

    if (!user.referred_by_wallet) return;

    // Create referral event
    const { data: event } = await supabase
      .from('referral_events')
      .insert([
        {
          event_type: 'thirty_day_claim',
          referred_wallet: walletAddress.toLowerCase(),
          referrer_wallet: user.referred_by_wallet,
          event_amount: rewardAmount,
          tx_hash: txHash,
        },
      ])
      .select()
      .single();

    // Calculate and create commissions for L1-L5
    await calculateAndCreateCommissions(walletAddress.toLowerCase(), rewardAmount, event.id);

    // Update stats for all ancestors
    await updateAncestorStats(walletAddress.toLowerCase());
  } catch (error) {
    console.error('Error recording 30-day claim:', error);
    throw error;
  }
}

/**
 * Calculate and create commissions for referral tree
 */
async function calculateAndCreateCommissions(referredWallet, rewardAmount, eventId) {
  try {
    // Get all ancestors (L1-L5)
    const { data: ancestors } = await supabase
      .from('referral_tree')
      .select(`
        *,
        ancestor:users!referral_tree_ancestor_wallet_fkey (
          wallet_address,
          badge_tier,
          total_staked,
          is_eligible_ambassador
        )
      `)
      .eq('descendant_wallet', referredWallet)
      .eq('is_active', true);

    if (!ancestors) return;

    // Get commission rates
    const { data: rates } = await supabase
      .from('commission_rates')
      .select('*');

    const ratesMap = {};
    rates.forEach(r => {
      ratesMap[r.tier_name] = r;
    });

    const commissions = [];

    for (const ancestor of ancestors) {
      const tier = ancestor.ancestor.badge_tier;
      const tierRate = ratesMap[tier];
      
      if (!tierRate || ancestor.level > tierRate.max_level) continue;

      let rate = 0;
      if (ancestor.level === 1) rate = tierRate.l1_rate;
      else if (ancestor.level === 2) rate = tierRate.l2_rate;
      else if (ancestor.level === 3) rate = tierRate.l3_rate;
      else if (ancestor.level === 4) rate = tierRate.l4_rate;
      else if (ancestor.level === 5) rate = tierRate.l5_rate;

      if (rate > 0) {
        const commissionAmount = rewardAmount * rate;
        const isEligible = ancestor.ancestor.is_eligible_ambassador;

        commissions.push({
          ambassador_wallet: ancestor.ancestor_wallet,
          referred_wallet: referredWallet,
          commission_type: 'staking',
          level: ancestor.level,
          amount: commissionAmount,
          rate_applied: rate,
          is_eligible: isEligible,
          is_claimable: isEligible, // Immediately claimable if eligible
          referral_event_id: eventId,
        });
      }
    }

    if (commissions.length > 0) {
      await supabase.from('commissions').insert(commissions);
    }
  } catch (error) {
    console.error('Error calculating commissions:', error);
    throw error;
  }
}

/**
 * Update stats for all ancestors
 */
async function updateAncestorStats(walletAddress) {
  try {
    const { data: ancestors } = await supabase
      .from('referral_tree')
      .select('ancestor_wallet')
      .eq('descendant_wallet', walletAddress);

    if (ancestors) {
      for (const { ancestor_wallet } of ancestors) {
        await supabase.rpc('update_ambassador_stats', {
          ambassador_addr: ancestor_wallet,
        });
      }
    }
  } catch (error) {
    console.error('Error updating ancestor stats:', error);
  }
}

// =============================================
// LEADERBOARD
// =============================================

/**
 * Get leaderboard
 */
export async function getLeaderboard(period = 'all_time', limit = 100) {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('period', period)
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get commission rates for tier
 */
export async function getCommissionRatesForTier(tier) {
  try {
    const { data, error } = await supabase
      .from('commission_rates')
      .select('*')
      .eq('tier_name', tier)
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error getting commission rates:', error);
    return null;
  }
}
