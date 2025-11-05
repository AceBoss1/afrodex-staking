'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

// Adjust path if you named the ABI files differently; user said abis.js earlier
import { STAKING_ABI, AFROX_TOKEN_ABI } from '../lib/abis'; // <-- ensure this file exports both ABIs

// Config / constants
const STAKING_ADDR = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
const TOKEN_ADDR = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS;

// Token has 4 decimals per your confirmation
const TOKEN_DECIMALS = 4;
const TOKEN_UNIT = BigInt(10 ** TOKEN_DECIMALS);

// UI defaults
const DEFAULT_APR = 0.2409; // 24.09% per your formula
const STATIC_PRICE_USD = 0.000001; // static token price until CoinGecko indexing

// utility: check if ABI has function
function hasAbiFn(abi, name) {
  return Array.isArray(abi) && abi.some((item) => item.name === name && item.type === 'function');
}

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();   // read-only, uses wagmi config
  const walletClient = useWalletClient();   // will be undefined when not connected
  const [amount, setAmount] = useState(''); // input in human decimals (e.g., "12.3456")
  const [status, setStatus] = useState({ kind: 'idle', msg: '' });
  const [allowance, setAllowance] = useState('0');
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [lastRewardTimestamp, setLastRewardTimestamp] = useState(0);
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // UI calculator states
  const [apr, setApr] = useState(DEFAULT_APR);
  const [estPeriodDays, setEstPeriodDays] = useState(30); // calculator days

  // fetch on-chain data: balances, allowance, stake info
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;
    try {
      if (!address) {
        setWalletBalance('0');
        setAllowance('0');
        setStakedBalance('0');
        setRewards('0');
        return;
      }

      // token.balanceOf
      const rawBal = await publicClient.readContract({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
      }).catch(() => 0n);

      // token.allowance(address, staking)
      let rawAllow = 0n;
      if (hasAbiFn(AFROX_TOKEN_ABI, 'allowance')) {
        rawAllow = await publicClient.readContract({
          address: TOKEN_ADDR,
          abi: AFROX_TOKEN_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDR],
        }).catch(() => 0n);
      }

      // staking.viewStakeInfoOf(address) => (stakeBalance, rewardValue, lastUnstakeTimestamp, lastRewardTimestamp)
      let stakeInfo;
      if (hasAbiFn(STAKING_ABI, 'viewStakeInfoOf')) {
        stakeInfo = await publicClient.readContract({
          address: STAKING_ADDR,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [address],
        }).catch(() => null);
      }

      setWalletBalance(formatUnits(rawBal ?? 0n, TOKEN_DECIMALS));
      setAllowance(formatUnits(rawAllow ?? 0n, TOKEN_DECIMALS));

      if (stakeInfo) {
        const [stakeBalanceRaw, rewardValueRaw, lastUnstake, lastReward] = stakeInfo;
        setStakedBalance(formatUnits(stakeBalanceRaw ?? 0n, TOKEN_DECIMALS));
        setRewards(formatUnits(rewardValueRaw ?? 0n, TOKEN_DECIMALS));
        setLastRewardTimestamp(Number(lastReward ?? 0n));
      } else {
        setStakedBalance('0');
        setRewards('0');
        setLastRewardTimestamp(0);
      }
    } catch (err) {
      console.error('fetchOnChain error', err);
      setStatus({ kind: 'error', msg: 'On-chain read failed' });
    }
  }, [publicClient, address]);

  // poll on connect and after actions
  useEffect(() => {
    fetchOnChain();
    // refresh every 20s while connected
    let t;
    if (isConnected) t = setInterval(fetchOnChain, 20_000);
    return () => clearInterval(t);
  }, [isConnected, fetchOnChain]);

  // formatting helpers
  const displayAmount = (v) => {
    if (v === undefined || v === null) return '0';
    try { return Number(v).toLocaleString(undefined, { maximumFractionDigits: TOKEN_DECIMALS }); }
    catch { return String(v); }
  };

  // helper: write to contract safely (walletClient required)
  async function writeContractSafe({ address, abi, functionName, args = [] }) {
    if (!walletClient) throw new Error('Wallet client not available. Connect wallet first.');
    // walletClient.writeContract expects arguments signature:
    // { address, abi, functionName, args, value? }
    return walletClient.writeContract({
      address,
      abi,
      functionName,
      args,
    });
  }

  // Approve
  async function handleApprove() {
    if (!amount || Number(amount) <= 0) { setStatus({ kind:'error', msg:'Enter amount to approve' }); return; }
    if (!walletClient) { setStatus({ kind:'error', msg:'Wallet not connected' }); return; }

    const amountScaled = parseUnits(amount, TOKEN_DECIMALS);
    if (!hasAbiFn(AFROX_TOKEN_ABI, 'approve')) {
      setStatus({ kind: 'error', msg: 'Token approve not available on ABI' });
      return;
    }

    try {
      setIsApproving(true);
      setStatus({ kind: 'pending', msg: 'Sending approve...' });
      const tx = await writeContractSafe({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'approve',
        args: [STAKING_ADDR, amountScaled],
      });
      setStatus({ kind: 'pending', msg: 'Approve submitted — waiting for confirmation...' });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus({ kind: 'success', msg: 'Approved successfully' });
      await fetchOnChain();
    } catch (err) {
      console.error('approve error', err);
      setStatus({ kind: 'error', msg: 'Approve failed' });
    } finally {
      setIsApproving(false);
    }
  }

  // Stake
  async function handleStake() {
    if (!amount || Number(amount) <= 0) { setStatus({ kind:'error', msg:'Enter amount to stake' }); return; }
    if (!walletClient) { setStatus({ kind:'error', msg:'Wallet not connected' }); return; }

    const amountScaled = parseUnits(amount, TOKEN_DECIMALS);
    // choose function: prefer 'stake', else 'depositToken' with (token, amount)
    try {
      setIsStaking(true);
      setStatus({ kind: 'pending', msg: 'Sending stake...' });

      if (hasAbiFn(STAKING_ABI, 'stake')) {
        const tx = await writeContractSafe({
          address: STAKING_ADDR,
          abi: STAKING_ABI,
          functionName: 'stake',
          args: [amountScaled],
        });
        setStatus({ kind: 'pending', msg: 'Stake tx submitted...' });
        await publicClient.waitForTransactionReceipt({ hash: tx });
      } else if (hasAbiFn(STAKING_ABI, 'depositToken')) {
        // depositToken(tokenAddress, amount)
        const tx = await writeContractSafe({
          address: STAKING_ADDR,
          abi: STAKING_ABI,
          functionName: 'depositToken',
          args: [TOKEN_ADDR, amountScaled],
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
      } else {
        throw new Error('No stake/deposit function found on staking contract');
      }

      setStatus({ kind: 'success', msg: 'Staked successfully' });
      setAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake error', err);
      const errMsg = err?.shortMessage || err?.message || 'Stake failed';
      setStatus({ kind: 'error', msg: errMsg });
    } finally {
      setIsStaking(false);
    }
  }

  // Unstake
  async function handleUnstake() {
    if (!amount || Number(amount) <= 0) { setStatus({ kind:'error', msg:'Enter amount to unstake' }); return; }
    if (!walletClient) { setStatus({ kind:'error', msg:'Wallet not connected' }); return; }
    const amountScaled = parseUnits(amount, TOKEN_DECIMALS);

    if (!hasAbiFn(STAKING_ABI, 'unstake')) {
      setStatus({ kind: 'error', msg: 'Unstake not available on contract' });
      return;
    }

    try {
      setIsUnstaking(true);
      setStatus({ kind: 'pending', msg: 'Sending unstake...' });
      const tx = await writeContractSafe({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [amountScaled],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus({ kind: 'success', msg: 'Unstaked successfully' });
      setAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake error', err);
      setStatus({ kind: 'error', msg: 'Unstake failed' });
    } finally {
      setIsUnstaking(false);
    }
  }

  // Claim rewards: attempt several possible function names safely
  async function handleClaim() {
    if (!walletClient) { setStatus({ kind:'error', msg:'Wallet not connected' }); return; }

    const possibleClaimFns = ['claim', 'withdrawReward', 'manualWithdrawToken', 'manualWithdrawEther', 'unstake'];
    const fn = possibleClaimFns.find((f) => hasAbiFn(STAKING_ABI, f));
    if (!fn) {
      setStatus({ kind: 'error', msg: 'No claim function available on contract' });
      return;
    }

    try {
      setIsClaiming(true);
      setStatus({ kind: 'pending', msg: `Calling ${fn}...` });

      // For 'unstake' if used as a claim fallback, we try to call with minimal value 1 (scaled).
      const args = (fn === 'unstake') ? [parseUnits('0.0001', TOKEN_DECIMALS)] : [];

      const tx = await writeContractSafe({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: fn,
        args,
      });

      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus({ kind: 'success', msg: 'Claim executed' });
      await fetchOnChain();
    } catch (err) {
      console.error('claim error', err);
      setStatus({ kind: 'error', msg: 'Claim failed' });
    } finally {
      setIsClaiming(false);
    }
  }

  // APR reward calc helper
  function calcEstimatedRewards(stakeHuman) {
    const principal = Number(stakeHuman || stakedBalance || 0);
    const aprDecimal = Number(apr || DEFAULT_APR);
    const days = Number(estPeriodDays || 30);
    // simple daily compounding approx: reward = principal * (apr/365) * days
    const rewardTokens = principal * (aprDecimal / 365) * days;
    const rewardUsd = rewardTokens * STATIC_PRICE_USD;
    return { rewardTokens, rewardUsd };
  }

  // compute tier
  function computeTierRaw(amountTokens) {
    const val = Number(amountTokens || 0);
    // thresholds: 10m, 100m, 1b, 10b
    if (val >= 10_000_000_000) return 'Legend';
    if (val >= 1_000_000_000) return 'Whale';
    if (val >= 100_000_000) return 'Gold';
    if (val >= 10_000_000) return 'Silver';
    if (val >= 1_000_000) return 'Bronze';
    return 'Starter';
  }

  // small status UI component
  const Status = ({ s }) => {
    if (!s || s.kind === 'idle') return null;
    const color = s.kind === 'error' ? 'text-red-400' : s.kind === 'success' ? 'text-green-300' : 'text-yellow-300';
    return <div className={`text-sm ${color} mt-2`}>{s.msg}</div>;
  };

  // small helper for button variants
  const btnBase = 'w-full py-3 rounded-2xl font-semibold text-white shadow-lg';
  const orange = 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700';

  // render
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <header className="flex flex-col items-center gap-3 mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Welcome to Afrodex Staking</h1>
          <p className="text-gray-400">Stake AfroX, earn rewards — Neon orange theme.</p>
          <div className="w-full mt-3 flex justify-center">
            {/* wallet connect slot - RainbowKit / ConnectButton will appear in _app via RainbowKit in header usually */}
            <div className="bg-gray-900 px-4 py-2 rounded-full border border-gray-800">
              <span className="text-sm text-gray-300">Connect Wallet</span>
            </div>
          </div>
        </header>

        {/* Dashboard title */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">AfroX Staking Dashboard</h2>
            <p className="text-gray-400">Stake AfroX token (4 decimals). Chain: Ethereum Mainnet</p>
          </div>
        </motion.div>

        {/* Analytics / badges row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="col-span-1 md:col-span-2 p-4 bg-gray-900 rounded-2xl shadow-glow border border-transparent">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Your Stake</div>
                <div className="text-2xl font-bold">{displayAmount(stakedBalance)} AfroX</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Rewards</div>
                <div className="text-2xl font-bold">{displayAmount(rewards)} AfroX</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Wallet Balance</div>
                <div className="text-lg">{displayAmount(walletBalance)} AfroX</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Badge Tier</div>
                <div className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-600 to-orange-400 text-black font-semibold">{computeTierRaw(stakedBalance)}</div>
              </div>
            </div>
          </div>

          {/* APR Card */}
          <div className="p-4 bg-gray-900 rounded-2xl shadow-glow border border-transparent">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">APR</div>
                <div className="text-2xl font-bold">{(apr * 100).toFixed(2)}%</div>
                <div className="text-xs text-gray-500">Est. based on reward rules</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Token $</div>
                <div className="text-lg font-semibold">${STATIC_PRICE_USD}</div>
              </div>
            </div>

            {/* Reward calculator */}
            <div className="mt-4">
              <div className="text-xs text-gray-400 mb-2">Estimate rewards</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={estPeriodDays} onChange={(e) => setEstPeriodDays(Number(e.target.value || 0))} className="p-2 rounded bg-gray-800 text-white" placeholder="Days" />
                <input type="number" step="0.0001" value={apr} onChange={(e) => setApr(Number(e.target.value || 0))} className="p-2 rounded bg-gray-800 text-white" placeholder="APR decimal (e.g. 0.24)" />
              </div>
              <div className="mt-3">
                <input type="number" step="0.0001" placeholder="Stake amount for calc" className="w-full p-2 rounded bg-gray-800 text-white" id="calcStake"/>
                <div className="mt-2 text-sm text-gray-300">
                  {/* compute with stakedBalance if calc input is empty */}
                  {(() => {
                    const el = document.getElementById('calcStake');
                    const stakeInput = el ? Number(el.value || stakedBalance) : Number(stakedBalance);
                    const { rewardTokens, rewardUsd } = calcEstimatedRewards(stakeInput || 0);
                    return (
                      <div>
                        Est. tokens ≈ <span className="font-semibold">{rewardTokens.toFixed(TOKEN_DECIMALS)}</span> AfroX • ≈ <span className="font-semibold">${rewardUsd.toFixed(6)}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Spacer for grid fill (on wide screens) */}
          <div className="hidden md:block"></div>
        </div>

        {/* Stake / Unstake two-column */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* APPROVE / STAKE */}
          <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-glow">
            <h3 className="text-lg font-bold mb-2">Approve & Stake</h3>
            <div className="text-sm text-gray-400 mb-4">Enter amount to approve and stake (4 decimals)</div>

            <input
              type="number"
              step={1 / (10 ** TOKEN_DECIMALS)}
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (e.g. 100.0000)"
              className="w-full p-3 rounded-xl bg-gray-800 text-white mb-3"
            />

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                disabled={!isConnected || isApproving}
                className={`${btnBase} ${orange} ${isApproving ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isApproving ? 'Approving...' : 'Approve'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStake}
                disabled={!isConnected || isStaking || Number(allowance) < Number(amount || 0)}
                className={`${btnBase} bg-indigo-600 hover:bg-indigo-700 ${isStaking ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isStaking ? 'Staking...' : 'Stake'}
              </motion.button>
            </div>

            <div className="mt-3 text-xs text-gray-400">
              Allowance: <span className="font-medium">{allowance}</span> AfroX
            </div>

            <Status s={status} />
          </div>

          {/* UNSTAKE */}
          <div className="p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-glow">
            <h3 className="text-lg font-bold mb-2">Unstake</h3>
            <div className="text-sm text-gray-400 mb-4">Withdraw tokens from the staking contract</div>

            <input
              type="number"
              step={1 / (10 ** TOKEN_DECIMALS)}
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount to unstake (e.g. 10.0000)"
              className="w-full p-3 rounded-xl bg-gray-800 text-white mb-3"
            />

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUnstake}
                disabled={!isConnected || isUnstaking}
                className={`${btnBase} bg-red-600 hover:bg-red-700 ${isUnstaking ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isUnstaking ? 'Unstaking...' : 'Unstake'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchOnChain}
                className={`${btnBase} bg-gray-700 hover:bg-gray-600`}
              >
                Refresh
              </motion.button>
            </div>

            <div className="mt-3 text-xs text-gray-400">Your staked: <span className="font-medium">{stakedBalance}</span> AfroX</div>
          </div>
        </div>

        {/* CLAIM section - full width */}
        <div className="mb-6 p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-glow">
          <h3 className="text-lg font-bold mb-2">Claim Rewards</h3>
          <div className="text-sm text-gray-400 mb-4">Claim accrued rewards. If the contract requires an action to update rewards, this will attempt a safe call.</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClaim}
              disabled={!isConnected || isClaiming}
              className={`${btnBase} ${orange} col-span-1 md:col-span-2 ${isClaiming ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {isClaiming ? 'Claiming...' : 'Claim Rewards'}
            </motion.button>

            <div className="p-3 rounded-xl bg-gray-800 flex flex-col justify-center">
              <div className="text-xs text-gray-400">Estimated next reward</div>
              <div className="text-lg font-semibold">{displayAmount(rewards)} AfroX</div>
              <div className="text-xs text-gray-500 mt-1">Last update: {lastRewardTimestamp ? new Date(lastRewardTimestamp * 1000).toLocaleString() : 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-400 mt-8 py-6">
          © 2019-Present AFRODEX. All rights reserved | <span aria-hidden>❤️</span> Donations: <code className="bg-gray-800 px-2 py-1 rounded">0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A</code>
        </footer>
      </div>
    </div>
  );
}
