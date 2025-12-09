// src/lib/supabaseClient.js
// FIXED: Proper staking event recording with amount, block, hash, and commission calculation
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// =============================================
// COMMISSION RATES BY TIER AND LEVEL
// =============================================
const COMMISSION_RATES = {
  'Diamond Custodian': { 1: 0.15, 2: 0.10, 3: 0.07, 4: 0.05, 5: 0.03 },
  'Platinum Sentinel': { 1: 0.15, 2: 0.10, 3: 0.07, 4: 0.05, 5: 0.03 },
  'Marshal':           { 1: 0.15, 2: 0.10, 3: 0.07, 4: 0.05, 5: 0.03 },
  'General':           { 1: 0.15, 2: 0.10, 3: 0.07, 4: 0.05, 5: 0 },
  'Commander':         { 1: 0.15, 2: 0.10, 3: 0.07, 4: 0, 5: 0 },
  'Captain':           { 1: 0.15, 2: 0.10, 3: 0, 4: 0, 5: 0 },
  'Cadet':             { 1: 0.15, 2: 0, 3: 0, 4: 0, 5: 0 },
  'Starter':           { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
};

// Minimum stake required to receive commissions (1B tokens)
const MIN_STAKE_FOR_COMMISSION = 1e9;

// Commission claim period (30 days)
const COMMISSION_CLAIM_PERIOD_DAYS = 30;

/**
 * Get commission rate for a tier and level
 */
export function getCommissionRate(tier, level) {
  const tierRates = COMMISSION_RATES[tier] || COMMISSION_RATES['Starter'];
  return tierRates[level] || 0;
}

/**
 * Generate referral code from wallet address
 */
export function generateReferralCode(walletAddress) {
  if (!walletAddress) return null;
  return walletAddress.slice(2, 10);
}

/**
 * Initialize user on wallet connect
 */
export async function initializeUserOnConnect(walletAddress, referralCode = null) {
  if (!supabase || !walletAddress) return null;
  
  const lowerAddress = walletAddress.toLowerCase();
  
  try {
    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', lowerAddress)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return null;
    }
    
    if (existingUser) {
      console.log(`✅ User exists: ${lowerAddress.slice(0, 10)}...`);
      return existingUser;
    }
    
    // Create new user
    const newReferralCode = generateReferralCode(walletAddress);
    
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        wallet_address: lowerAddress,
        referral_code: newReferralCode,
        total_staked: 0,
        badge_tier: 'Starter',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating user:', insertError);
      return null;
    }
    
    console.log(`🆕 New user created: ${lowerAddress.slice(0, 10)}...`);
    
    // If referral code provided, register the referral
    if (referralCode && referralCode !== newReferralCode) {
      await registerReferralByCode(referralCode, lowerAddress);
    }
    
    // Initialize ambassador stats
    await initializeAmbassadorStats(lowerAddress);
    
    return newUser;
  } catch (error) {
    console.error('Error in initializeUserOnConnect:', error);
    return null;
  }
}

/**
 * Initialize ambassador stats for new user
 */
async function initializeAmbassadorStats(walletAddress) {
  if (!supabase || !walletAddress) return;
  
  const lowerAddress = walletAddress.toLowerCase();
  
  try {
    const { error } = await supabase
      .from('ambassador_stats')
      .upsert({
        wallet_address: lowerAddress,
        total_referrals: 0,
        level_1_count: 0,
        level_2_count: 0,
        level_3_count: 0,
        level_4_count: 0,
        level_5_count: 0,
        total_earned: 0,
        total_claimed: 0,
        pending_commissions: 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'wallet_address' });
    
    if (error) console.error('Error initializing ambassador stats:', error);
  } catch (error) {
    console.error('Error in initializeAmbassadorStats:', error);
  }
}

/**
 * Get user by wallet address
 */
export async function getUser(walletAddress) {
  if (!supabase || !walletAddress) return null;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting user:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getUser:', error);
    return null;
  }
}

/**
 * Update user's staked amount and badge tier
 */
