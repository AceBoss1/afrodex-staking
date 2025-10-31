// src/hooks/useStaking.ts

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAKING_ABI, STAKING_CONTRACT_ADDRESS, AFRODEX_TOKEN_ADDRESS } from '../config/abis';
import { parseUnits, formatUnits, MaxUint256 } from 'viem';

// Helper type for the stake info view function output
interface StakeInfo {
  stakeBalance: bigint;
  rewardValue: bigint;
  lastUnstakeTimestamp: bigint;
  lastRewardTimestamp: bigint;
}

// --- READ HOOKS ---

/**
 * Reads the user's AFRODEX token balance.
 */
export function useAfrodexBalance() {
  const { address } = useAccount();

  return useReadContract({
    abi: STAKING_ABI,
    address: AFRODEX_TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: !!address, // Only run query if wallet is connected
      select: (data) => formatUnits(data as bigint, 18), // Convert BigInt to readable string (assuming 18 decimals)
    }
  });
}

/**
 * Reads the user's staking information (balance and rewards).
 */
export function useStakingInfo() {
  const { address } = useAccount();

  return useReadContract({
    abi: STAKING_ABI,
    address: STAKING_CONTRACT_ADDRESS,
    functionName: 'viewStakeInfoOf',
    args: [address!],
    query: {
      enabled: !!address,
      select: (data) => {
        // Cast data to the defined interface for clarity
        const [stakeBalance, rewardValue] = data as [bigint, bigint, bigint, bigint];
        return {
          stakedAmount: formatUnits(stakeBalance, 18),
          pendingRewards: formatUnits(rewardValue, 18),
        };
      },
      refetchInterval: 10000, // Refetch every 10 seconds to update rewards
    }
  });
}

/**
 * Reads the allowance given to the Staking contract by the user.
 */
export function useAfrodexAllowance() {
  const { address: owner } = useAccount();
  const spender = STAKING_CONTRACT_ADDRESS;

  return useReadContract({
    abi: STAKING_ABI,
    address: AFRODEX_TOKEN_ADDRESS,
    functionName: 'allowance',
    args: [owner!, spender],
    query: {
      enabled: !!owner,
      select: (data) => data as bigint, // Return as BigInt for comparison
    }
  });
}

// --- WRITE HOOKS (TRANSACTIONS) ---

/**
 * Hook for approving the staking contract to spend AFRODEX tokens.
 */
export function useApproveStaking() {
  return useWriteContract({
    abi: STAKING_ABI,
    address: AFRODEX_TOKEN_ADDRESS,
    functionName: 'approve',
  });
}

/**
 * Hook for performing the stake transaction.
 */
export function useStake() {
  return useWriteContract({
    abi: STAKING_ABI,
    address: STAKING_CONTRACT_ADDRESS,
    functionName: 'stake',
  });
}

/**
 * Hook for performing the unstake/claim transaction.
 * NOTE: Based on the ABI, 'unstake(uint256 amount)' appears to be for unstaking tokens AND claiming rewards.
 */
export function useUnstake() {
  return useWriteContract({
    abi: STAKING_ABI,
    address: STAKING_CONTRACT_ADDRESS,
    functionName: 'unstake',
  });
}

// Helper to wait for transaction confirmation
export { useWaitForTransactionReceipt, parseUnits, MaxUint256 };
