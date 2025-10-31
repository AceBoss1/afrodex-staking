import React, { useState, useMemo, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatUnits, parseUnits } from 'viem';

// --- INTEGRATED CONFIGURATION & ABIS ---

// Constants for AFRODEX Staking Contracts
const TOKEN_DECIMALS = 18;
// Max approval as string (2^256 - 1)
const MAX_UINT_256_STRING = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

/**
 * IMPORTANT: Replace these with your actual contract addresses.
 * Note: Removed the 'as `0x${string}`' type assertion to fix the ESLint parsing error in .jsx.
 */
const AFRODEX_TOKEN_ADDRESS = '0x08130635368AA28b217a4dfb68E1bF8dC525621C';
const STAKING_CONTRACT_ADDRESS = '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c';

// Minimal ERC-20 ABI
const AFRODEX_TOKEN_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'owner' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

// Minimal Staking Contract ABI
const STAKING_ABI = [
  // getStakeInfo(address user) returns (uint256 stakeBalance, uint256 rewardValue)
  {
    type: 'function',
    name: 'getStakeInfo',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [
      { type: 'uint256', name: 'stakeBalance' },
      { type: 'uint256', name: 'rewardValue' },
    ],
  },
  // stake(uint256 amount)
  {
    type: 'function',
    name: 'stake',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'amount' }],
    outputs: [],
  },
  // unstake(uint256 amount)
  {
    type: 'function',
    name: 'unstake',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'amount' }],
    outputs: [],
  },
] as const;


// --- INTEGRATED TYPES AND HOOKS (from useStaking.ts) ---

interface StakeInfo {
  stakeBalance: bigint;
  rewardValue: bigint;
}

const useAfrodexTokenBalance = (address?: `0x${string}`) => {
  return useReadContract({
    address: AFRODEX_TOKEN_ADDRESS,
    abi: AFRODEX_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address || '0x'],
    query: {
      enabled: !!address,
      select: (data) => data as bigint,
    },
  });
};

const useTokenAllowance = (owner?: `0x${string}`) => {
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

const useApproveStaking = () => {
  const { writeContractAsync: writeContract, data: hash, isPending: isApproving } = useWriteContract();
  const { isLoading: isWaiting, isSuccess: isApproved, isError: isApprovalError } = useWaitForTransactionReceipt({ hash });
  return {
    writeContract: writeContract,
    isPending: isApproving || isWaiting,
    isSuccess: isApproved,
    isError: isApprovalError,
    hash,
  };
};

const useStake = () => {
  const { writeContractAsync: writeContract, data: hash, isPending: isStaking } = useWriteContract();
  const { isLoading: isWaiting, isSuccess: isStaked, isError: isStakeError } = useWaitForTransactionReceipt({ hash });
  return {
    writeContract: writeContract,
    isPending: isStaking || isWaiting,
    isSuccess: isStaked,
    isError: isStakeError,
    hash,
  };
};

const useStakeInfo = (address?: `0x${string}`) => {
  return useReadContract({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'getStakeInfo',
    args: [address || '0x'],
    query: {
      enabled: !!address,
      select: (data) => {
        const [stakeBalance, rewardValue] = data as [bigint, bigint];
        return { stakeBalance, rewardValue } as StakeInfo;
      },
    },
  });
};

const useUnstake = () => {
  const { writeContractAsync: writeContract, data: hash, isPending: isUnstaking } = useWriteContract();
  const { isLoading: isWaiting, isSuccess: isUnstaked, isError: isUnstakeError } = useWaitForTransactionReceipt({ hash });
  return {
    writeContract: writeContract,
    isPending: isUnstaking || isWaiting,
    isSuccess: isUnstaked,
    isError: isUnstakeError,
    hash,
  };
};


// --- MAIN COMPONENT (AfroDexStakingComponent.tsx) ---

/**
 * Renders the prompt to connect the wallet when the user is disconnected.
 */
const ConnectWalletPrompt: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
    <h1 className="text-3xl font-bold text-amber-500 mb-4">Welcome to the AfroDex Staking Dashboard!</h1>
    <p className="text-amber-200 text-lg mb-8">
      Stake AFRODEX tokens and earn rewards. Connect your wallet to begin.
    </p>
    <div className="mb-12">
      <ConnectButton />
    </div>
  </div>
);

/**
 * The main application component, now fully self-contained.
 */
