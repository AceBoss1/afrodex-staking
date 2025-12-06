// src/lib/supabaseClient.js
// AfroX DeFi Hub - Supabase Client with Wallet Authentication
// Version 2 - Supports wallet-based auth, commission calculations, LP mining

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. Database features will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
    })
  : null;

// =============================================
// BADGE TIERS & HELPERS
// =============================================

export const BADGE_TIERS = [
  { name: 'Diamond Custodian', emoji: '❇️', minStake: 10e12, levels: 5 },
  { name: 'Platinum Sentinel', emoji: '💠', minStake: 1e12, levels: 5 },
  { name: 'Marshal', emoji: '〽️', minStake: 500e9, levels: 5 },
  { name: 'General', emoji: '⭐', minStake: 100e9, levels: 4 },
  { name: 'Commander', emoji: '⚜️', minStake: 50e9, levels: 3 },
  { name: 'Captain', emoji: '🔱', minStake: 10e9, levels: 2 },
  { name: 'Cadet', emoji: '🔰', minStake: 1e9, levels: 1 },
  { name: 'Starter', emoji: '✳️', minStake: 0, levels: 0 }
];

export function getBadgeTierFromStake(stakedBalance) {
  const staked = Number(stakedBalance || '0');
  for (const tier of BADGE_TIERS) {
    if (staked >= tier.minStake) return tier;
  }
  return BADGE_TIERS[BADGE_TIERS.length - 1];
}

export function generateReferralCode(walletAddress) {
  return walletAddress.substring(2, 10).toUpperCase();
}

export function createReferralLink(referralCode) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://hub.afrox.one';
  return `${baseUrl}/?ref=${referralCode}`;
}

// =============================================
// USER MANAGEMENT
// =============================================

export async function upsertUser(walletAddress, referredByWallet = null, totalStaked = 0) {
  if (!supabase) return null;
  try {
    const lowerWallet = walletAddress.toLowerCase();
    const referralCode = generateReferralCode(walletAddress);
    const badgeTier = getBadgeTierFromStake(totalStaked);
    
    const { data, error } = await supabase
      .from('users')
      .upsert({
        wallet_address: lowerWallet,
        referral_code: referralCode,
        referred_by_wallet: referredByWallet?.toLowerCase() || null,
        badge_tier: badgeTier.name,
        total_staked: totalStaked,
        is_eligible_ambassador: true,
        first_stake_date: totalStaked > 0 ? new Date().toISOString() : null,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'wallet_address' })
      .select()
      .single();
    
    if (error) throw error;
    console.log(`✅ User upserted: ${lowerWallet.slice(0, 10)}... (${badgeTier.name})`);
    return data;
  } catch (error) {
    console.error('Error upserting user:', error);
    return null;
  }
}

export async function getUser(walletAddress) {
  if (!supabase || !walletAddress) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function updateUserStake(walletAddress, newTotalStaked) {
  if (!supabase) return null;
  try {
    const badgeTier = getBadgeTierFromStake(newTotalStaked);
    const { data, error } = await supabase
      .from('users')
      .update({
        total_staked: newTotalStaked,
        badge_tier: badgeTier.name,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress.toLowerCase())
      .select()
      .single();
    
    if (error) throw error;
    
    // Update ambassador stats tier
    await supabase
      .from('ambassador_stats')
      .update({ current_tier: badgeTier.name, updated_at: new Date().toISOString() })
      .eq('wallet_address', walletAddress.toLowerCase());
    
    return data;
  } catch (error) {
    console.error('Error updating user stake:', error);
    return null;
  }
}

// =============================================
// STAKING EVENTS
// =============================================

export async function recordStakingEvent(walletAddress, eventType, amount, txHash, blockNumber = null) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('staking_events')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        event_type: eventType,
        amount: amount,
        tx_hash: txHash,
        block_number: blockNumber,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        console.log('Staking event already recorded:', txHash);
        return { existing: true };
      }
      throw error;
    }
    
    console.log(`✅ Staking event recorded: ${eventType} ${amount} by ${walletAddress.slice(0, 10)}...`);
    
    // Calculate commissions for stake events (trigger does this in DB, but also do client-side)
    if (eventType === 'stake') {
      await calculateAndRecordCommissions(walletAddress, amount, txHash);
    }
    
    return data;
  } catch (error) {
    console.error('Error recording staking event:', error);
    return null;
  }
}

