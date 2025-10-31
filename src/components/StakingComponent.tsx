import React, { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatUnits, parseUnits } from 'viem';
import {
  useAfrodexTokenBalance,
  useStakeInfo,
  useTokenAllowance,
  useApproveStaking,
  useStake,
  useUnstake,
} from '../hooks/useStaking';

// Constants
const TOKEN_DECIMALS = 18;
const MAX_UINT_256_STRING = (2n ** 256n - 1n).toString(); // Standard maximum approval value

// --- UI Components ---

/**
 * Renders the prompt to connect the wallet when the user is disconnected.
 */
const ConnectWalletPrompt: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
    <h1 className="text-3xl font-bold text-amber-500 mb-4">Welcome to the AfroDex Staking Dashboard!</h1>
    <p className="text-gray-300 text-lg mb-8">
      Stake AFRODEX tokens and earn rewards. Connect your wallet to begin.
    </p>
    <div className="mb-12">
      <ConnectButton />
    </div>
  </div>
);

// --- Main Component ---

export const AfroDexStakingComponent: React.FC = () => {
  const { address: userAddress, isConnected } = useAccount();

  // State for user input
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // --- Wagmi Hooks (Called Unconditionally) ---
  const { data: tokenBalance, refetch: refetchTokenBalance } = useAfrodexTokenBalance(userAddress);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(userAddress);
  const { data: stakeInfo, refetch: refetchStakeInfo } = useStakeInfo(userAddress);

  const { writeContract: writeApprove, isPending: isApproving } = useApproveStaking();
  const { writeContract: writeStake, isPending: isStaking } = useStake();
  const { writeContract: writeUnstake, isPending: isUnstaking } = useUnstake();

  // Memoized/Derived State
  const stakeBalanceFormatted = useMemo(() => formatUnits(stakeInfo?.stakeBalance || 0n, TOKEN_DECIMALS), [stakeInfo]);
  const rewardValueFormatted = useMemo(() => formatUnits(stakeInfo?.rewardValue || 0n, TOKEN_DECIMALS), [stakeInfo]);
  const tokenBalanceFormatted = useMemo(() => formatUnits(tokenBalance || 0n, TOKEN_DECIMALS), [tokenBalance]);

  // Check if staking is allowed (based on allowance being less than a large number)
  const needsApproval = useMemo(() => {
    return (allowance || 0n) < (parseUnits('10000000', TOKEN_DECIMALS)); // Needs approval if less than 10M tokens
  }, [allowance]);

  // --- Handlers ---

  const handleApprove = () => {
    if (!writeApprove) return;
    try {
      // Approve the maximum possible amount
      writeApprove({
        args: [
          '0x30715F7679B3e5574fb2CC9Cb4c9E5994109ed8c' as `0x${string}`, // STAKING_CONTRACT_ADDRESS
          BigInt(MAX_UINT_256_STRING),
        ],
      });
      // Note: We use the write-wait-refetch pattern in the hook itself for UI updates
    } catch (e) {
      console.error('Approval error:', e);
    }
  };

  const handleStake = () => {
    if (!writeStake || !stakeAmount) return;
    try {
      const amount = parseUnits(stakeAmount, TOKEN_DECIMALS);
      writeStake({ args: [amount] });
      setStakeAmount('');
    } catch (e) {
      console.error('Stake error:', e);
    }
  };

  const handleUnstake = () => {
    if (!writeUnstake || !unstakeAmount) return;
    try {
      const amount = parseUnits(unstakeAmount, TOKEN_DECIMALS);
      writeUnstake({ args: [amount] });
      setUnstakeAmount('');
    } catch (e) {
      console.error('Unstake error:', e);
    }
  };

  const handleClaimRewards = () => {
    // The provided ABI only has 'unstake'. In many contracts,
    // unstake also claims rewards. If a dedicated claim function
    // exists (e.g., 'claimReward()'), we would implement it here.
    // For now, we'll guide the user to unstake to claim.
    alert('Please use the "Unstake" function to withdraw staked tokens and claim accumulated rewards.');
    console.log('Attempted to claim rewards.');
  };

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
          <div className="w-full space-y-8">
            <h2 className="text-xl font-semibold mb-4 text-center">Connected Address: {userAddress}</h2>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Wallet Balance */}
              <div className="staking-card">
                <p className="text-gray-400">Your AFRODEX Balance</p>
                <p className="text-3xl font-bold text-white mt-1">{tokenBalanceFormatted} AFRODEX</p>
              </div>

              {/* Card 2: Staked Balance */}
              <div className="staking-card">
                <p className="text-gray-400">Total Staked</p>
                <p className="text-3xl font-bold text-white mt-1">{stakeBalanceFormatted} AFRODEX</p>
              </div>

              {/* Card 3: Earned Rewards */}
              <div className="staking-card">
                <p className="text-gray-400">Pending Rewards</p>
                <p className="text-3xl font-bold text-white mt-1">{rewardValueFormatted} AFRODEX</p>
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
                  className="w-full p-3 mb-4 rounded-lg bg-gray-900 border border-gray-700 text-white focus:ring-amber-500 focus:border-amber-500"
                />

                {needsApproval ? (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-black font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50"
                  >
                    {isApproving ? 'Approving...' : 'Approve Staking'}
                  </button>
                ) : (
                  <button
                    onClick={handleStake}
                    disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0}
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
                  className="w-full p-3 mb-4 rounded-lg bg-gray-900 border border-gray-700 text-white focus:ring-amber-500 focus:border-amber-500"
                />
                <button
                  onClick={handleUnstake}
                  disabled={isUnstaking || !unstakeAmount || parseFloat(unstakeAmount) <= 0}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 mb-3"
                >
                  {isUnstaking ? 'Unstaking...' : 'Unstake AFRODEX'}
                </button>
                <button
                  onClick={handleClaimRewards}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition duration-200"
                >
                  Claim Rewards Only
                </button>
              </div>
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
