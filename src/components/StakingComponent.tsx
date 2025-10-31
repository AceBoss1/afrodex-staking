// src/components/StakingComponent.tsx

import React, { useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useTokenData,
  useStakingInfo,
  useApproveStaking,
  useStake,
  useUnstake,
} from '../hooks/useStaking';
import { formatUnits } from 'viem';
import { STAKING_CONTRACT_ADDRESS } from '../config/abis';

// --- Helper: Render Transaction Status ---
const TransactionStatus = ({ isPending, isConfirming, isConfirmed, error }: any) => {
  if (isPending) return <p className="text-amber-400 mt-2">Waiting for Wallet Confirmation...</p>;
  if (isConfirming) return <p className="text-amber-400 mt-2">Transaction Submitting...</p>;
  if (isConfirmed) return <p className="text-green-500 mt-2">Transaction Confirmed!</p>;
  if (error) return <p className="text-red-500 mt-2">Error: {(error as any).shortMessage || (error as Error).message}</p>;
  return null;
};

const ConnectWalletPrompt = () => (
    <div className="text-center p-8 bg-zinc-800 rounded-lg shadow-xl border border-amber-500/20">
        <p className="text-xl text-amber-500 mb-4 font-semibold">Connect Your Wallet to Begin Staking</p>
        <ConnectButton />
    </div>
);

