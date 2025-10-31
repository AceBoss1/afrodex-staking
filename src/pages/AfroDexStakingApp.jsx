import React, { useState, useMemo, useEffect } from 'react';
// These dependencies are assumed to be available in the environment
import { useAccount, useContractRead, useContractWrite } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatUnits, parseUnits } from 'viem';
import { Address } from 'viem';

// --- CONFIGURATION & ABIS (Formerly in: ../config/abis) ---

const AFRODEX_TOKEN_ADDRESS: Address = '0x08130635368AA28b217a4dfb68E1bF8dC525621C' as Address;
const STAKING_CONTRACT_ADDRESS: Address = '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c' as Address;

const AFRODEX_TOKEN_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
] as const;

const STAKING_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getUserStakeInfo",
    "outputs": [
      {"internalType": "uint256", "name": "stakeBalance", "type": "uint256"},
      {"internalType": "uint256", "name": "rewardValue", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "stake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "unstake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
] as const;

// --- HOOKS (Formerly in: ../hooks/useStaking) ---

/**
 * Type definition for the staking data returned by the contract.
 */
interface StakeInfo {
    stakeBalance: bigint;
    rewardValue: bigint;
}

/**
 * Fetches the AFRODEX token balance for a user.
 */
const useAfrodexTokenBalance = (address?: Address) => {
  return useContractRead({
    address: AFRODEX_TOKEN_ADDRESS,
    abi: AFRODEX_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address as Address],
    enabled: !!address,
    watch: true,
  });
};

/**
 * Fetches the staking contract's allowance for a user's tokens.
 */
const useTokenAllowance = (address?: Address) => {
  return useContractRead({
    address: AFRODEX_TOKEN_ADDRESS,
    abi: AFRODEX_TOKEN_ABI,
    functionName: 'allowance',
    args: [address as Address, STAKING_CONTRACT_ADDRESS],
    enabled: !!address,
    watch: true,
  });
};

/**
 * Fetches the user's stake balance and pending rewards.
 */
const useStakeInfo = (address?: Address) => {
  const { data, ...rest } = useContractRead({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'getUserStakeInfo',
    args: [address as Address],
    enabled: !!address,
    watch: true,
  });

  return {
    data: data ? { stakeBalance: data[0], rewardValue: data[1] } as StakeInfo : undefined,
    ...rest,
  };
};

/**
 * Hook to approve the staking contract to spend AFRODEX tokens.
 */
const useApproveStaking = () => {
  return useContractWrite({
    abi: AFRODEX_TOKEN_ABI,
    functionName: 'approve',
    address: AFRODEX_TOKEN_ADDRESS,
  });
};

/**
 * Hook to stake AFRODEX tokens.
 */
const useStake = () => {
  return useContractWrite({
    abi: STAKING_ABI,
    functionName: 'stake',
    address: STAKING_CONTRACT_ADDRESS,
  });
};

/**
 * Hook to unstake AFRODEX tokens.
 */
const useUnstake = () => {
  return useContractWrite({
    abi: STAKING_ABI,
    functionName: 'unstake',
    address: STAKING_CONTRACT_ADDRESS,
  });
};

// --- COMPONENT LOGIC (Formerly in: src/pages/AfroDexStakingApp.jsx) ---

// Constants
const TOKEN_DECIMALS = 18;
const MAX_UINT_256_STRING = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

// --- UI Sub-Components ---

/**
 * Renders the prompt to connect the wallet when the user is disconnected.
 */