export async function updateUserStake(walletAddress, totalStaked) {
  if (!supabase || !walletAddress) return null;
  
  const lowerAddress = walletAddress.toLowerCase();
  const badgeTier = getBadgeTierFromStake(totalStaked);
  
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        total_staked: totalStaked,
        badge_tier: badgeTier,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', lowerAddress)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user stake:', error);
      return null;
    }
    
    console.log(`📊 Updated stake for ${lowerAddress.slice(0, 10)}...: ${totalStaked} (${badgeTier})`);
    return data;
  } catch (error) {
    console.error('Error in updateUserStake:', error);
    return null;
  }
}

/**
 * Get badge tier from stake amount
 */
function getBadgeTierFromStake(staked) {
  const amount = Number(staked || 0);
  if (amount >= 10e12) return 'Diamond Custodian';
  if (amount >= 1e12) return 'Platinum Sentinel';
  if (amount >= 500e9) return 'Marshal';
  if (amount >= 100e9) return 'General';
  if (amount >= 50e9) return 'Commander';
  if (amount >= 10e9) return 'Captain';
  if (amount >= 1e9) return 'Cadet';
  return 'Starter';
}

/**
 * Find referrer by code
 */
export async function findReferrerByCode(referralCode) {
  if (!supabase || !referralCode) return null;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('wallet_address, referral_code, badge_tier, total_staked')
      .eq('referral_code', referralCode)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error finding referrer:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in findReferrerByCode:', error);
    return null;
  }
}

/**
 * Register referral by code
 */
async function registerReferralByCode(referralCode, refereeAddress) {
  if (!supabase || !referralCode || !refereeAddress) return false;
  
  try {
    const referrer = await findReferrerByCode(referralCode);
    if (!referrer) {
      console.log(`❌ Referral code not found: ${referralCode}`);
      return false;
    }
    
    // Don't allow self-referral
    if (referrer.wallet_address.toLowerCase() === refereeAddress.toLowerCase()) {
      console.log('❌ Self-referral not allowed');
      return false;
    }
    
    return await registerReferral(referrer.wallet_address, refereeAddress);
  } catch (error) {
    console.error('Error in registerReferralByCode:', error);
    return false;
  }
}

/**
 * Register referral relationship (builds L1-L5 chain)
 */
export async function registerReferral(referrerAddress, refereeAddress) {
  if (!supabase || !referrerAddress || !refereeAddress) return false;
  
  const lowerReferrer = referrerAddress.toLowerCase();
  const lowerReferee = refereeAddress.toLowerCase();
  
  try {
    // Check if referral already exists
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_address', lowerReferrer)
      .eq('referee_address', lowerReferee)
      .single();
    
    if (existing) {
      console.log('📎 Referral already exists');
      return true;
    }
    
    // Insert L1 (direct referral)
    const { error: l1Error } = await supabase
      .from('referrals')
      .insert({
        referrer_address: lowerReferrer,
        referee_address: lowerReferee,
        level: 1,
        is_active: true,
        created_at: new Date().toISOString()
      });
    
    if (l1Error) {
      console.error('Error inserting L1 referral:', l1Error);
      return false;
    }
    
    console.log(`✅ L1 referral registered: ${lowerReferrer.slice(0, 10)}... → ${lowerReferee.slice(0, 10)}...`);
    
    // Build L2-L5 chain by finding referrer's upline
    const { data: uplineChain } = await supabase
      .from('referrals')
      .select('referrer_address, level')
      .eq('referee_address', lowerReferrer)
      .eq('is_active', true)
      .order('level', { ascending: true })
      .limit(4);
    
    if (uplineChain && uplineChain.length > 0) {
      for (const upline of uplineChain) {
        const newLevel = upline.level + 1;
        if (newLevel > 5) break;
        
        await supabase
          .from('referrals')
          .insert({
            referrer_address: upline.referrer_address,
            referee_address: lowerReferee,
            level: newLevel,
            is_active: true,
            created_at: new Date().toISOString()
          });
        
        console.log(`✅ L${newLevel} referral registered: ${upline.referrer_address.slice(0, 10)}... → ${lowerReferee.slice(0, 10)}...`);
      }
    }
    
    // Update ambassador stats
    await updateAmbassadorStats(lowerReferrer);
    
    return true;
  } catch (error) {
    console.error('Error in registerReferral:', error);
    return false;
  }
}

