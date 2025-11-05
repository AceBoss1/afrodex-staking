// src/components/AfrodexStaking.jsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import {
  useAccount,
  usePublicClient,
  useWalletClient,
} from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { STAKING_ABI, AFROX_TOKEN_ABI } from '../lib/abis'; // <-- ensure this file exports STAKING_ABI & AFROX_TOKEN_ABI

// Environment (should be set in .env.local)
const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS;

// UI constants
const PRICE_USD_STATIC = 0.000001; // static AfroX USD price until CoinGecko returns
const DEFAULT_DECIMALS = 4; // your token has 4 decimals as you said

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();    // for readonly calls
  const walletClient = useWalletClient();    // for signing / writes

  // UI state
  const [amount, setAmount] = useState(''); // amount user enters (token units)
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [txHash, setTxHash] = useState(null);

  // APR / Reward calculator state
  const [aprPercent, setAprPercent] = useState(24.09); // default computed earlier
  const [estDays, setEstDays] = useState(30);

  function useStakedDuration(startTimestamp) {
  const [duration, setDuration] = React.useState('');

  React.useEffect(() => {
    if (!startTimestamp || startTimestamp <= 0) return;

    function update() {
      const now = Date.now() / 1000;
      const diff = now - startTimestamp;

      if (diff <= 0) return setDuration('0s');

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);

      setDuration(
        `${days > 0 ? days + 'd ' : ''}${hours > 0 ? hours + 'h ' : ''}${minutes > 0 ? minutes + 'm' : ''}`
      );
    }

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [startTimestamp]);

  return duration || '0m';
}

