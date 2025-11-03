// src/components/AfrodexStaking.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useBalance,
  usePublicClient,
} from 'wagmi';
import { STAKING_ABI } from '../lib/StakingABI';
import { AFROX_TOKEN_ABI } from '../lib/AfroXTokenABI';

const STAKING_ADDR = process.env.NEXT_PUBLIC_STAKING_CONTRACT;
const TOKEN_ADDR = process.env.NEXT_PUBLIC_AFROX_TOKEN;
const AFROX_PRICE_USD = 0.000001; // static fallback until CoinGecko syncs

const glow = '0 0 12px rgba(255,140,0,0.6)';

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [reward, setReward] = useState(0);
  const [stakeBal, setStakeBal] = useState(0);
  const [walletBal, setWalletBal] = useState(0);
  const [apr] = useState(15);

  const { data: walletBalanceData } = useBalance({
    address,
    token: TOKEN_ADDR,
    watch: true,
  });

  const { writeContract } = useWriteContract();

  // === Fetch On-Chain Stake Info ===
  const fetchOnChain = async () => {
    if (!address) return;
    try {
      const [stakeRaw, rewardRaw] = await Promise.all([
        publicClient.readContract({
          address: STAKING_ADDR,
          abi: STAKING_ABI,
          functionName: 'stakedBalanceOf',
          args: [address],
        }),
        publicClient.readContract({
          address: STAKING_ADDR,
          abi: STAKING_ABI,
          functionName: 'earned',
          args: [address],
        }),
      ]);

      setStakeBal(Number(stakeRaw) / 1e18);
      setReward(Number(rewardRaw) / 1e18);
      if (walletBalanceData)
        setWalletBal(Number(walletBalanceData.value) / 1e18);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchOnChain();
  }, [address]);

  // === Contract Actions ===
  const handleApprove = async () => {
    try {
      await writeContract({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'approve',
        args: [STAKING_ADDR, BigInt(stakeAmount * 1e18)],
      });
      alert('Approved successfully!');
    } catch (err) {
      console.error(err);
      alert('Approval failed.');
    }
  };

  const handleStake = async () => {
    try {
      await writeContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [BigInt(stakeAmount * 1e18)],
      });
      alert('Stake successful!');
      fetchOnChain();
    } catch (err) {
      console.error(err);
      alert('Stake failed.');
    }
  };

  const handleUnstake = async () => {
    try {
      await writeContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [BigInt(unstakeAmount * 1e18)],
      });
      alert('Unstake successful!');
      fetchOnChain();
    } catch (err) {
      console.error(err);
      alert('Unstake failed.');
    }
  };

  const handleClaim = async () => {
    try {
      await writeContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'claimRewards',
        args: [],
      });
      alert('Rewards claimed!');
      fetchOnChain();
    } catch (err) {
      console.error(err);
      alert('Claim failed.');
    }
  };

  // === Rewards Calculator ===
  const estimatedRewards =
    stakeAmount && apr
      ? ((Number(stakeAmount) * apr) / 100).toFixed(2)
      : 0;
  const estUSD = (estimatedRewards * AFROX_PRICE_USD).toFixed(8);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(255,140,0,0.08), black 70%)',
      }}
    >
      <motion.h1
        className="text-3xl font-bold mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        AfroX Staking Dashboard
      </motion.h1>

      {!isConnected ? (
        <p className="text-gray-400">Connect your wallet to continue</p>
      ) : (
        <div className="w-full max-w-4xl space-y-8">
          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-lg border" style={{ boxShadow: glow }}>
              <p className="text-sm text-gray-400">Staked Balance</p>
              <p className="text-lg font-bold">{stakeBal} AfroX</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ boxShadow: glow }}>
              <p className="text-sm text-gray-400">Rewards Earned</p>
              <p className="text-lg font-bold">{reward} AfroX</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ boxShadow: glow }}>
              <p className="text-sm text-gray-400">Wallet Balance</p>
              <p className="text-lg font-bold">{walletBal} AfroX</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ boxShadow: glow }}>
              <p className="text-sm text-gray-400">Badge Tier</p>
              <p className="text-lg font-bold">Starter</p>
            </div>
          </div>

          {/* Stake / Unstake */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stake */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 rounded-xl border space-y-4"
              style={{ boxShadow: glow }}
            >
              <h2 className="text-xl font-semibold">Stake AfroX</h2>
              <input
                type="number"
                className="w-full p-2 text-black rounded-md"
                placeholder="Enter amount"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handleApprove}
                  className="flex-1 py-2 rounded-md font-semibold text-black"
                  style={{
                    backgroundColor: '#FFA500',
                    boxShadow: glow,
                  }}
                >
                  Approve
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handleStake}
                  className="flex-1 py-2 rounded-md font-semibold text-black"
                  style={{
                    backgroundColor: '#FFA500',
                    boxShadow: glow,
                  }}
                >
                  Stake
                </motion.button>
              </div>
            </motion.div>

            {/* Unstake */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 rounded-xl border space-y-4"
              style={{ boxShadow: glow }}
            >
              <h2 className="text-xl font-semibold">Unstake AfroX</h2>
              <input
                type="number"
                className="w-full p-2 text-black rounded-md"
                placeholder="Enter amount"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleUnstake}
                className="w-full py-2 rounded-md font-semibold text-black"
                style={{
                  backgroundColor: '#FFA500',
                  boxShadow: glow,
                }}
              >
                Unstake
              </motion.button>
            </motion.div>
          </div>

          {/* Claim Rewards */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 rounded-xl border space-y-4 text-center"
            style={{ boxShadow: glow }}
          >
            <h2 className="text-xl font-semibold">Rewards Center</h2>
            <p className="text-lg">{reward} AfroX Available</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={handleClaim}
              className="px-6 py-2 rounded-md font-semibold text-black"
              style={{
                backgroundColor: '#FFA500',
                boxShadow: glow,
              }}
            >
              Claim Rewards
            </motion.button>
          </motion.div>

          {/* Rewards Calculator */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 rounded-xl border space-y-4 text-center"
            style={{ boxShadow: glow }}
          >
            <h2 className="text-xl font-semibold">Rewards Calculator</h2>
            <p className="text-gray-400">
              Estimate based on {apr}% APR and static price ${AFROX_PRICE_USD}
            </p>
            <p className="text-lg">
              You’ll earn approximately{' '}
              <strong>{estimatedRewards} AfroX</strong> (~$
              {estUSD}) yearly on your stake.
            </p>
          </motion.div>

          {/* Footer */}
          <footer className="text-center text-sm text-gray-500 mt-8">
            © 2019-Present AFRODEX. All rights reserved | ❤️ Donations:{' '}
            <span className="text-orange-400">
              0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}