// =============================================
// FIXED: Record Staking Event with ALL data
// =============================================
export async function recordStakingEvent(walletAddress, eventType, amount, txHash, blockNumber = null) {
  if (!supabase || !walletAddress) {
    console.error('❌ recordStakingEvent: Missing supabase or walletAddress');
    return null;
  }
  
  const lowerAddress = walletAddress.toLowerCase();
  const amountNum = Number(amount) || 0;
  
  console.log(`📝 Recording staking event:`);
  console.log(`   Wallet: ${lowerAddress.slice(0, 10)}...`);
  console.log(`   Type: ${eventType}`);
  console.log(`   Amount: ${amountNum}`);
  console.log(`   TxHash: ${txHash || 'null'}`);
  console.log(`   Block: ${blockNumber || 'null'}`);
  
  try {
    // Insert staking event with ALL fields
    const eventData = {
      wallet_address: lowerAddress,
      event_type: eventType,
      amount: amountNum,
      tx_hash: txHash || null,
      block_number: blockNumber || null,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('staking_events')
      .insert(eventData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error inserting staking event:', error);
      return null;
    }
    
    console.log(`✅ Staking event recorded with ID: ${data?.id}`);
    
    // =============================================
    // FIXED: Calculate and record commissions for STAKE events
    // =============================================
    if (eventType === 'stake' && amountNum > 0 && txHash) {
      console.log(`💰 Triggering commission calculation...`);
      await calculateAndRecordCommissions(lowerAddress, amountNum, txHash, blockNumber);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error in recordStakingEvent:', error);
    return null;
  }
}

// =============================================
// FIXED: Calculate and Record Commissions for L1-L5
// =============================================
async function calculateAndRecordCommissions(stakerAddress, stakeAmount, txHash, blockNumber = null) {
  if (!supabase || !stakerAddress || !stakeAmount || !txHash) {
    console.error('❌ calculateAndRecordCommissions: Missing required params');
    console.log(`   stakerAddress: ${stakerAddress}`);
    console.log(`   stakeAmount: ${stakeAmount}`);
    console.log(`   txHash: ${txHash}`);
    return;
  }
  
  const lowerStaker = stakerAddress.toLowerCase();
  
  try {
    // Calculate first 30 days rewards: stake × 0.6% daily × 30 days = stake × 18%
    const firstMonthRewards = stakeAmount * 0.18;
    
    console.log(`📊 Calculating commissions for staker ${lowerStaker.slice(0, 10)}...`);
    console.log(`   Stake amount: ${stakeAmount}`);
    console.log(`   First 30 days rewards: ${firstMonthRewards}`);
    
    // Get referral chain (all ambassadors who referred this staker)
    const { data: referralChain, error: refError } = await supabase
      .from('referrals')
      .select('referrer_address, level')
      .eq('referee_address', lowerStaker)
      .eq('is_active', true)
      .order('level', { ascending: true })
      .limit(5);
    
    if (refError) {
      console.error('❌ Error getting referral chain:', refError);
      return;
    }
    
    if (!referralChain || referralChain.length === 0) {
      console.log('   ℹ️ No referrers found for this staker');
      return;
    }
    
    console.log(`   Found ${referralChain.length} referrers in chain`);
    
    // Calculate claimable date (30 days from now)
    const claimableAt = new Date(Date.now() + COMMISSION_CLAIM_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    
    // Process each level in the referral chain
    for (const ref of referralChain) {
      const ambassadorAddress = ref.referrer_address;
      const level = ref.level;
      
      console.log(`   Processing L${level}: ${ambassadorAddress.slice(0, 10)}...`);
      
      // Get ambassador's data
      const ambassador = await getUser(ambassadorAddress);
      if (!ambassador) {
        console.log(`   ⚠️ Skipping L${level}: Ambassador not found`);
        continue;
      }
      
      // Check if ambassador meets minimum stake requirement
      const ambassadorStake = Number(ambassador.total_staked || 0);
      if (ambassadorStake < MIN_STAKE_FOR_COMMISSION) {
        console.log(`   ⚠️ Skipping L${level}: Ambassador stake (${ambassadorStake}) below minimum (${MIN_STAKE_FOR_COMMISSION})`);
        continue;
      }
      
      // Get commission rate for ambassador's tier and this level
      const rate = getCommissionRate(ambassador.badge_tier, level);
      if (rate <= 0) {
        console.log(`   ⚠️ Skipping L${level}: Rate is 0 for tier ${ambassador.badge_tier}`);
        continue;
      }
      
      // Calculate commission amount
      const commissionAmount = firstMonthRewards * rate;
      
      console.log(`   L${level} Rate: ${rate * 100}%, Commission: ${commissionAmount}`);
      
      // Check if commission already exists for this tx + level
      const { data: existing } = await supabase
        .from('commissions')
        .select('id')
        .eq('ambassador_address', ambassadorAddress)
        .eq('referee_address', lowerStaker)
        .eq('tx_hash', txHash)
        .eq('level', level)
        .single();
      
      if (existing) {
        console.log(`   ⚠️ Skipping L${level}: Commission already exists for this tx`);
        continue;
      }
      
      // Insert commission record
      const commissionData = {
        ambassador_address: ambassadorAddress,
        referee_address: lowerStaker,
        commission_type: 'staking',
        level: level,
        stake_amount: stakeAmount,
        amount: commissionAmount,
        rate_applied: rate,
        is_eligible: true,
        is_claimable: false,
        claimable_at: claimableAt,
        tx_hash: txHash,
        block_number: blockNumber,
        created_at: new Date().toISOString()
      };
      
      const { data: insertedCommission, error: insertError } = await supabase
        .from('commissions')
        .insert(commissionData)
        .select()
        .single();
      
      if (insertError) {
        console.error(`   ❌ Error inserting L${level} commission:`, insertError);
        continue;
      }
      
      console.log(`   ✅ L${level} Commission recorded: ${commissionAmount} AfroX (ID: ${insertedCommission?.id})`);
      
      // Update ambassador's pending commissions
      await updateAmbassadorStats(ambassadorAddress);
    }
    
    console.log(`✅ Commission calculation complete`);
    
  } catch (error) {
    console.error('❌ Error in calculateAndRecordCommissions:', error);
  }
}

/**
 * Update ambassador stats (recalculate from referrals and commissions)
 */
export async function updateAmbassadorStats(walletAddress) {
  if (!supabase || !walletAddress) return;
  
  const lowerAddress = walletAddress.toLowerCase();
  
  try {
    // Count referrals by level
    const { data: l1 } = await supabase.from('referrals').select('id', { count: 'exact' }).eq('referrer_address', lowerAddress).eq('level', 1).eq('is_active', true);
    const { data: l2 } = await supabase.from('referrals').select('id', { count: 'exact' }).eq('referrer_address', lowerAddress).eq('level', 2).eq('is_active', true);
    const { data: l3 } = await supabase.from('referrals').select('id', { count: 'exact' }).eq('referrer_address', lowerAddress).eq('level', 3).eq('is_active', true);
    const { data: l4 } = await supabase.from('referrals').select('id', { count: 'exact' }).eq('referrer_address', lowerAddress).eq('level', 4).eq('is_active', true);
    const { data: l5 } = await supabase.from('referrals').select('id', { count: 'exact' }).eq('referrer_address', lowerAddress).eq('level', 5).eq('is_active', true);
    
    const l1Count = l1?.length || 0;
    const l2Count = l2?.length || 0;
    const l3Count = l3?.length || 0;
    const l4Count = l4?.length || 0;
    const l5Count = l5?.length || 0;
    const totalReferrals = l1Count + l2Count + l3Count + l4Count + l5Count;
    
    // Sum commissions
    const { data: claimedData } = await supabase.from('commissions').select('amount').eq('ambassador_address', lowerAddress).eq('is_claimed', true);
    const { data: pendingData } = await supabase.from('commissions').select('amount').eq('ambassador_address', lowerAddress).eq('is_claimed', false).eq('is_eligible', true);
    
    const totalClaimed = claimedData?.reduce((sum, c) => sum + Number(c.amount || 0), 0) || 0;
    const pendingCommissions = pendingData?.reduce((sum, c) => sum + Number(c.amount || 0), 0) || 0;
    const totalEarned = totalClaimed + pendingCommissions;
    
    // Update stats
    const { error } = await supabase
      .from('ambassador_stats')
      .upsert({
        wallet_address: lowerAddress,
        total_referrals: totalReferrals,
        level_1_count: l1Count,
        level_2_count: l2Count,
        level_3_count: l3Count,
        level_4_count: l4Count,
        level_5_count: l5Count,
        total_earned: totalEarned,
        total_claimed: totalClaimed,
        pending_commissions: pendingCommissions,
        updated_at: new Date().toISOString()
      }, { onConflict: 'wallet_address' });
    
    if (error) console.error('Error updating ambassador stats:', error);
    
  } catch (error) {
    console.error('Error in updateAmbassadorStats:', error);
  }
}

/**
 * Get ambassador stats with next commission info
 */
export async function getAmbassadorStats(walletAddress) {
  if (!supabase || !walletAddress) return null;
  
  const lowerAddress = walletAddress.toLowerCase();
  
  try {
    // Get basic stats
    const { data, error } = await supabase
      .from('ambassador_stats')
      .select('*')
      .eq('wallet_address', lowerAddress)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error getting ambassador stats:', error);
      return null;
    }
    
    // If no stats, create them
    if (!data) {
      await updateAmbassadorStats(lowerAddress);
      const { data: newData } = await supabase
        .from('ambassador_stats')
        .select('*')
        .eq('wallet_address', lowerAddress)
        .single();
      return newData;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getAmbassadorStats:', error);
    return null;
  }
}

/**
 * Get next commission claim info (for countdown display)
 */
export async function getNextCommissionInfo(walletAddress) {
  if (!supabase || !walletAddress) return null;
  
  const lowerAddress = walletAddress.toLowerCase();
  
  try {
    const now = new Date().toISOString();
    
    // First check if there are any commissions ready to claim NOW
    const { data: claimableNow } = await supabase
      .from('commissions')
      .select('amount')
      .eq('ambassador_address', lowerAddress)
      .eq('is_claimed', false)
      .eq('is_eligible', true)
      .lte('claimable_at', now);
    
    if (claimableNow && claimableNow.length > 0) {
      const totalClaimable = claimableNow.reduce((sum, c) => sum + Number(c.amount || 0), 0);
      return {
        hasClaimable: true,
        claimableAmount: totalClaimable,
        nextClaimDate: null,
        nextClaimAmount: 0,
        daysUntilClaim: 0
      };
    }
    
    // Get the earliest pending commission that's not yet claimable
    const { data: pendingCommissions, error } = await supabase
      .from('commissions')
      .select('claimable_at, amount')
      .eq('ambassador_address', lowerAddress)
      .eq('is_claimed', false)
      .eq('is_eligible', true)
      .gt('claimable_at', now)
      .order('claimable_at', { ascending: true });
    
    if (error) {
      console.error('Error getting next commission:', error);
      return null;
    }
    
    if (!pendingCommissions || pendingCommissions.length === 0) {
      return null;
    }
    
    // Get the earliest one for countdown
    const nextCommission = pendingCommissions[0];
    const claimableDate = new Date(nextCommission.claimable_at);
    const nowDate = new Date();
    const diffMs = claimableDate - nowDate;
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    // Sum up all pending commissions for total amount
    const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    
    return {
      hasClaimable: false,
      claimableAmount: 0,
      nextClaimDate: nextCommission.claimable_at,
      nextClaimAmount: totalPending,
      daysUntilClaim: Math.max(0, daysUntil)
    };
    
  } catch (error) {
    console.error('Error in getNextCommissionInfo:', error);
    return null;
  }
}

/**
 * Get claimable commissions
 */
export async function getClaimableCommissions(walletAddress) {
  if (!supabase || !walletAddress) return [];
  
  const lowerAddress = walletAddress.toLowerCase();
  const now = new Date().toISOString();
  
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('ambassador_address', lowerAddress)
      .eq('is_claimed', false)
      .eq('is_eligible', true)
      .lte('claimable_at', now)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error getting claimable commissions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getClaimableCommissions:', error);
    return [];
  }
}

/**
 * Get all commissions for an ambassador
 */
export async function getAllCommissions(walletAddress) {
  if (!supabase || !walletAddress) return [];
  
  const lowerAddress = walletAddress.toLowerCase();
  
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('ambassador_address', lowerAddress)
      .order('created_at', { descending: true });
    
    if (error) {
      console.error('Error getting commissions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAllCommissions:', error);
    return [];
  }
}

/**
 * Claim commissions (mark as claimed)
 */
export async function claimCommissions(walletAddress, commissionIds, txHash) {
  if (!supabase || !walletAddress || !commissionIds?.length) return false;
  
  try {
    const { error } = await supabase
      .from('commissions')
      .update({
        is_claimed: true,
        claimed_at: new Date().toISOString(),
        claim_tx_hash: txHash
      })
      .in('id', commissionIds)
      .eq('ambassador_address', walletAddress.toLowerCase());
    
    if (error) {
      console.error('Error claiming commissions:', error);
      return false;
    }
    
    // Update ambassador stats
    await updateAmbassadorStats(walletAddress);
    
    return true;
  } catch (error) {
    console.error('Error in claimCommissions:', error);
    return false;
  }
}

/**
 * Get staking history for a user
 */
export async function getStakingHistory(walletAddress, limit = 50) {
  if (!supabase || !walletAddress) return [];
  
  try {
    const { data, error } = await supabase
      .from('staking_events')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting staking history:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getStakingHistory:', error);
    return [];
  }
}

/**
 * Get referral tree for an ambassador
 */
export async function getReferralTree(walletAddress, maxDepth = 5) {
  if (!supabase || !walletAddress) return [];
  
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('referee_address, level, created_at, is_active')
      .eq('referrer_address', walletAddress.toLowerCase())
      .eq('is_active', true)
      .lte('level', maxDepth)
      .order('level', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getting referral tree:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getReferralTree:', error);
    return [];
  }
}

/**
 * Get ambassador leaderboard sorted by REFERRALS
 */
export async function getLeaderboardByReferrals(limit = 10) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('ambassador_stats')
      .select('wallet_address, total_referrals, total_earned, level_1_count')
      .gt('total_referrals', 0)
      .order('total_referrals', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting referrals leaderboard:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getLeaderboardByReferrals:', error);
    return [];
  }
}

/**
 * Get ambassador leaderboard sorted by COMMISSIONS EARNED
 */
export async function getLeaderboardByCommissions(limit = 10) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('ambassador_stats')
      .select('wallet_address, total_referrals, total_earned, pending_commissions')
      .gt('total_earned', 0)
      .order('total_earned', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting commissions leaderboard:', error);
      return [];
    }
    
    // If no one has earned yet, show by pending commissions
    if (!data || data.length === 0) {
      const { data: pendingData, error: pendingError } = await supabase
        .from('ambassador_stats')
        .select('wallet_address, total_referrals, total_earned, pending_commissions')
        .gt('pending_commissions', 0)
        .order('pending_commissions', { ascending: false })
        .limit(limit);
      
      if (pendingError) return [];
      return pendingData || [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getLeaderboardByCommissions:', error);
    return [];
  }
}

/**
 * Get ambassador leaderboard (legacy - for backwards compatibility)
 */
export async function getAmbassadorLeaderboard(limit = 50) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('ambassador_stats')
      .select('wallet_address, total_referrals, total_earned, level_1_count')
      .gt('total_referrals', 0)
      .order('total_earned', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAmbassadorLeaderboard:', error);
    return [];
  }
}

/**
 * Create/get referral link for user
 */
export async function createReferralLink(walletAddress) {
  if (!walletAddress) return null;
  
  const referralCode = generateReferralCode(walletAddress);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://hub.afrox.one';
  
  return `${baseUrl}/?ref=${referralCode}`;
}

// Export additional utilities
export { getBadgeTierFromStake, MIN_STAKE_FOR_COMMISSION, COMMISSION_RATES };