export async function getStakingHistory(walletAddress, limit = 50) {
  if (!supabase || !walletAddress) return [];
  try {
    const { data, error } = await supabase
      .from('staking_events')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting staking history:', error);
    return [];
  }
}

// =============================================
// REFERRALS
// =============================================

export async function findReferrerByCode(referralCode) {
  if (!supabase || !referralCode) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('wallet_address, referral_code, badge_tier')
      .eq('referral_code', referralCode.toUpperCase())
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('Error finding referrer:', error);
    return null;
  }
}

export async function registerReferral(referrerAddress, refereeAddress, referralCode = null) {
  if (!supabase) return null;
  try {
    const lowerReferrer = referrerAddress.toLowerCase();
    const lowerReferee = refereeAddress.toLowerCase();
    
    // Get referrer's code
    const referrer = await getUser(referrerAddress);
    const code = referralCode || referrer?.referral_code || generateReferralCode(referrerAddress);
    
    // Insert L1 referral
    await supabase
      .from('referrals')
      .upsert({
        referrer_address: lowerReferrer,
        referee_address: lowerReferee,
        referral_code: code,
        level: 1,
        is_active: true,
        created_at: new Date().toISOString()
      }, { onConflict: 'referrer_address,referee_address,level' });
    
    // Build L2-L5 chain
    const { data: referrerChain } = await supabase
      .from('referrals')
      .select('referrer_address, level, referral_code')
      .eq('referee_address', lowerReferrer)
      .order('level', { ascending: true })
      .limit(4);
    
    if (referrerChain) {
      for (const ancestor of referrerChain) {
        const newLevel = ancestor.level + 1;
        if (newLevel <= 5) {
          await supabase
            .from('referrals')
            .upsert({
              referrer_address: ancestor.referrer_address,
              referee_address: lowerReferee,
              referral_code: ancestor.referral_code,
              level: newLevel,
              is_active: true,
              created_at: new Date().toISOString()
            }, { onConflict: 'referrer_address,referee_address,level' });
        }
      }
    }
    
    // Record event
    await supabase.from('referral_events').insert({
      referrer_address: lowerReferrer,
      referee_address: lowerReferee,
      event_type: 'signup',
      level: 1,
      created_at: new Date().toISOString()
    });
    
    // Update stats
    await updateAmbassadorStats(referrerAddress);
    
    console.log(`✅ Referral registered: ${lowerReferrer.slice(0, 10)}... → ${lowerReferee.slice(0, 10)}...`);
    return true;
  } catch (error) {
    console.error('Error registering referral:', error);
    return null;
  }
}

export async function getReferralTree(ambassadorAddress, maxDepth = 5) {
  if (!supabase || !ambassadorAddress) return [];
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('referee_address, level, referral_code, created_at, is_active')
      .eq('referrer_address', ambassadorAddress.toLowerCase())
      .eq('is_active', true)
      .lte('level', maxDepth)
      .order('level', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting referral tree:', error);
    return [];
  }
}

// =============================================
// COMMISSIONS
// =============================================

export async function getCommissionRates() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('commission_rates')
      .select('*')
      .order('min_stake_required', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting commission rates:', error);
    return [];
  }
}

export async function getCommissionRate(tierName, level) {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase
      .from('commission_rates')
      .select('*')
      .eq('tier_name', tierName)
      .single();
    
    if (error) return 0;
    if (level > data.max_level) return 0;
    
    const rateField = `l${level}_rate`;
    return data[rateField] || 0;
  } catch (error) {
    console.error('Error getting commission rate:', error);
    return 0;
  }
}

