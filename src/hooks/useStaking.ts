// src/hooks/useStaking.ts

import { useState, useMemo, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STAKING_ABI, STAKING_CONTRACT_ADDRESS, AFRODEX_TOKEN_ADDRESS } from '../config/abis';
import { parseUnits, formatUnits, maxUint256 } from 'viem'; // CORRECTED: Changed MaxUint256 to maxUint256

// Helper type for the stake info view function output
interface StakeInfo {
  stakeBalance: bigint;
  rewardValue: bigint;
  lastUnstakeTimestamp: bigint;
  lastRewardTimestamp: bigint;
}

// --- Read Hooks ---

const tokenDecimals = 18; // Assuming 18 decimals for the AFRODEX token

// Hook to read the user's AFRODEX token balance and allowance
export const useTokenData = () => {
  const { address: userAddress, isConnected } = useAccount();

  // 1. User Token Balance
  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    abi: STAKING_ABI,
    address: AFRODEX_TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: {
      enabled: isConnected && !!userAddress,
    },
  });

  // 2. User Allowance for the Staking Contract
  const { data: rawAllowance, refetch: refetchAllowance } = useReadContract({
    abi: STAKING_ABI,
    address: AFRODEX_TOKEN_ADDRESS,
    functionName: 'allowance',
    args: [userAddress!, STAKING_CONTRACT_ADDRESS],
    query: {
      enabled: isConnected && !!userAddress,
    },
  });

  const formattedBalance = useMemo(() => {
    if (rawBalance) {
      return formatUnits(rawBalance as bigint, tokenDecimals);
    }
    return '0';
  }, [rawBalance]);

  // The allowance value (bigint)
  const allowanceValue = rawAllowance as bigint | undefined;

  return {
    userBalance: formattedBalance,
    allowanceValue,
    refetch: () => {
      refetchBalance();
      refetchAllowance();
    },
  };
};

// Hook to read the user's staking information
export const useStakingInfo = () => {
  const { address: userAddress, isConnected } = useAccount();

  const { data: rawInfo, refetch: refetchInfo } = useReadContract({
    abi: STAKING_ABI,
    address: STAKING_CONTRACT_ADDRESS,
    functionName: 'viewStakeInfoOf',
    args: [userAddress!],
    query: {
      enabled: isConnected && !!userAddress,
      // Refetch every 10 seconds for real-time updates (rewards)
      refetchInterval: 10000, 
    },
  });

  const info = rawInfo as StakeInfo | undefined;

  const formattedStakeBalance = useMemo(() => {
    if (info?.stakeBalance) {
      return formatUnits(info.stakeBalance, tokenDecimals);
    }
    return '0';
  }, [info]);

  const formattedRewardValue = useMemo(() => {
    if (info?.rewardValue) {
      return formatUnits(info.rewardValue, tokenDecimals);
    }
    return '0';
  }, [info]);

  return {
    stakeBalance: formattedStakeBalance,
    rewardValue: formattedRewardValue,
    refetch: refetchInfo,
  };
};

// --- Write Hooks (Transactions) ---

// 1. Approve Staking Contract to spend tokens
export const useApproveStaking = () => {
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const approve = () => {
    writeContract({
      abi: STAKING_ABI,
      address: AFRODEX_TOKEN_ADDRESS,
      functionName: 'approve',
      args: [STAKING_CONTRACT_ADDRESS, maxUint256], // CORRECTED usage: maxUint256
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    isError,
    error,
  };
};

// 2. Stake Tokens
export const useStake = () => {
  const [amount, setAmount] = useState<string>('');
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const stake = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    try {
      const amountParsed = parseUnits(amount, tokenDecimals);
      writeContract({
        abi: STAKING_ABI,
        address: STAKING_CONTRACT_ADDRESS,
        functionName: 'stake',
        args: [amountParsed],
      });
    } catch (e) {
      console.error('Error parsing stake amount:', e);
    }
  };

  return {
    amount,
    setAmount,
    stake,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    isError,
    error,
  };
};

// 3. Unstake (Withdraw) Tokens
export const useUnstake = () => {
  const [amount, setAmount] = useState<string>('');
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const unstake = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    try {
      const amountParsed = parseUnits(amount, tokenDecimals);
      writeContract({
        abi: STAKING_ABI,
        address: STAKING_CONTRACT_ADDRESS,
        functionName: 'unstake',
        args: [amountParsed],
      });
    } catch (e) {
      console.error('Error parsing unstake amount:', e);
    }
  };

  return {
    amount,
    setAmount,
    unstake,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    isError,
    error,
  };
};
