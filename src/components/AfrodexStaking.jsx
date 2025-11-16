'use client';

import React, { useEffect, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';

import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';
import { STAKING_ABI } from '../lib/abis/stakingAbi';

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // -----------------------------
  // STATE
  // -----------------------------
  const [tokenBalance, setTokenBalance] = useState('0');
  const [stakeBalance, setStakeBalance] = useState('0');
  const [rewardValue, setRewardValue] = useState('0');
  const [lastUnstake, setLastUnstake] = useState(0);
  const [lastReward, setLastReward] = useState(0);

  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [decimals, setDecimals] = useState(4); // AfroX = 4 decimals

  // -----------------------------
  // HELPERS
  // -----------------------------
  const fmt = (v) => {
    if (!v) return '0';
    try {
      return Number(formatUnits(BigInt(v), decimals)).toLocaleString();
    } catch {
      return '0';
    }
  };

  const toWei = (v) => parseUnits(v || '0', decimals);

  // -----------------------------
  // READ FUNCTIONS
  // -----------------------------
  async function loadTokenBalance() {
    if (!publicClient || !address) return;

    const bal = await readContractSafe(publicClient, {
      address: TOKEN_ADDRESS,
      abi: STAKING_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    if (bal !== null) setTokenBalance(bal.toString());
  }

  async function loadStakeInfo() {
    if (!publicClient || !address) return;

    const info = await readContractSafe(publicClient, {
      address: STAKING_ADDRESS,
      abi: STAKING_ABI,
      functionName: 'viewStakeInfoOf',
      args: [address],
    });

    if (info) {
      setStakeBalance(info[0].toString());
      setRewardValue(info[1].toString());
      setLastUnstake(Number(info[2]));
      setLastReward(Number(info[3]));
    }
  }

  async function loadDecimals() {
    const d = await readContractSafe(publicClient, {
      address: TOKEN_ADDRESS,
      abi: STAKING_ABI,
      functionName: 'decimals',
      args: [],
    });

    if (d !== null) setDecimals(Number(d));
  }

  // -----------------------------
  // WRITE: Approve
  // -----------------------------
  async function approve() {
    if (!walletClient || !amount) return alert('Enter amount');

    try {
      setPending(true);

      await writeContractSafe(walletClient, {
        address: TOKEN_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, toWei(amount)],
      });

      alert('Approve successful');
    } catch (err) {
      console.error(err);
      alert('Approve failed: ' + err.message);
    } finally {
      setPending(false);
    }
  }

  // -----------------------------
  // WRITE: Stake
  // -----------------------------
  async function stake() {
    if (!walletClient || !amount) return alert('Enter amount');

    try {
      setPending(true);

      await writeContractSafe(walletClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [toWei(amount)],
      });

      alert('Stake successful');
      loadStakeInfo();
      loadTokenBalance();
    } catch (err) {
      console.error(err);
      alert('Stake failed: ' + err.message);
    } finally {
      setPending(false);
    }
  }

  // -----------------------------
  // WRITE: Unstake
  // -----------------------------
  async function unstake() {
    if (!walletClient || !amount) return alert('Enter amount');

    try {
      setPending(true);

      await writeContractSafe(walletClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [toWei(amount)],
      });

      alert('Unstake successful');
      loadStakeInfo();
      loadTokenBalance();
    } catch (err) {
      alert('Unstake failed: ' + err.message);
    } finally {
      setPending(false);
    }
  }

  // -----------------------------
  // WRITE: Claim Rewards
  // -----------------------------
  async function claim() {
    if (!walletClient) return;

    try {
      setPending(true);

      // Claiming = calling stake(0) or a claim function
      await writeContractSafe(walletClient, {
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [0n],
      });

      alert('Claim successful');
      loadStakeInfo();
      loadTokenBalance();
    } catch (err) {
      alert('Claim failed: ' + err.message);
    } finally {
      setPending(false);
    }
  }

  // -----------------------------
  // LOAD INITIAL DATA
  // -----------------------------
  useEffect(() => {
    if (!isConnected) return;

    loadDecimals();
    loadTokenBalance();
    loadStakeInfo();
  }, [isConnected, address]);

  // refresh every 20s
  useEffect(() => {
    if (!isConnected) return;

    const t = setInterval(() => {
      loadStakeInfo();
      loadTokenBalance();
    }, 20000);

    return () => clearInterval(t);
  }, [isConnected]);

  // -----------------------------
  // UI RENDER
  // -----------------------------
  if (!isConnected)
    return (
      <div className="text-center text-gray-300 py-10">
        Connect your wallet to view staking dashboard.
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20">

      {/* ------------------------ */}
      {/* Wallet Status Card */}
      {/* ------------------------ */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-8">
        <h2 className="text-xl text-orange-400 font-semibold">Connected Wallet</h2>
        <p className="text-gray-300 mt-2 break-all">{address}</p>
      </div>

      {/* ------------------------ */}
      {/* Balance Cards */}
      {/* ------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
          <h3 className="text-lg text-gray-300">Wallet Balance</h3>
          <p className="text-3xl text-white mt-2">{fmt(tokenBalance)} AfroX</p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
          <h3 className="text-lg text-gray-300">Staked Balance</h3>
          <p className="text-3xl text-white mt-2">{fmt(stakeBalance)} AfroX</p>
        </div>
      </div>

      {/* ------------------------ */}
      {/* Rewards Card */}
      {/* ------------------------ */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 mb-8">
        <h3 className="text-lg text-gray-300">Accumulated Rewards</h3>
        <p className="text-3xl text-green-400 mt-2">{fmt(rewardValue)} AfroX</p>

        <div className="text-gray-400 text-sm mt-4">
          <p>Last Reward Timestamp: {lastReward || '—'}</p>
          <p>Last Unstake Timestamp: {lastUnstake || '—'}</p>
        </div>

        <button
          onClick={claim}
          disabled={pending}
          className="mt-5 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg"
        >
          {pending ? 'Processing...' : 'Claim Rewards'}
        </button>
      </div>

      {/* ------------------------ */}
      {/* Stake / Unstake Controls */}
      {/* ------------------------ */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <h3 className="text-lg text-gray-300 mb-3">Stake / Unstake</h3>

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-3 rounded bg-gray-900 border border-gray-700 text-white mb-4"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={approve}
            disabled={pending}
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
          >
            Approve
          </button>

          <button
            onClick={stake}
            disabled={pending}
            className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg"
          >
            Stake
          </button>

          <button
            onClick={unstake}
            disabled={pending}
            className="bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg"
          >
            Unstake
          </button>
        </div>
      </div>
    </div>
  );
}
