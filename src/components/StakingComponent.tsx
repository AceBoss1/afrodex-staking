// src/components/StakingComponent.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { 
  useAfrodexBalance, 
  useStakingInfo, 
  useApproveStaking, 
  useStake, 
  useUnstake,
  useAfrodexAllowance,
  useWaitForTransactionReceipt,
  parseUnits,
  MaxUint256
} from '../hooks/useStaking';

const AfroDexStakingComponent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [isApproved, setIsApproved] = useState(false);

  // --- Read Contract Data ---
  const { data: balance, refetch: refetchBalance } = useAfrodexBalance();
  const { data: stakingInfo, refetch: refetchStakingInfo } = useStakingInfo();
  const { data: allowance, refetch: refetchAllowance } = useAfrodexAllowance();
  
  const tokenSymbol = 'AFRODEX'; // Assuming the token symbol

  // --- Write Contract Hooks (Transactions) ---
  const { writeContract: writeApprove, data: hashApprove } = useApproveStaking();
  const { writeContract: writeStake, data: hashStake } = useStake();
  const { writeContract: writeUnstake, data: hashUnstake } = useUnstake();

  // --- Transaction Status ---
  const { isLoading: isConfirmingApprove, isSuccess: isSuccessApprove } = useWaitForTransactionReceipt({ hash: hashApprove });
  const { isLoading: isConfirmingStake, isSuccess: isSuccessStake } = useWaitForTransactionReceipt({ hash: hashStake });
  const { isLoading: isConfirmingUnstake, isSuccess: isSuccessUnstake } = useWaitForTransactionReceipt({ hash: hashUnstake });

  // --- Effects for State and Refetching ---

  // Check if staking contract is approved to spend user's tokens
  useEffect(() => {
    if (allowance !== undefined) {
        // A very large number is typically used to represent 'unlimited' allowance
        setIsApproved(allowance >= parseUnits('1000000000', 18));
    }
  }, [allowance]);

  // Refetch data after successful transaction
  useEffect(() => {
    if (isSuccessApprove || isSuccessStake || isSuccessUnstake) {
      refetchBalance();
      refetchStakingInfo();
      refetchAllowance();
      setStakeAmount('');
      setUnstakeAmount('');
      console.log('Successfully confirmed transaction, refetching data.');
    }
  }, [isSuccessApprove, isSuccessStake, isSuccessUnstake, refetchBalance, refetchStakingInfo, refetchAllowance]);


  // --- Handlers ---

  const handleApprove = () => {
    writeApprove({
      args: [STAKING_CONTRACT_ADDRESS, MaxUint256],
    });
  };

  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    try {
      const amount = parseUnits(stakeAmount, 18);
      writeStake({ args: [amount] });
    } catch (e) {
      console.error("Invalid stake amount:", e);
      // In a real app, show a friendly error message to the user
    }
  };

  const handleUnstake = () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    try {
      const amount = parseUnits(unstakeAmount, 18);
      writeUnstake({ args: [amount] });
    } catch (e) {
      console.error("Invalid unstake amount:", e);
    }
  };

  // --- Render Logic ---

  if (!isConnected) {
    return (
      <div className="staking-card text-center">
        <h2 className="text-xl font-bold mb-4">Connect Your Wallet to Begin Staking</h2>
        <ConnectButton />
      </div>
    );
  }

  // Determine button state and text based on transaction status
  const getButtonState = (isLoading: boolean, isConfirming: boolean, defaultText: string) => {
    if (isLoading) return { disabled: true, text: 'Waiting for Wallet...' };
    if (isConfirming) return { disabled: true, text: 'Confirming Tx...' };
    return { disabled: false, text: defaultText };
  };

  const approveState = getButtonState(useApproveStaking().isLoading, isConfirmingApprove, `Approve ${tokenSymbol}`);
  const stakeState = getButtonState(useStake().isLoading, isConfirmingStake, `Stake ${tokenSymbol}`);
  const unstakeState = getButtonState(useUnstake().isLoading, isConfirmingUnstake, `Unstake & Claim`);

  return (
    <div className="staking-dashboard">
      <div className="header">
        <h1 className="text-3xl font-extrabold mb-1">AfroDex Staking Dashboard</h1>
        <p className="text-amber-400">Secure staking powered by Ethereum Mainnet.</p>
        <div className="wallet-info">
            <ConnectButton />
        </div>
      </div>

      <div className="stats-grid">
        <StatCard title={`Your ${tokenSymbol} Balance`} value={balance || '0.00'} />
        <StatCard title="Total Staked Amount" value={stakingInfo?.stakedAmount || '0.00'} />
        <StatCard title="Pending Rewards" value={stakingInfo?.pendingRewards || '0.00'} isReward={true} />
      </div>

      <div className="action-panels">
        {/* --- STAKE PANEL --- */}
        <div className="action-card">
          <h2 className="text-2xl font-semibold mb-4">Stake Tokens</h2>
          
          <input
            type="number"
            placeholder={`Amount of ${tokenSymbol} to Stake`}
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="input-field"
            disabled={!isApproved}
          />
          
          {isApproved ? (
            <button
              onClick={handleStake}
              disabled={stakeState.disabled || !stakeAmount}
              className={`action-button ${stakeState.disabled ? 'disabled-button' : 'hover:bg-amber-500'}`}
            >
              {stakeState.text}
            </button>
          ) : (
            <div className="approve-section">
                <p className='text-sm text-gray-400 mb-2'>First, approve the contract to manage your tokens.</p>
                <button
                    onClick={handleApprove}
                    disabled={approveState.disabled}
                    className={`approve-button ${approveState.disabled ? 'disabled-button' : 'hover:bg-amber-500'}`}
                >
                    {approveState.text}
                </button>
            </div>
          )}
        </div>

        {/* --- UNSTAKE PANEL (and Claim) --- */}
        <div className="action-card">
          <h2 className="text-2xl font-semibold mb-4">Unstake & Claim</h2>
          
          <input
            type="number"
            placeholder={`Amount of ${tokenSymbol} to Unstake`}
            value={unstakeAmount}
            onChange={(e) => setUnstakeAmount(e.target.value)}
            className="input-field"
          />
          
          <button
            onClick={handleUnstake}
            disabled={unstakeState.disabled || !unstakeAmount}
            className={`action-button ${unstakeState.disabled ? 'disabled-button' : 'hover:bg-amber-500'}`}
          >
            {unstakeState.text}
          </button>
          <p className='text-sm mt-3 text-gray-400'>* Unstaking any amount will automatically claim all pending rewards.</p>
        </div>
      </div>
    </div>
  );
};

// Simple reusable card component
const StatCard = ({ title, value, isReward = false }: { title: string, value: string, isReward?: boolean }) => (
  <div className="stat-card">
    <p className="stat-title">{title}</p>
    <p className={`stat-value ${isReward ? 'text-green-400' : 'text-amber-300'}`}>
      {parseFloat(value).toFixed(2)} AFRODEX
    </p>
  </div>
);

export default AfroDexStakingComponent;
