import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import {
  STAKING_ABI,
  STAKING_CONTRACT_ADDRESS,
  AFRODEX_TOKEN_ADDRESS,
  AFRODEX_TOKEN_ABI,
} from '../config/abis';
import { parseUnits, formatUnits, maxUint256 } from 'viem';

// Helper type for the stake info view function output
interface StakeInfo {
  stakeBalance: bigint;
  rewardValue: bigint;
}

/**
 * Custom hook to read the user's AFRODEX Token balance.
 * @param address The address of the user.
 */
export const useAfrodexTokenBalance = (address?: `0x${string}`) => {
  return useReadContract({
    address: AFRODEX_TOKEN_ADDRESS,
    abi: AFRODEX_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address || '0x'],
    query: {
      enabled: !!address, // Only run if an address is available
      select: (data) => data as bigint, // Ensure data is treated as bigint
    },
  });
};

/**
 * Custom hook to read the amount of AFRODEX the staking contract is allowed to spend.
 * @param owner The address of the token owner (user).
 */
export const useTokenAllowance = (owner?: `0x${string}`) => {
  return useReadContract({
    address: AFRODEX_TOKEN_ADDRESS,
    abi: AFRODEX_TOKEN_ABI,
    functionName: 'allowance',
    args: [owner || '0x', STAKING_CONTRACT_ADDRESS],
    query: {
      enabled: !!owner,
      select: (data) => data as bigint,
    },
  });
};

/**
 * Custom hook to approve the staking contract to spend the user's AFRODEX tokens.
 */
export const useApproveStaking = () => {
  const { writeContract, data: hash, isPending: isApproving } = useWriteContract();

  const { isLoading: isWaiting, isSuccess: isApproved, isError: isApprovalError } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    writeContract: writeContract,
    isPending: isApproving || isWaiting,
    isSuccess: isApproved,
    isError: isApprovalError,
    hash,
  };
};

/**
 * Custom hook to stake AFRODEX tokens into the contract.
 */
export const useStake = () => {
  const { writeContract, data: hash, isPending: isStaking } = useWriteContract();

  const { isLoading: isWaiting, isSuccess: isStaked, isError: isStakeError } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    writeContract: writeContract,
    isPending: isStaking || isWaiting,
    isSuccess: isStaked,
    isError: isStakeError,
    hash,
  };
};

/**
 * Custom hook to read the user's staking balance and accumulated rewards.
 * @param address The address of the user.
 */
export const useStakeInfo = (address?: `0x${string}`) => {
  return useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'getStakeInfo',
    args: [address || '0x'],
    query: {
      enabled: !!address,
      select: (data) => {
        // Assume getStakeInfo returns a tuple/array like [stakeBalance, rewardValue]
        const [stakeBalance, rewardValue] = data as [bigint, bigint];
        return { stakeBalance, rewardValue } as StakeInfo;
      },
    },
  });
};

/**
 * Custom hook to unstake tokens and claim rewards.
 */
export const useUnstake = () => {
  const { writeContract, data: hash, isPending: isUnstaking } = useWriteContract();

  const { isLoading: isWaiting, isSuccess: isUnstaked, isError: isUnstakeError } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    writeContract: writeContract,
    isPending: isUnstaking || isWaiting,
    isSuccess: isUnstaked,
    isError: isUnstakeError,
    hash,
  };
};