export async function calculateAndRecordCommissions(stakerAddress, stakeAmount, txHash = null) {
  if (!supabase) return;
  try {
    const lowerStaker = stakerAddress.toLowerCase();
    
    // Calculate first month rewards: stake × 0.6% daily × 30 days = stake × 18%
    const firstMonthRewards = stakeAmount * 0.18;
    
    // Get referral chain
    const { data: referralChain } = await supabase
      .from('referrals')
      .select('referrer_address, level')
      .eq('referee_address', lowerStaker)
      .eq('is_active', true)
      .order('level', { ascending: true })
      .limit(5);
    
    if (!referralChain || referralChain.length === 0) return;
    
    for (const ref of referralChain) {
      const ambassador = await getUser(ref.referrer_address);
      if (!ambassador) continue;
      
      const rate = await getCommissionRate(ambassador.badge_tier, ref.level);
      if (rate <= 0) continue;
      
      // Commission = first_month_rewards × rate (NOT stake × rate)
      const commissionAmount = firstMonthRewards * rate;
      
      // Check if commission already exists for this tx
      const { data: existing } = await supabase
        .from('commissions')
        .select('id')
        .eq('ambassador_address', ref.referrer_address)
        .eq('tx_hash', txHash)
        .single();
      
      if (existing) continue;
      
      await supabase.from('commissions').insert({
        ambassador_address: ref.referrer_address,
        referee_address: lowerStaker,
        commission_type: 'staking',
        level: ref.level,
        amount: commissionAmount,
        rate_applied: rate,
        is_eligible: true,
        is_claimable: false,
        claimable_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        tx_hash: txHash,
        created_at: new Date().toISOString()
      });
      
      console.log(`💰 Commission: L${ref.level} ${commissionAmount} (${firstMonthRewards} × ${rate}) to ${ref.referrer_address.slice(0, 10)}...`);
    }
    
    // Update ambassador stats for all in chain
    for (const ref of referralChain) {
      await updateAmbassadorCommissions(ref.referrer_address);
    }
  } catch (error) {
    console.error('Error calculating commissions:', error);
  }
}

export async function getCommissions(walletAddress) {
  if (!supabase || !walletAddress) return [];
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('ambassador_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting commissions:', error);
    return [];
  }
}

export async function getClaimableCommissions(walletAddress) {
  if (!supabase || !walletAddress) return [];
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('ambassador_address', walletAddress.toLowerCase())
      .eq('claimed', false)
      .lte('claimable_at', new Date().toISOString());
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting claimable commissions:', error);
    return [];
  }
}

// =============================================
// AMBASSADOR STATS
// =============================================

export async function getAmbassadorStats(walletAddress) {
  if (!supabase || !walletAddress) return null;
  try {
    const { data, error } = await supabase
      .from('ambassador_stats')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (!data) {
      await updateAmbassadorStats(walletAddress);
      const { data: newData } = await supabase
        .from('ambassador_stats')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();
      return newData;
    }
    return data;
  } catch (error) {
    console.error('Error getting ambassador stats:', error);
    return null;
  }
}

export async function updateAmbassadorStats(walletAddress) {
  if (!supabase) return;
  try {
    const lowerWallet = walletAddress.toLowerCase();
    const user = await getUser(walletAddress);
    const referralCode = user?.referral_code || generateReferralCode(walletAddress);
    
    // Count referrals
    const { data: referrals } = await supabase
      .from('referrals')
      .select('level')
      .eq('referrer_address', lowerWallet)
      .eq('is_active', true);
    
    const counts = { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0, total: 0 };
    if (referrals) {
      for (const ref of referrals) {
        counts[`l${ref.level}`]++;
        counts.total++;
      }
    }
    
    // Get commissions
    const { data: commissions } = await supabase
      .from('commissions')
      .select('amount, claimed')
      .eq('ambassador_address', lowerWallet);
    
    let totalEarned = 0, totalClaimed = 0, pending = 0;
    if (commissions) {
      for (const c of commissions) {
        totalEarned += parseFloat(c.amount || 0);
        if (c.claimed) totalClaimed += parseFloat(c.amount || 0);
        else pending += parseFloat(c.amount || 0);
      }
    }
    
    // Upsert stats
    await supabase.from('ambassador_stats').upsert({
      wallet_address: lowerWallet,
      referral_code: referralCode,
      total_referrals: counts.total,
      level_1_count: counts.l1,
      level_2_count: counts.l2,
      level_3_count: counts.l3,
      level_4_count: counts.l4,
      level_5_count: counts.l5,
      total_earned: totalEarned,
      total_claimed: totalClaimed,
      pending_commissions: pending,
      current_tier: user?.badge_tier || 'Starter',
      updated_at: new Date().toISOString()
    }, { onConflict: 'wallet_address' });
    
    // Update leaderboard
    await supabase.from('ambassador_leaderboard').upsert({
      ambassador_address: lowerWallet,
      wallet: lowerWallet,
      total_referrals: counts.total,
      l1_count: counts.l1,
      l2_count: counts.l2,
      l3_count: counts.l3,
      l4_count: counts.l4,
      l5_count: counts.l5,
      total_earned: totalEarned,
      pending_commissions: pending,
      updated_at: new Date().toISOString()
    }, { onConflict: 'ambassador_address' });
    
  } catch (error) {
    console.error('Error updating ambassador stats:', error);
  }
}