export const App: React.FC = () => {
  const { address: userAddress, isConnected } = useAccount();

  // State for user input
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // --- Wagmi Hooks ---
  const { data: tokenBalance, refetch: refetchTokenBalance } = useAfrodexTokenBalance(userAddress);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(userAddress);
  const { data: stakeInfo, refetch: refetchStakeInfo } = useStakeInfo(userAddress) as { data: StakeInfo | undefined, refetch: () => void };

  // Transaction writing hooks
  const { writeContract: writeApprove, isPending: isApproving, isSuccess: isApproved } = useApproveStaking();
  const { writeContract: writeStake, isPending: isStaking, isSuccess: isStaked } = useStake();
  const { writeContract: writeUnstake, isPending: isUnstaking, isSuccess: isUnstaked } = useUnstake();

  // Memoized/Derived State
  const stakeBalanceFormatted = useMemo(() => formatUnits(stakeInfo?.stakeBalance || BigInt(0), TOKEN_DECIMALS), [stakeInfo]);
  const rewardValueFormatted = useMemo(() => formatUnits(stakeInfo?.rewardValue || BigInt(0), TOKEN_DECIMALS), [stakeInfo]);
  const tokenBalanceFormatted = useMemo(() => formatUnits(tokenBalance || BigInt(0), TOKEN_DECIMALS), [tokenBalance]);

  const needsApproval = useMemo(() => {
    // Check if allowance is less than 10M tokens (practical re-approval threshold)
    const allowanceThreshold = parseUnits('10000000', TOKEN_DECIMALS);
    return (allowance || BigInt(0)) < allowanceThreshold;
  }, [allowance]);

  // --- Effect: Refetch Data after successful transactions ---
  useEffect(() => {
    if (isApproved || isStaked || isUnstaked) {
      refetchTokenBalance();
      refetchAllowance();
      refetchStakeInfo();
      
      if (isStaked) setStakeAmount('');
      if (isUnstaked) setUnstakeAmount('');
    }
  }, [isApproved, isStaked, isUnstaked, refetchTokenBalance, refetchAllowance, refetchStakeInfo]);

  // --- Handlers ---

  const handleApprove = async () => {
    if (!writeApprove) return;
    try {
      const maxApproval = BigInt(MAX_UINT_256_STRING);
      
      await writeApprove({
        address: AFRODEX_TOKEN_ADDRESS,
        functionName: 'approve',
        args: [ STAKING_CONTRACT_ADDRESS, maxApproval ],
      });
    } catch (e) {
      console.error('Approval error:', e);
    }
  };

  const handleStake = async () => {
    if (!writeStake || !stakeAmount || parseFloat(stakeAmount) <= 0) return;
    try {
      const amount = parseUnits(stakeAmount, TOKEN_DECIMALS);
      await writeStake({ 
        address: STAKING_CONTRACT_ADDRESS,
        functionName: 'stake',
        args: [amount],
      });
    } catch (e) {
      console.error('Stake error:', e);
    }
  };

  const handleUnstake = async () => {
    if (!writeUnstake || !unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    try {
      const amount = parseUnits(unstakeAmount, TOKEN_DECIMALS);
      await writeUnstake({ 
        address: STAKING_CONTRACT_ADDRESS,
        functionName: 'unstake',
        args: [amount],
      });
    } catch (e) {
      console.error('Unstake error:', e);
    }
  };

  // Custom function to handle the "Claim Rewards Only" button feedback
  const handleClaimRewards = () => {
    console.log('Rewards are typically claimed during Unstake in this contract implementation.');
    // Using a console message instead of alert for better practice
  };

  const isTransactionPending = isApproving || isStaking || isUnstaking;
  
  // --- Render ---

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col items-center pt-16 font-inter">
      <header className="w-full max-w-4xl flex justify-between items-center px-4 mb-10">
        <h1 className="text-3xl font-extrabold text-amber-500">AfroDex Staking</h1>
        <ConnectButton />
      </header>

      <main className="w-full max-w-4xl p-4 flex-grow flex flex-col items-center">
        {!isConnected ? (
          <ConnectWalletPrompt />
        ) : (
          <div className="w-full space-y-8" style={{ pointerEvents: isTransactionPending ? 'none' : 'auto' }}>
            <h2 className="text-xl font-semibold mb-4 text-center text-amber-200 break-words">Connected Address: {userAddress}</h2>

            {isTransactionPending && (
              <div className="text-center text-amber-500 font-bold p-4 bg-gray-800 rounded-xl animate-pulse">
                Transaction is Pending... Please confirm in your wallet.
              </div>
            )}

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Wallet Balance */}
              <div className="staking-card p-4 bg-gray-900 rounded-xl border border-gray-700 shadow-lg transition hover:border-amber-500">
                <p className="text-sm text-amber-300">Your AFRODEX Balance</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{tokenBalanceFormatted} AFRODEX</p>
              </div>

              {/* Card 2: Staked Balance */}
              <div className="staking-card p-4 bg-gray-900 rounded-xl border border-gray-700 shadow-lg transition hover:border-amber-500">
                <p className="text-sm text-amber-300">Total Staked</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{stakeBalanceFormatted} AFRODEX</p>
              </div>

              {/* Card 3: Earned Rewards */}
              <div className="staking-card p-4 bg-gray-900 rounded-xl border border-gray-700 shadow-lg transition hover:border-amber-500">
                <p className="text-sm text-amber-300">Pending Rewards</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{rewardValueFormatted} AFRODEX</p>
              </div>
              
              {/* Staking Contract Address Display */}
              <div className="md:col-span-3 text-center p-4 bg-gray-900 rounded-xl border border-gray-700">
                <p className="text-amber-400 font-semibold mb-1">Staking Contract Address</p>
                <p className="text-sm text-gray-300 break-all">{STAKING_CONTRACT_ADDRESS}</p>
              </div>
            </div>

            {/* Staking & Unstaking Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Stake Card */}
              <div className="staking-card p-6 bg-gray-900 rounded-xl border border-gray-700 shadow-xl">
                <h3 className="text-2xl font-bold text-amber-500 mb-4">Stake Tokens</h3>
                <input
                  type="number"
                  placeholder="Amount to Stake (e.g., 1000)"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  disabled={isTransactionPending}
                  className="w-full p-3 mb-4 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:ring-amber-500 focus:border-amber-500 transition"
                />
                <p className="text-sm text-gray-400 mb-4">Available: {tokenBalanceFormatted} AFRODEX</p>


                {needsApproval ? (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || isTransactionPending}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-black font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 shadow-md hover:shadow-lg"
                  >
                    {isApproving ? 'Approving...' : 'Approve Staking'}
                  </button>
                ) : (
                  <button
                    onClick={handleStake}
                    disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0 || isTransactionPending}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 shadow-md hover:shadow-lg"
                  >
                    {isStaking ? 'Staking...' : 'Stake AFRODEX'}
                  </button>
                )}
              </div>

              {/* Unstake Card */}
              <div className="staking-card p-6 bg-gray-900 rounded-xl border border-gray-700 shadow-xl">
                <h3 className="text-2xl font-bold text-amber-500 mb-4">Unstake & Claim</h3>
                <input
                  type="number"
                  placeholder="Amount to Unstake (e.g., 500)"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  disabled={isTransactionPending}
                  className="w-full p-3 mb-4 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:ring-amber-500 focus:border-amber-500 transition"
                />
                <p className="text-sm text-gray-400 mb-4">Staked: {stakeBalanceFormatted} AFRODEX</p>

                <button
                  onClick={handleUnstake}
                  disabled={isUnstaking || !unstakeAmount || parseFloat(unstakeAmount) <= 0 || isTransactionPending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 shadow-md hover:shadow-lg mb-3"
                >
                  {isUnstaking ? 'Unstaking...' : 'Unstake AFRODEX'}
                </button>
                <button
                  onClick={handleClaimRewards}
                  disabled={isTransactionPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 shadow-md hover:shadow-lg"
                >
                  Claim Rewards Only
                </button>
              </div>
            </div>
            
            {/* Disclaimer for Claim Rewards */}
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-700">
                <p className="text-sm text-amber-400 font-semibold mb-1">Claim Rewards Note:</p>
                <p className="text-sm text-gray-400">Your pending rewards ({rewardValueFormatted} AFRODEX) are typically claimed automatically when you *Unstake* any amount. The 'Claim Rewards Only' button is a placeholder, as the minimal contract ABI provided does not include a separate `claimRewards` function.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full py-4 text-center text-gray-600 border-t border-gray-800 mt-auto">
        &copy;2019- {new Date().getFullYear()} AfroDex. All rights reserved.
      </footer>
    </div>
  );
};

export default App; // Exporting as App for general React setup
