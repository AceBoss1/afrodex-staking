// src/lib/supabaseClient.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Generate referral code from wallet address
 * Format: First 8 chars after 0x (cfbD73A1 not D73A1404)
 */
export function generateReferralCode(address) {
  if (!address) return '';
  // Remove 0x and take first 8 characters
  return address.slice(2, 10);
}

/**
 * Create referral link
 */
export function createReferralLink(code) {
  return `https://dashboard.afrox.one/?ref=${code}`;
}

/**
 * Register a new referral
 */
export async function registerReferral(referrerAddress, refereeAddress) {
  try {
    const referrerCode = generateReferralCode(referrerAddress);
    
    // Check if referral already exists
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_address', referrerAddress.toLowerCase())
      .eq('referee_address', refereeAddress.toLowerCase())
      .single();

    if (existing) {
      return { success: true, message: 'Referral already exists' };
    }

    // Insert new referral
    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_address: referrerAddress.toLowerCase(),
        referee_address: refereeAddress.toLowerCase(),
        referral_code: referrerCode,
        level: 1, // Direct referral (L1)
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Build referral tree (L2-L5)
    await buildReferralTree(referrerAddress, refereeAddress);

    return { success: true, data };
  } catch (error) {
    console.error('Error registering referral:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Build multi-level referral tree (L2-L5)
 */
async function buildReferralTree(referrerAddress, newRefereeAddress) {
  try {
    // Get referrer's upline (their referrer)
    const { data: upline } = await supabase
      .from('referrals')
      .select('referrer_address, level')
      .eq('referee_address', referrerAddress.toLowerCase())
      .order('level', { ascending: true });

    if (!upline || upline.length === 0) return;

    // Add L2-L5 relationships
    for (const ancestor of upline) {
      const newLevel = ancestor.level + 1;
      if (newLevel <= 5) {
        await supabase.from('referrals').insert({
          referrer_address: ancestor.referrer_address,
          referee_address: newRefereeAddress.toLowerCase(),
          referral_code: generateReferralCode(ancestor.referrer_address),
          level: newLevel,
          created_at: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error building referral tree:', error);
  }
}

/**
 * Get ambassador stats
 */
export async function getAmbassadorStats(address) {
  try {
    const lowerAddress = address.toLowerCase();

    // Get all referrals by level
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

    // Count by level
    const stats = {
      totalReferrals: referrals.length,
      l1: referrals.filter(r => r.level === 1).length,
      l2: referrals.filter(r => r.level === 2).length,
      l3: referrals.filter(r => r.level === 3).length,
      l4: referrals.filter(r => r.level === 4).length,
      l5: referrals.filter(r => r.level === 5).length
    };

    // Get commissions
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

/**
 * Get referral tree (network visualization)
 */
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

/**
 * Record commission event
 */
export async function recordCommission(
  ambassadorAddress,
  refereeAddress,
  amount,
  level,
  eventType = 'first_claim'
) {
  try {
    const { data, error } = await supabase
      .from('commissions')
      .insert({
        ambassador_address: ambassadorAddress.toLowerCase(),
        referee_address: refereeAddress.toLowerCase(),
        amount: amount.toString(),
        level,
        event_type: eventType,
        claimed: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Also log to referral_events
    await supabase.from('referral_events').insert({
      referrer_address: ambassadorAddress.toLowerCase(),
      referee_address: refereeAddress.toLowerCase(),
      event_type: eventType,
      amount: amount.toString(),
      level,
      created_at: new Date().toISOString()
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error recording commission:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Claim commissions
 */
export async function claimCommissions(ambassadorAddress) {
  try {
    // Get unclaimed commissions
    const { data: unclaimed } = await supabase
      .from('commissions')
      .select('*')
      .eq('ambassador_address', ambassadorAddress.toLowerCase())
      .eq('claimed', false);

    if (!unclaimed || unclaimed.length === 0) {
      return { success: false, error: 'No commissions to claim' };
    }

    const totalAmount = unclaimed.reduce((sum, c) => sum + parseFloat(c.amount), 0);

    // Mark as claimed
    const { error } = await supabase
      .from('commissions')
      .update({ 
        claimed: true,
        claimed_at: new Date().toISOString()
      })
      .eq('ambassador_address', ambassadorAddress.toLowerCase())
      .eq('claimed', false);

    if (error) throw error;

    return { success: true, amount: totalAmount };
  } catch (error) {
    console.error('Error claiming commissions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get leaderboard
 */
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

/**
 * Update leaderboard (call this periodically or on commission events)
 */
export async function updateLeaderboard(ambassadorAddress) {
  try {
    const stats = await getAmbassadorStats(ambassadorAddress);
    if (!stats) return;

    const { error } = await supabase
      .from('ambassador_leaderboard')
      .upsert({
        ambassador_address: ambassadorAddress.toLowerCase(),
        total_referrals: stats.totalReferrals,
        total_earned: stats.totalEarned,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'ambassador_address'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating leaderboard:', error);
  }
}

/**
 * Example usage in components:
 * 
 * import { supabase, getAmbassadorStats, registerReferral } from '@/lib/supabaseClient';
 * 
 * const stats = await getAmbassadorStats(userAddress);
 * const result = await registerReferral(referrerAddress, newUserAddress);
 */