const stakedDuration = useStakedDuration(lastRewardTimestamp);

  // Helper: format token amounts using decimals
  const toHuman = useCallback((raw) => {
    try {
      return formatUnits(BigInt(raw || 0n), tokenDecimals || DEFAULT_DECIMALS);
    } catch (e) {
      // fallback
      return (Number(raw || 0) / (10 ** (tokenDecimals || DEFAULT_DECIMALS))).toString();
    }
  }, [tokenDecimals]);

  const toRaw = useCallback((humanStr) => {
    try {
      return parseUnits(humanStr || '0', tokenDecimals || DEFAULT_DECIMALS);
    } catch (e) {
      // parseUnits will throw if invalid, return 0n
      return 0n;
    }
  }, [tokenDecimals]);

  // Fetch on-chain data (balances, allowance, stake info)
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;

    try {
      // Token decimals (safe-guard)
      try {
        const decimalsRaw = await publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'decimals',
          args: [],
        });
        if (decimalsRaw) {
          const d = typeof decimalsRaw === 'bigint' ? Number(decimalsRaw) : Number(decimalsRaw ?? DEFAULT_DECIMALS);
          setTokenDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);
        }
      } catch (err) {
        // keep default if function missing
        setTokenDecimals(DEFAULT_DECIMALS);
      }

      // Wallet token balance
      if (address) {
        try {
          const balRaw = await publicClient.readContract({
            address: TOKEN_ADDRESS,
            abi: AFROX_TOKEN_ABI,
            functionName: 'balanceOf',
            args: [address],
          });
          setWalletBalance(toHuman(balRaw));
        } catch (e) {
          setWalletBalance('0');
        }

        // Allowance
        try {
          const allowanceRaw = await publicClient.readContract({
            address: TOKEN_ADDRESS,
            abi: AFROX_TOKEN_ABI,
            functionName: 'allowance',
            args: [address, STAKING_ADDRESS],
          });
          setAllowance(toHuman(allowanceRaw));
        } catch (e) {
          // function might not exist on token ABI — handle gracefully
          setAllowance('0');
        }

        // Staking contract: viewStakeInfoOf (if available) or fallback stake()
        try {
          const stakeInfo = await publicClient.readContract({
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'viewStakeInfoOf',
            args: [address],
          });
          // stakeInfo expected: [stakeBalance, rewardValue, lastUnstakeTimestamp, lastRewardTimestamp]
          if (stakeInfo && stakeInfo[0] !== undefined) {
            setStakedBalance(toHuman(stakeInfo[0]));
            setRewards(toHuman(stakeInfo[1] ?? 0n));
          }
        } catch (err) {
          // fallback: try a "stake" or "balanceOf" on staking contract
          try {
            const stBal = await publicClient.readContract({
              address: STAKING_ADDRESS,
              abi: STAKING_ABI,
              functionName: 'balanceOf',
              args: [address],
            });
            setStakedBalance(toHuman(stBal));
          } catch (_) {
            setStakedBalance('0');
          }
        }
      } else {
        setWalletBalance('0');
        setStakedBalance('0');
        setAllowance('0');
        setRewards('0');
      }
    } catch (err) {
      console.error('fetchOnChain error', err);
    }
  }, [publicClient, address, toHuman]);

  // Poll once on mount and when address changes
  useEffect(() => {
    fetchOnChain();
    // refresh every 30 seconds while connected
    let timer;
    if (isConnected) {
      timer = setInterval(fetchOnChain, 30_000);
    }
    return () => clearInterval(timer);
  }, [fetchOnChain, isConnected]);

  // UX helpers
  const shortAddr = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  // Write helpers (use walletClient.writeContract)
  async function handleApprove() {
    if (!walletClient || !isConnected) {
      alert('Connect your wallet first');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert('Enter an amount to approve');
      return;
    }

    setIsApproving(true);
    setTxHash(null);
    try {
      const rawAmount = toRaw(amount); // bigint
      const tx = await walletClient.writeContract({
        address: TOKEN_ADDRESS,
        abi: AFROX_TOKEN_ABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, rawAmount],
      });
      setTxHash(tx?.hash ?? null);
      // wait for receipt if walletClient has wait method (some wallets return)
      try {
        if (tx?.request && walletClient.waitForTransaction) {
          await walletClient.waitForTransaction({ hash: tx.request.hash });
        }
      } catch (_) {}
      // refresh
      await fetchOnChain();
    } catch (err) {
      console.error('approve failed', err);
      alert('Approve failed: ' + (err?.message || err));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleStake() {
    if (!walletClient || !isConnected) {
      alert('Connect your wallet first');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      alert('Enter an amount to stake');
      return;
    }

    setIsStaking(true);
    setTxHash(null);
    try {
      const raw = toRaw(amount);

      // Try common staking function names: depositToken(tokenAddr, amount) or stake(amount)
      const tryCalls = [
        { fn: 'depositToken', args: [TOKEN_ADDRESS, raw] },
        { fn: 'stake', args: [raw] },
      ];

      let receipt;
      for (const call of tryCalls) {
        try {
          const tx = await walletClient.writeContract({
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: call.fn,
            args: call.args,
          });
          setTxHash(tx?.hash ?? null);
          receipt = tx;
          break;
        } catch (err) {
          // try next
          continue;
        }
      }

      if (!receipt) throw new Error('No usable staking function found in ABI or call failed.');

      // optional wait
      try {
        if (receipt?.request && walletClient.waitForTransaction) {
          await walletClient.waitForTransaction({ hash: receipt.request.hash });
        }
      } catch (_) {}

      await fetchOnChain();
    } catch (err) {
      console.error('stake failed', err);
      alert('Stake failed: ' + (err?.message || err));
    } finally {
      setIsStaking(false);
    }
  }

  async function handleUnstake() {
    if (!walletClient || !isConnected) {
      alert('Connect your wallet first');
      return;
    }
    if (!unstakeAmount || Number(unstakeAmount) <= 0) {
      alert('Enter an amount to unstake');
      return;
    }
    setIsUnstaking(true);
    setTxHash(null);
    try {
      const raw = toRaw(unstakeAmount);
      // common function name: unstake(amount)
      const tx = await walletClient.writeContract({
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [raw],
      });
      setTxHash(tx?.hash ?? null);
      try {
        if (tx?.request && walletClient.waitForTransaction) {
          await walletClient.waitForTransaction({ hash: tx.request.hash });
        }
      } catch (_) {}
      await fetchOnChain();
    } catch (err) {
      console.error('unstake failed', err);
      alert('Unstake failed: ' + (err?.message || err));
    } finally {
      setIsUnstaking(false);
    }
  }

  async function handleClaim() {
    if (!walletClient || !isConnected) {
      alert('Connect your wallet first');
      return;
    }
    setIsClaiming(true);
    setTxHash(null);
    try {
      // Try claim(), claimRewards(), or a minimal unstake-claim hack
      const candidates = ['claim', 'claimRewards', 'withdrawReward', 'getReward'];
      let found = false;
      for (const fn of candidates) {
        try {
          const tx = await walletClient.writeContract({
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: fn,
            args: [],
          });
          setTxHash(tx?.hash ?? null);
          found = true;
          try {
            if (tx?.request && walletClient.waitForTransaction) {
              await walletClient.waitForTransaction({ hash: tx.request.hash });
            }
          } catch (_) {}
          break;
        } catch (_) {
          continue;
        }
      }

      // If no claim function exists, try a minimal unstake+stake hack of 0 (some contracts allow)
      if (!found) {
        try {
          const tx2 = await walletClient.writeContract({
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'unstake',
            args: [0n],
          });
          setTxHash(tx2?.hash ?? null);
          try {
            if (tx2?.request && walletClient.waitForTransaction) {
              await walletClient.waitForTransaction({ hash: tx2.request.hash });
            }
          } catch (_) {}
        } catch (err) {
          console.warn('claim fallback failed', err);
          alert('Claim not available on this staking contract.');
        }
      }

      await fetchOnChain();
    } catch (err) {
      console.error('claim failed', err);
      alert('Claim failed: ' + (err?.message || err));
    } finally {
      setIsClaiming(false);
    }
  }

  // Rewards calculator
  const estimatedRewards = () => {
    const stake = Number(stakedBalance || 0);
    const apr = Number(aprPercent || 0) / 100; // decimal
    const days = Number(estDays || 0);
    const reward = stake * apr * (days / 365);
    const usd = reward * PRICE_USD_STATIC;
    return { reward, usd };
  };

  const { reward: estReward, usd: estUsd } = estimatedRewards();

  // UI motion variants
  const cardVariant = { hover: { scale: 1.02, boxShadow: '0 10px 30px rgba(255,140,0,0.18)' }, initial: {} };
  const glow = { boxShadow: '0 0 18px rgba(255,140,0,0.24)' };

  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">AfroX Staking Dashboard</h1>
          <p className="text-sm text-orange-300/80">Stake AfroX and earn rewards</p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-12">
        {/* Top analytics row */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.02)' }}
            whileHover={{ ...glow }}
          >
            <div className="text-sm text-gray-300">Your Stake</div>
<div className="text-2xl font-bold flex items-center gap-2">
  <img src="/afrodex_token.png" alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
  {stakedBalance} AfroX
</div>

          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ ...glow }}>
            <div className="text-sm text-gray-300">Rewards</div>