async function updateAmbassadorCommissions(walletAddress) {
  if (!supabase) return;
  try {
    const lowerWallet = walletAddress.toLowerCase();
    const { data: commissions } = await supabase
      .from('commissions')
      .select('amount, claimed')
      .eq('ambassador_address', lowerWallet);
    
    let totalEarned = 0, pending = 0;
    if (commissions) {
      for (const c of commissions) {
        totalEarned += parseFloat(c.amount || 0);
        if (!c.claimed) pending += parseFloat(c.amount || 0);
      }
    }
    
    await supabase.from('ambassador_stats').update({
      total_earned: totalEarned,
      pending_commissions: pending,
      updated_at: new Date().toISOString()
    }).eq('wallet_address', lowerWallet);
    
    await supabase.from('ambassador_leaderboard').update({
      total_earned: totalEarned,
      pending_commissions: pending,
      updated_at: new Date().toISOString()
    }).eq('ambassador_address', lowerWallet);
  } catch (error) {
    console.error('Error updating ambassador commissions:', error);
  }
}

export async function getAmbassadorLeaderboard(limit = 100) {
  if (!supabase) return [];
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

// =============================================
// LP MINING
// =============================================

export async function recordLPMiningPosition(params) {
  if (!supabase) return null;
  try {
    const { walletAddress, lpPairAddress, lpAmount, afroxValue, wethValue, lockDuration, instantBonus, miningRewards, referrerAddress, txHash } = params;
    
    const unlockAt = new Date();
    unlockAt.setDate(unlockAt.getDate() + lockDuration);
    
    // LP Mining Commission: L1 only, first month only
    // Both staker AND referrer get 5% of the AfroX value in the LP token
    const lpCommissionRate = 0.05; // 5%
    const stakerBonus = afroxValue * lpCommissionRate;
    const referrerBonus = referrerAddress ? afroxValue * lpCommissionRate : 0;
    
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
        referrer_address: referrerAddress?.toLowerCase() || null,
        referrer_bonus: referrerBonus,
        staker_bonus: stakerBonus,  // Staker also gets 5%
        status: 'locked',
        tx_hash: txHash,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    await updateLPMiningLeaderboard(walletAddress);
    
    // Record referrer commission if applicable (L1 only)
    if (referrerAddress) {
      await supabase.from('commissions').insert({
        ambassador_address: referrerAddress.toLowerCase(),
        referee_address: walletAddress.toLowerCase(),
        commission_type: 'lp_mining',
        level: 1,  // L1 only for LP mining
        amount: referrerBonus,  // 5% of AfroX value
        rate_applied: lpCommissionRate,
        is_eligible: true,
        is_claimable: true,  // LP mining commissions are immediately claimable
        claimable_at: new Date().toISOString(),
        tx_hash: txHash,
        created_at: new Date().toISOString()
      });
      await updateAmbassadorCommissions(referrerAddress);
      console.log(`💰 LP Commission: Referrer gets ${referrerBonus} (5% of ${afroxValue} AfroX)`);
    }
    
    console.log(`✅ LP position recorded: ${lpAmount} LP for ${walletAddress.slice(0, 10)}... | Staker bonus: ${stakerBonus}`);
    return data;
  } catch (error) {
    console.error('Error recording LP position:', error);
    return null;
  }
}

export async function getLPMiningPositions(walletAddress) {
  if (!supabase || !walletAddress) return [];
  try {
    const { data, error } = await supabase
      .from('lp_mining_positions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting LP positions:', error);
    return [];
  }
}

export async function updateLPMiningLeaderboard(walletAddress) {
  if (!supabase) return;
  try {
    const lowerWallet = walletAddress.toLowerCase();
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
    
    await supabase.from('lp_mining_leaderboard').upsert({
      wallet_address: lowerWallet,
      wallet: lowerWallet,
      ...stats,
      updated_at: new Date().toISOString()
    }, { onConflict: 'wallet_address' });
  } catch (error) {
    console.error('Error updating LP leaderboard:', error);
  }
}

export async function getLPMiningLeaderboard(limit = 100) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('lp_mining_leaderboard')
      .select('*')
      .order('afrox_value', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting LP leaderboard:', error);
    return [];
  }
}