// --- Main Component ---
export const AfroDexStakingComponent: React.FC = () => {
  const { isConnected, address: userAddress } = useAccount();

  // FIX: All hooks must be called at the top level, unconditionally.
  const { userBalance, allowanceValue, refetch: refetchTokenData } = useTokenData();
  const { stakeBalance, rewardValue, refetch: refetchStakingInfo } = useStakingInfo();
  
  // Write Hooks
  const { approve, isPending: isApprovePending, isConfirming: isApproveConfirming, isConfirmed: isApproveConfirmed, error: approveError } = useApproveStaking();
  const { amount: stakeAmount, setAmount: setStakeAmount, stake, isPending: isStakePending, isConfirming: isStakeConfirming, isConfirmed: isStakeConfirmed, error: stakeError } = useStake();
  const { amount: unstakeAmount, setAmount: setUnstakeAmount, unstake, isPending: isUnstakePending, isConfirming: isUnstakeConfirming, isConfirmed: isUnstakeConfirmed, error: unstakeError } = useUnstake();

  // Refetch data after any successful transaction
  useEffect(() => {
    if (isApproveConfirmed || isStakeConfirmed || isUnstakeConfirmed) {
      refetchTokenData();
      refetchStakingInfo();
    }
  }, [isApproveConfirmed, isStakeConfirmed, isUnstakeConfirmed, refetchTokenData, refetchStakingInfo]);

  // Derived state to determine if approval is needed (e.g., if allowance is less than maximum possible stake)
  const isApproved = useMemo(() => {
    // Check if allowance is a very large number (like maxUint256, which grants infinite allowance)
    if (!allowanceValue) return false;
    // A simplified check: if allowance is greater than 1 million tokens (or some safe high threshold)
    return allowanceValue > BigInt(1000000) * BigInt(10**18);
  }, [allowanceValue]);

  // --- Render Functions ---

  const renderStakeUnstake = (action: 'Stake' | 'Unstake') => {
    const isStake = action === 'Stake';
    const amount = isStake ? stakeAmount : unstakeAmount;
    const setAmount = isStake ? setStakeAmount : setUnstakeAmount;
    const execute = isStake ? stake : unstake;
    const isPending = isStake ? isStakePending : isUnstakePending;
    const isConfirming = isStake ? isStakeConfirming : isUnstakeConfirming;
    const error = isStake ? stakeError : unstakeError;

    const maxBalance = isStake ? userBalance : stakeBalance;
    const maxFunction = isStake ? setStakeAmount : setUnstakeAmount;

    // Check if the input amount is valid (non-zero and less than or equal to available balance/stake)
    const canExecute = parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(maxBalance);

    return (
      <div className="action-card">
        <h3 className="text-2xl font-bold text-amber-500 mb-6">{action} AFRODEX</h3>

        {/* Amount Input */}
        <div className="relative mb-3">
            <input
                type="number"
                placeholder={`Amount to ${action.toLowerCase()}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field pr-20" // Add padding right for the MAX button
            />
            <button
                onClick={() => maxFunction(maxBalance)}
                className="absolute right-0 top-0 h-full px-4 text-sm font-semibold text-white bg-amber-600 rounded-r-md hover:bg-amber-700 transition"
                style={{ clipPath: 'inset(1px 1px 1px 0px round 0 6px 6px 0)' }} // Visual fix for rounded corner conflict
            >
                MAX
            </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Available {isStake ? 'Token Balance' : 'Staked Balance'}: {maxBalance} AFRODEX
        </p>

        {/* Approval or Action Button */}
        {isStake && !isApproved ? (
          <div className="approve-section">
            <p className="text-sm text-gray-300 mb-3">Approval is required before staking.</p>
            <button
              onClick={() => approve()}
              disabled={isApprovePending || isApproveConfirming}
              className={`approve-button ${isApprovePending || isApproveConfirming ? 'disabled-button' : ''}`}
            >
              {isApprovePending || isApproveConfirming ? 'Approving...' : 'Approve Staking'}
            </button>
            <TransactionStatus isPending={isApprovePending} isConfirming={isApproveConfirming} error={approveError} />
          </div>
        ) : (
          <button
            onClick={() => execute()}
            disabled={!canExecute || isPending || isConfirming}
            className={`action-button ${!canExecute || isPending || isConfirming ? 'disabled-button' : ''}`}
          >
            {isPending || isConfirming ? `Processing ${action}...` : action}
          </button>
        )}
        <TransactionStatus isPending={isPending} isConfirming={isConfirming} error={error} />
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="staking-dashboard">
        <ConnectWalletPrompt />
      </div>
    );
  }

  return (
    <div className="staking-dashboard">
      {/* Header and Wallet Info */}
      <div className="header">
        <h1 className="text-4xl font-extrabold text-amber-500">AfroDex Staking Dashboard</h1>
        <p className="text-gray-400 mt-2">Earn rewards by staking your AFRODEX tokens.</p>
        <div className="wallet-info">
            <ConnectButton showBalance={false} />
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-title">Wallet Balance</p>
          <p className="stat-value text-amber-300">{userBalance} AFRODEX</p>
        </div>
        <div className="stat-card">
          <p className="stat-title">Total Staked</p>
          <p className="stat-value">{stakeBalance} AFRODEX</p>
        </div>
        <div className="stat-card">
          <p className="stat-title">Pending Rewards</p>
          <p className="stat-value text-green-400">{rewardValue} AFRODEX</p>
        </div>
        <div className="stat-card">
          <p className="stat-title">Staking Contract</p>
          <p className="stat-value text-xs font-normal truncate">{STAKING_CONTRACT_ADDRESS}</p>
        </div>
      </div>

      {/* Action Panels */}
      <div className="action-panels">
        {renderStakeUnstake('Stake')}
        {renderStakeUnstake('Unstake')}
      </div>
      
      {/* Reward Claim Panel (Using Unstake combined functionality) */}
      <div className="action-panels mt-8">
        <div className="action-card col-span-1 md:col-span-2 text-center">
            <h3 className="text-2xl font-bold text-amber-500 mb-6">Claim Rewards</h3>
            <p className="text-lg text-gray-300 mb-6">
                Your pending rewards of <span className="text-green-400 font-bold">{rewardValue} AFRODEX</span> will be automatically claimed when you *Unstake* any amount. 
                If you wish to claim without unstaking, you may be able to unstake a very small amount (e.g., 1 AFRODEX) to trigger the reward distribution.
            </p>
        </div>
      </div>

    </div>
  );
};