<div className="text-2xl font-bold flex items-center gap-2">
  <img src="/afrodex_token.png" alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
  {rewards} AfroX
</div>

          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ ...glow }}>
            <div className="text-sm text-gray-300">Wallet Balance</div>
<div className="text-2xl font-bold flex items-center gap-2">
  <img src="/afrodex_token.png" alt="AfroX" className="h-5 w-5 rounded-full opacity-90" />
  {walletBalance} AfroX
</div>

          </motion.div>

          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10 flex flex-col justify-between" whileHover={{ ...glow }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300">Badge Tier</div>
                <div className="text-lg font-semibold text-orange-300">Starter</div>
              </div>
              <div className="text-xs text-gray-400">{address ? shortAddr(address) : 'Not connected'}</div>
            </div>
            <div className="mt-3 text-xs text-gray-400">Tier thresholds: 10m, 100m, 1b, 10b</div>
          </motion.div>
        </section>

        {/* Stake / Unstake two-column layout */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* APPROVE + STAKE */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30" variants={cardVariant} initial="initial" whileHover="hover">
            <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
            <div className="text-sm text-gray-400 mb-4">Approve AfroX to the staking contract and then stake.</div>

            <label className="block text-xs text-gray-300 mb-1">Amount (AfroX)</label>
            <input
              type="number"
              step="0.0001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                onClick={handleApprove}
                whileHover={{ scale: 1.02 }}
                className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium shadow"
                style={{ boxShadow: '0 6px 18px rgba(255,140,0,0.12)' }}
                disabled={!isConnected || isApproving}
              >
                {isApproving ? 'Approving...' : 'Approve'}
              </motion.button>

              <motion.button
                onClick={handleStake}
                whileHover={{ scale: 1.02 }}
                className="py-3 rounded-xl bg-orange-500 text-black font-semibold"
                disabled={!isConnected || isStaking}
              >
                {isStaking ? 'Staking...' : 'Stake'}
              </motion.button>
            </div>

            <div className="mt-4 text-xs text-gray-400">
              Allowance: <span className="text-orange-300 font-medium">{allowance}</span>
            </div>
            {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
          </motion.div>

          {/* UNSTAKE */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30" variants={cardVariant} initial="initial" whileHover="hover">
            <h2 className="text-xl font-bold mb-3">Unstake</h2>
            <div className="text-sm text-gray-400 mb-4">Unstake your AfroX tokens and claim rewards.</div>

            <label className="block text-xs text-gray-300 mb-1">Amount to Unstake</label>
            <input
              type="number"
              step="0.0001"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="0.0"
              className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                onClick={handleUnstake}
                whileHover={{ scale: 1.02 }}
                className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium"
                disabled={!isConnected || isUnstaking}
              >
                {isUnstaking ? 'Unstaking...' : 'Unstake'}
              </motion.button>

              <motion.button
                onClick={handleClaim}
                whileHover={{ scale: 1.02 }}
                className="py-3 rounded-xl bg-orange-500 text-black font-semibold"
                disabled={!isConnected || isClaiming}
              >
                {isClaiming ? 'Claiming...' : 'Claim Rewards'}
              </motion.button>
            </div>

            <div className="mt-4 text-xs text-gray-400">
              Your Rewards: <span className="text-orange-300 font-medium">{rewards} AfroX</span>
            </div>
          </motion.div>
        </section>

        {/* Claim full width & Rewards center */}
      <section className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10 mb-6">
  <h3 className="text-lg font-bold mb-4">Rewards Center</h3>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {/* Calculator */}
    <div className="md:col-span-2">
      <div className="text-sm text-gray-300 mb-3">Reward Estimator</div>

      {/* Days Input */}
      <label className="block text-xs text-gray-400 mb-1">Days to Stake</label>
      <input
        type="number"
        step="1"
        value={estDays}
        onChange={(e) => setEstDays(Number(e.target.value))}
        className="w-full p-2 rounded bg-gray-800 text-white mb-3"
      />

      {/* Stake Amount Input */}
      <label className="block text-xs text-gray-400 mb-1">Amount to Stake (AfroX)</label>
      <input
        type="number"
        step="0.0001"
        value={stakedBalance}
        onChange={(e) => setStakedBalance(e.target.value)}
        className="w-full p-2 rounded bg-gray-800 text-white mb-4"
      />

      {/* Output */}
      <div className="text-gray-300 leading-relaxed">
        <div>Estimated {estDays} day reward: <span className="font-bold text-white">{Number(estReward).toFixed(6)} AfroX</span></div>
        <div className="text-sm text-gray-400">≈ ${Number(estUsd).toFixed(6)} (at ${PRICE_USD_STATIC} / token)</div>

        <div className="mt-3 text-sm">
          <div>Estimated Daily Reward: <span className="text-orange-300 font-semibold">{(Number(stakedBalance) * 0.0003).toFixed(6)} AfroX</span></div>
          <div>Estimated Monthly Reward (30d): <span className="text-orange-300 font-semibold">{(Number(stakedBalance) * 0.009).toFixed(6)} AfroX</span></div>
        </div>
      </div>
    </div>

    {/* APR Card */}
    <div className="bg-gray-800 p-4 rounded-xl border border-orange-600/20 flex flex-col justify-center items-start">
      <div className="text-xs text-gray-400">APR (Protocol)</div>
      <div className="text-2xl font-bold text-orange-300">
        24.09% <span className="text-sm text-gray-400">(if staked for 365 days)</span>
      </div>

      <div className="mt-3 text-xs text-gray-400 leading-relaxed">
        Daily APR: <span className="text-orange-300 font-medium">0.03%</span><br />
        Monthly Bonus: <span className="text-orange-300 font-medium">+0.003%</span> if staked ≥ 30 days<br />
        Total Yearly ≈ <span className="text-orange-300 font-medium">24.09%</span>
      </div>

      {/* Since You Staked */}
      <div className="mt-4 text-xs text-gray-300">
        Since You Staked: <span className="text-orange-300 font-bold">{stakedDuration}</span>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        *Rewards update when user interacts*
      </div>
    </div>
  </div>
</section>



        {/* tx / debug panel */}
        <section className="mb-6">
          <div className="bg-gray-900 p-4 rounded-xl text-xs text-gray-400">
            <div>Connected: <span className="text-white font-medium">{isConnected ? 'Yes' : 'No'}</span></div>
            <div>Wallet: <span className="text-white font-mono">{address ? shortAddr(address) : '—'}</span></div>
            <div>Token decimals: <span className="text-orange-300">{tokenDecimals}</span></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-800 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">
          © 2019-Present AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
        </div>
      </footer>
    </div>
  );
}