// =============================================
// GOVERNANCE
// =============================================

export async function getGovernanceProposals(status = null) {
  if (!supabase) return [];
  try {
    let query = supabase.from('governance_proposals').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting proposals:', error);
    return [];
  }
}

export async function createProposal(proposalData) {
  if (!supabase) return null;
  try {
    const proposalId = proposalData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '-' + Date.now();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + (proposalData.votingDurationDays || 7));
    const proposer = await getUser(proposalData.proposer);
    
    const { data, error } = await supabase
      .from('governance_proposals')
      .insert({
        id: proposalId,
        title: proposalData.title,
        description: proposalData.description,
        category: proposalData.category || 'general',
        proposer: proposalData.proposer.toLowerCase(),
        proposer_tier: proposer?.badge_tier || 'Starter',
        voting_duration_days: proposalData.votingDurationDays || 7,
        quorum: proposalData.quorum || 100000000000,
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

export async function submitVote(proposalId, voterAddress, support, voteWeight, badgeTier = null) {
  if (!supabase) return null;
  try {
    const { data: existingVote } = await supabase
      .from('governance_votes')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('voter_address', voterAddress.toLowerCase())
      .single();
    
    if (existingVote) throw new Error('You have already voted on this proposal');
    
    await supabase.from('governance_votes').insert({
      proposal_id: proposalId,
      voter_address: voterAddress.toLowerCase(),
      vote_type: support ? 'for' : 'against',
      vote_weight: voteWeight,
      badge_tier: badgeTier,
      created_at: new Date().toISOString()
    });
    
    const { data: proposal } = await supabase
      .from('governance_proposals')
      .select('votes_for, votes_against')
      .eq('id', proposalId)
      .single();
    
    const updateField = support ? 'votes_for' : 'votes_against';
    const currentVotes = parseFloat(proposal?.[updateField] || 0);
    
    await supabase
      .from('governance_proposals')
      .update({ [updateField]: currentVotes + voteWeight })
      .eq('id', proposalId);
    
    console.log(`✅ Vote recorded: ${support ? 'FOR' : 'AGAINST'} on ${proposalId}`);
    return { success: true };
  } catch (error) {
    console.error('Error submitting vote:', error);
    throw error;
  }
}

export async function hasUserVoted(proposalId, voterAddress) {
  if (!supabase || !proposalId || !voterAddress) return false;
  try {
    const { data } = await supabase
      .from('governance_votes')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('voter_address', voterAddress.toLowerCase())
      .single();
    return !!data;
  } catch (error) {
    return false;
  }
}

// =============================================
// INITIALIZATION
// =============================================

export async function initializeUserOnConnect(walletAddress, referralCode = null) {
  if (!supabase || !walletAddress) return null;
  try {
    let user = await getUser(walletAddress);
    
    if (!user) {
      let referrerAddress = null;
      if (referralCode) {
        const referrer = await findReferrerByCode(referralCode);
        if (referrer && referrer.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
          referrerAddress = referrer.wallet_address;
        }
      }
      
      user = await upsertUser(walletAddress, referrerAddress, 0);
      
      if (referrerAddress) {
        await registerReferral(referrerAddress, walletAddress, referralCode);
      }
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('afrox_wallet', walletAddress.toLowerCase());
    }
    
    return user;
  } catch (error) {
    console.error('Error initializing user:', error);
    return null;
  }
}

// =============================================
// DEFAULT EXPORT
// =============================================

export default {
  supabase,
  BADGE_TIERS,
  getBadgeTierFromStake,
  generateReferralCode,
  createReferralLink,
  upsertUser,
  getUser,
  updateUserStake,
  recordStakingEvent,
  getStakingHistory,
  findReferrerByCode,
  registerReferral,
  getReferralTree,
  getCommissionRates,
  getCommissionRate,
  calculateAndRecordCommissions,
  getCommissions,
  getClaimableCommissions,
  getAmbassadorStats,
  updateAmbassadorStats,
  getAmbassadorLeaderboard,
  recordLPMiningPosition,
  getLPMiningPositions,
  updateLPMiningLeaderboard,
  getLPMiningLeaderboard,
  getGovernanceProposals,
  createProposal,
  submitVote,
  hasUserVoted,
  initializeUserOnConnect
};