const ConnectWalletPrompt = () => (
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
 * The main application component.
 * NOTE: Exported as 'default' to match Next.js page conventions.
 */
export default function AfroDexStakingApp() {
  const { address: userAddress, isConnected } = useAccount();

  // State for user input
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // --- Wagmi Hooks (Called Unconditionally) ---
  const { data: tokenBalance, refetch: refetchTokenBalance } = useAfrodexTokenBalance(userAddress);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(userAddress);
  const { data: stakeInfo, refetch: refetchStakeInfo } = useStakeInfo(userAddress);

  const { writeContract: writeApprove, isPending: isApproving, isSuccess: isApproved } = useApproveStaking();
  const { writeContract: writeStake, isPending: isStaking, isSuccess: isStaked } = useStake();
  const { writeContract: writeUnstake, isPending: isUnstaking, isSuccess: isUnstaked } = useUnstake();

  // Memoized/Derived State
  // Using BigInt(0) for compatibility
  const stakeBalanceFormatted = useMemo(() => formatUnits(stakeInfo?.stakeBalance || BigInt(0), TOKEN_DECIMALS), [stakeInfo]);
  const rewardValueFormatted = useMemo(() => formatUnits(stakeInfo?.rewardValue || BigInt(0), TOKEN_DECIMALS), [stakeInfo]);
  const tokenBalanceFormatted = useMemo(() => formatUnits(tokenBalance || BigInt(0), TOKEN_DECIMALS), [tokenBalance]);

  // Check if staking is allowed
  const needsApproval = useMemo(() => {
    const allowanceThreshold = parseUnits('10000000', TOKEN_DECIMALS); // 10M tokens
    return (allowance || BigInt(0)) < allowanceThreshold;
  }, [allowance]);

  // --- Effect: Refetch Data after successful transactions ---
  useEffect(() => {
    if (isApproved || isStaked || isUnstaked) {
      console.log('Transaction successful, refetching data...');
      // Refetch all relevant data to update the dashboard view
      refetchTokenBalance();
      refetchAllowance();
      refetchStakeInfo();
      
      // Clear inputs for better UX
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
        abi: AFRODEX_TOKEN_ABI,
        functionName: 'approve',
        args: [
          STAKING_CONTRACT_ADDRESS,
          maxApproval,
        ],
      });
    } catch (e) {
      console.error('Approval error:', e);
    }
  };

  const handleStake = async () => {
    if (!writeStake || !stakeAmount) return;
    try {
      const amount = parseUnits(stakeAmount, TOKEN_DECIMALS);
      await writeStake({ 
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [amount],
      });
    } catch (e) {
      console.error('Stake error:', e);
    }
  };

  const handleUnstake = async () => {
    if (!writeUnstake || !unstakeAmount) return;
    try {
      const amount = parseUnits(unstakeAmount, TOKEN_DECIMALS);
      await writeUnstake({ 
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [amount],
      });
    } catch (e) {
      console.error('Unstake error:', e);
    }
  };

  const handleClaimRewards = () => {
    const message = 'The "Unstake" function on the contract typically claims rewards along with the stake. If a separate claim function is available later, it will be implemented here.';
    // NOTE: Using alert() as a temporary message box. A custom modal is recommended.
    alert(message);
    console.log('Attempted to claim rewards.');
  };

  // Determine overall loading state for disabling UI
  const isTransactionPending = isApproving || isStaking || isUnstaking;
  
  // --- Render ---

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col items-center pt-16">
      <header className="w-full max-w-4xl flex justify-between items-center px-4 mb-10">
        <h1 className="text-3xl font-extrabold text-amber-500">AfroDex Staking</h1>
        <ConnectButton />
      </header>

      <main className="w-full max-w-4xl p-4 flex-grow flex flex-col items-center">
        {!isConnected ? (
          <ConnectWalletPrompt />
        ) : (
          <div className="w-full space-y-8" style={{ pointerEvents: isTransactionPending ? 'none' : 'auto' }}>
            <h2 className="text-xl font-semibold mb-4 text-center text-amber-200">Connected Address: {userAddress}</h2>

            {isTransactionPending && (
              <div className="text-center text-amber-500 font-bold p-4 bg-gray-800 rounded-lg">
                Transaction is Pending... Please confirm in your wallet.
              </div>
            )}

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="staking-card">
                <p className="text-amber-300">Your AFRODEX Balance</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{tokenBalanceFormatted} AFRODEX</p>
              </div>
              <div className="staking-card">
                <p className="text-amber-300">Total Staked</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{stakeBalanceFormatted} AFRODEX</p>
              </div>
              <div className="staking-card">
                <p className="text-amber-300">Pending Rewards</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{rewardValueFormatted} AFRODEX</p>
              </div>
              <div className="md:col-span-3 text-center p-4 bg-gray-900 rounded-xl border border-gray-700">
                <p className="text-amber-400 font-semibold mb-1">Staking Contract</p>
                <p className="text-sm text-gray-300 break-all">{STAKING_CONTRACT_ADDRESS}</p>
              </div>
            </div>

            {/* Staking & Unstaking Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Stake Card */}
              <div className="staking-card p-6">
                <h3 className="text-2xl font-bold text-amber-500 mb-4">Stake Tokens</h3>
                <input
                  type="number"
                  placeholder="Amount to Stake"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  disabled={isTransactionPending}
                  className="w-full p-3 mb-4 rounded-lg bg-gray-900 border border-gray-700 text-white focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-sm text-gray-400 mb-4">Available: {tokenBalanceFormatted} AFRODEX</p>

                {needsApproval ? (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || isTransactionPending}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-black font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50"
                  >
                    {isApproving ? 'Approving...' : 'Approve Staking'}
                  </button>
                ) : (
                  <button
                    onClick={handleStake}
                    disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0 || isTransactionPending}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50"
                  >
                    {isStaking ? 'Staking...' : 'Stake AFRODEX'}
                  </button>
                )}
              </div>

              {/* Unstake Card */}
              <div className="staking-card p-6">
                <h3 className="text-2xl font-bold text-amber-500 mb-4">Unstake & Claim</h3>
                <input
                  type="number"
                  placeholder="Amount to Unstake"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  disabled={isTransactionPending}
                  className="w-full p-3 mb-4 rounded-lg bg-gray-900 border border-gray-700 text-white focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-sm text-gray-400 mb-4">Staked: {stakeBalanceFormatted} AFRODEX</p>

                <button
                  onClick={handleUnstake}
                  disabled={isUnstaking || !unstakeAmount || parseFloat(unstakeAmount) <= 0 || isTransactionPending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 mb-3"
                >
                  {isUnstaking ? 'Unstaking...' : 'Unstake AFRODEX'}
                </button>
                <button
                  onClick={handleClaimRewards}
                  disabled={isTransactionPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50"
                >
                  Claim Rewards Only
                </button>
              </div>
            </div>
            
            {/* Disclaimer for Claim Rewards */}
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-700">
                <p className="text-sm text-amber-400 font-semibold mb-1">Claim Rewards Note:</p>
                <p className="text-sm text-gray-400">Your pending rewards ({rewardValueFormatted} AFRODEX) are typically claimed automatically when you *Unstake* any amount. If you wish to claim without unstaking, you may be able to unstake a very small amount (e.g., 1 AFRODEX) to trigger the reward distribution.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full py-4 text-center text-gray-600 border-t border-gray-800 mt-auto">
        &copy;2019- {new Date().getFullYear()} AfroDex. All rights reserved.
      </footer>
    </div>
  );
}
