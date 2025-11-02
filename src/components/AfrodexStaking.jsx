// src/components/AfrodexStaking.jsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatUnits, parseUnits } from 'viem';
import { AFROX_TOKEN_ABI } from '../lib/AfroXTokenABI';
import { STAKING_ABI } from '../lib/StakingABI';


/**
 * UI / Theme choices:
 * - Carbon-fiber style panels with orange grid accents (user chose 3)
 * - Token label: "AfroX"
 *
 * Notes:
 * - Token uses 4 decimals (DECIMALS = 4)
 * - Reads are done with publicClient.readContract
 * - Writes are done with walletClient.writeContract (user wallet must be connected)
 *
 * Drop this file into src/components and import from pages/index.js
 */

const STAKING_ADDR = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
const TOKEN_ADDR = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS;
const DECIMALS = 4;
const TOKEN_LABEL = 'AfroX';

function nf(value, opts = {}) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: opts.decimals ?? 4 });
}

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();

  // UI state
  const [stakeInput, setStakeInput] = useState('');
  const [unstakeInput, setUnstakeInput] = useState('');
  const [calcAmount, setCalcAmount] = useState('');
  const [txHistory, setTxHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  // On-chain state
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewardsEarned, setRewardsEarned] = useState('0');
  const [walletBalance, setWalletBalance] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [rewardRate, setRewardRate] = useState(0);
  const [bonusRate, setBonusRate] = useState(0);

  // Tier thresholds (token base units)
  const TIERS = useMemo(() => ({
    Starter: parseUnits('0', DECIMALS),
    Bronze: parseUnits('10000000', DECIMALS),    // 10m
    Silver: parseUnits('100000000', DECIMALS),   // 100m
    Gold: parseUnits('1000000000', DECIMALS),    // 1b
    Diamond: parseUnits('10000000000', DECIMALS),// 10b
  }), []);

  // Helper: show temporary alerts
  const showAlert = (msg, timeout = 5000) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(null), timeout);
  };

  // === Read on-chain data ===
  const fetchOnChain = async () => {
    if (!publicClient) return;
    try {
      if (!STAKING_ADDR || !TOKEN_ADDR) return;

      // If user not connected, we still can read global values and walletBalance=0
      // Read stakeInfo for connected address (if connected)
      if (address) {
        // viewStakeInfoOf(address) returns (stakeBalance, rewardValue, lastUnstakeTimestamp, lastRewardTimestamp)
        const stakeInfo = await publicClient.readContract({
          address: STAKING_ADDR,
          abi: STAKING_ABI,
          functionName: 'viewStakeInfoOf',
          args: [address],
        }).catch(() => null);

        if (stakeInfo) {
          // stakeInfo: [stakeBalance, rewardValue, lastUnstakeTimestamp, lastRewardTimestamp]
          const stakeBalanceRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
          const rewardValueRaw = stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n;
          setStakedBalance(formatUnits(stakeBalanceRaw, DECIMALS));
          setRewardsEarned(formatUnits(rewardValueRaw, DECIMALS));
        } else {
          setStakedBalance('0');
          setRewardsEarned('0');
        }
      } else {
        setStakedBalance('0');
        setRewardsEarned('0');
      }

      // Wallet balance: token.balanceOf(address)
      const walletBalRaw = address ? await publicClient.readContract({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) : 0n;

      setWalletBalance(formatUnits(walletBalRaw ?? 0n, DECIMALS));

      // Allowance: token.allowance(address, staking)
      const allowRaw = address ? await publicClient.readContract({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'allowance',
        args: [address, STAKING_ADDR],
      }) : 0n;
      setAllowance(formatUnits(allowRaw ?? 0n, DECIMALS));

      // Read rewardRate and bonusRate from staking contract (if present)
      const rewardRateRaw = await publicClient.readContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'rewardRate',
      }).catch(() => null);

      const bonusRateRaw = await publicClient.readContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'bonusRate',
      }).catch(() => null);

      // Interpret values as decimals (if contract uses e.g., 4 decimals)
      // We convert to human numbers (not percent). Caller math (APR) uses the numeric values.
      setRewardRate(Number(rewardRateRaw ? formatUnits(rewardRateRaw, DECIMALS) : 0));
      setBonusRate(Number(bonusRateRaw ? formatUnits(bonusRateRaw, DECIMALS) : 0));
    } catch (err) {
      console.error('fetchOnChain error', err);
    }
  };

  // initial fetch + periodic refresh
  useEffect(() => {
    fetchOnChain();
    const t = setInterval(fetchOnChain, 15_000); // refresh every 15s
    return () => clearInterval(t);
  }, [publicClient, address]);

  // === APR calculation ===
  // Based on your formula:
  // APR = (rewardRate + bonusRate * 12) * 365  (treating rewardRate & bonusRate as % per day/month in decimal form)
  // If rewardRate=0.0003 (0.03%) daily, bonusRate=0.00003 (0.003%) monthly, this will match your example.
  const APR = useMemo(() => {
    const r = rewardRate || 0;
    const b = bonusRate || 0;
    const apr = (r + b * 12) * 365 * 100; // convert to percent
    return apr;
  }, [rewardRate, bonusRate]);

  // === helpers for writes ===
  const pushTx = (tx) => setTxHistory(prev => [{ time: new Date().toISOString(), tx }, ...prev].slice(0, 50));

  const approveMax = async () => {
    if (!walletClient || !isConnected) return showAlert('Connect wallet first.');
    try {
      setLoading(true);
      // Approve large number (e.g., 1 billion AfroX in base units) - use a safe "max" you prefer
      const amountToApprove = parseUnits('1000000000000', DECIMALS); // big
      const tx = await walletClient.writeContract({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'approve',
        args: [STAKING_ADDR, amountToApprove],
      });
      pushTx(tx);
      showAlert('Approval submitted');
      await publicClient.waitForTransactionReceipt({ hash: tx }); // wait for confirmation
      showAlert('Approval confirmed');
      await fetchOnChain();
    } catch (err) {
      console.error('approveMax err', err);
      showAlert(`Approve error: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!walletClient || !isConnected) return showAlert('Connect wallet first.');
    if (!stakeInput || Number(stakeInput) === 0) return showAlert('Enter an amount to stake.');
    try {
      setLoading(true);
      const amountWei = parseUnits(stakeInput, DECIMALS);
      // Ensure allowance >= amount
      const allowRaw = await publicClient.readContract({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'allowance',
        args: [address, STAKING_ADDR],
      });
      if (allowRaw < amountWei) {
        showAlert('Allowance too low — approving max first.');
        await approveMax();
      }

      // Call stake(uint256)
      const tx = await walletClient.writeContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [amountWei],
      });
      pushTx(tx);
      showAlert('Stake tx submitted');
      await publicClient.waitForTransactionReceipt({ hash: tx });
      showAlert('Stake confirmed');
      setStakeInput('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake err', err);
      // decode revert message if available
      const errMsg = err?.shortMessage ?? err?.message ?? String(err);
      showAlert(`Stake error: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!walletClient || !isConnected) return showAlert('Connect wallet first.');
    if (!unstakeInput || Number(unstakeInput) === 0) return showAlert('Enter an amount to unstake.');
    try {
      setLoading(true);
      const amountWei = parseUnits(unstakeInput, DECIMALS);
      const tx = await walletClient.writeContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [amountWei],
      });
      pushTx(tx);
      showAlert('Unstake submitted');
      await publicClient.waitForTransactionReceipt({ hash: tx });
      showAlert('Unstake confirmed');
      setUnstakeInput('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake err', err);
      showAlert(`Unstake error: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  };

  // Claim — implement minimal unstake hack: unstake tiny amount and re-stake it to trigger reward distribution
  const handleClaim = async () => {
    if (!walletClient || !isConnected) return showAlert('Connect wallet first.');
    try {
      setLoading(true);

      // Choose tiny unit = 1 token unit (1e-DECIMALS)
      const tiny = parseUnits('1', DECIMALS);
      // Check staked balance > tiny
      const stakeInfo = await publicClient.readContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'viewStakeInfoOf',
        args: [address],
      }).catch(() => null);

      const stakedRaw = stakeInfo ? (stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n) : 0n;
      if (stakedRaw < tiny) {
        // If not enough staked to unstake 1 unit, will try to unstake 0? Not possible -> fallback to show error
        showAlert('Too little staked to auto-claim. Consider manual small unstake to trigger claim.');
        setLoading(false);
        return;
      }

      // Unstake tiny unit (this should trigger reward distribution if contract implements that)
      const tx1 = await walletClient.writeContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [tiny],
      });
      pushTx(tx1);
      showAlert('Claim (unstake tiny) submitted');
      await publicClient.waitForTransactionReceipt({ hash: tx1 });

      // Re-stake tiny back to return user's stake
      const tx2 = await walletClient.writeContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [tiny],
      });
      pushTx(tx2);
      showAlert('Re-stake submitted');
      await publicClient.waitForTransactionReceipt({ hash: tx2 });

      showAlert('Claim sequence completed');
      await fetchOnChain();
    } catch (err) {
      console.error('claim err', err);
      showAlert(`Claim error: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculator result
  const estimatedYearlyReward = useMemo(() => {
    if (!calcAmount || Number(calcAmount) === 0) return null;
    // APR is percent, so divide by 100
    const yearReward = Number(calcAmount) * (Number(APR) / 100.0);
    return yearReward;
  }, [calcAmount, APR]);

  // tier label
  const tierLabel = useMemo(() => {
    const b = BigInt(Math.floor(Number(parseUnits(walletBalance || '0', DECIMALS))));
    // Determine highest tier
    if (b >= TIERS.Diamond) return 'Diamond';
    if (b >= TIERS.Gold) return 'Gold';
    if (b >= TIERS.Silver) return 'Silver';
    if (b >= TIERS.Bronze) return 'Bronze';
    return 'Starter';
  }, [walletBalance, TIERS]);

  // Small CSS helpers inline to match carbon-fiber + orange grid
  const pageStyle = {
    background:
      "radial-gradient(1200px 600px at 10% 10%, rgba(18,18,18,0.8), rgba(8,8,8,1)), linear-gradient(180deg,#0b0b0b,#080808)",
    minHeight: '100vh',
    color: 'white',
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue'",
  };

  const carbonCard =
    'rounded-2xl p-6 bg-[linear-gradient(90deg,#0b0b0b,rgba(7,7,7,0.8))] border border-[#1f1f1f] shadow-xl';

  const neonGrid = {
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,127,39,0.06) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(255,127,39,0.03) 0 3px, transparent 3px 7px)',
    boxShadow: '0 6px 30px rgba(255,127,39,0.06), inset 0 0 30px rgba(0,0,0,0.6)',
  };

  const neonButton =
    'py-3 px-4 font-semibold rounded-lg transition-all active:translate-y-0.5 shadow-[0_8px_0_rgba(255,127,39,0.14)]';

  return (
    <div style={pageStyle} className="p-6">
      <main className="max-w-3xl mx-auto">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ letterSpacing: '0.6px' }}>
              Welcome to Afrodex Staking
            </h1>
            <p className="text-sm text-gray-400">AfroX Staking Dashboard</p>
          </div>

          <div className="flex items-center space-x-4">
            <ConnectButton />
          </div>
        </header>

        {/* Stats card row */}
        <section className={`${carbonCard} mb-6`} style={neonGrid}>
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-300">Staked Balance</p>
              <p className="text-2xl font-bold">{nf(stakedBalance)} {TOKEN_LABEL}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Rewards Earned</p>
              <p className="text-2xl font-bold text-lime-400">{nf(rewardsEarned)} {TOKEN_LABEL}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300">Wallet Balance</p>
              <p className="text-2xl font-bold">{nf(walletBalance)} {TOKEN_LABEL}</p>
              <p className="mt-1 text-xs text-orange-300 font-semibold">BADGE Tier: {tierLabel}</p>
            </div>
          </div>
        </section>

        {/* APR & Calculator (full width) */}
        <section className={`${carbonCard} mb-6`} style={{ ...neonGrid }}>
          <h3 className="text-lg font-bold text-orange-300 mb-3">Estimated Rewards & APR</h3>

          <div className="grid grid-cols-3 gap-4 mb-4 text-center">
            <div>
              <p className="text-xs text-gray-400">Base Daily Rate</p>
              <p className="text-xl font-semibold text-white">{Number(rewardRate).toFixed(6)}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Monthly Bonus</p>
              <p className="text-xl font-semibold text-white">{Number(bonusRate).toFixed(6)}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400">Effective APR</p>
              <p className="text-xl font-bold text-orange-400">{APR.toFixed(2)}% / year</p>
            </div>
          </div>

          <div className="mt-2">
            <label className="text-xs text-gray-300">Estimate returns for amount ({TOKEN_LABEL})</label>
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                step="0.0001"
                className="flex-1 p-3 rounded bg-[#0b0b0b] border border-[#222]"
                placeholder="e.g., 10000"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
              />
              <button
                onClick={() => setCalcAmount(walletBalance || '')}
                className={`${neonButton} bg-[#111] border border-orange-600 text-orange-300`}
              >
                Use Max
              </button>
            </div>

            {estimatedYearlyReward !== null && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-300">Estimated yearly reward</p>
                <p className="text-xl font-bold text-orange-400">
                  {nf(estimatedYearlyReward, { decimals: 4 })} {TOKEN_LABEL}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Approve/Stake & Unstake row (2 columns) */}
        <section className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Approve & Stake (left) */}
          <div className={`${carbonCard}`} style={neonGrid}>
            <h3 className="text-lg font-bold text-orange-300 mb-3">Approve & Stake</h3>

            <div className="mb-3">
              <label className="text-sm text-gray-300">Amount to Stake ({TOKEN_LABEL})</label>
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  step="0.0001"
                  className="flex-1 p-3 rounded bg-[#0b0b0b] border border-[#222]"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                />
                <button
                  onClick={() => setStakeInput(walletBalance || '')}
                  className={`${neonButton} bg-[#111] border border-orange-600 text-orange-300`}
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={approveMax}
                disabled={loading}
                className={`${neonButton} bg-transparent border border-orange-500 text-orange-300 w-1/2`}
              >
                Approve
              </button>
              <button
                onClick={handleStake}
                disabled={loading}
                className={`${neonButton} bg-orange-500 hover:bg-orange-600 text-black w-1/2`}
              >
                Stake
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-400">Allowance: {allowance} {TOKEN_LABEL}</p>
          </div>

          {/* Unstake (right) */}
          <div className={`${carbonCard}`} style={neonGrid}>
            <h3 className="text-lg font-bold text-orange-300 mb-3">Unstake</h3>

            <label className="text-sm text-gray-300">Amount to Unstake ({TOKEN_LABEL})</label>
            <div className="flex gap-2 mt-2 mb-3">
              <input
                type="number"
                step="0.0001"
                className="flex-1 p-3 rounded bg-[#0b0b0b] border border-[#222]"
                value={unstakeInput}
                onChange={(e) => setUnstakeInput(e.target.value)}
              />
              <button
                onClick={() => setUnstakeInput(stakedBalance || '')}
                className={`${neonButton} bg-[#111] border border-orange-600 text-orange-300`}
              >
                MAX
              </button>
            </div>

            <button
              onClick={handleUnstake}
              disabled={loading}
              className={`${neonButton} bg-orange-500 hover:bg-orange-600 text-black w-full`}
            >
              Unstake
            </button>
          </div>
        </section>

        {/* Claim (full width) */}
        <section className={`${carbonCard} mb-6`} style={neonGrid}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-orange-300">Rewards Center</h3>
              <p className="text-sm text-gray-400">Claimable Rewards: <span className="font-bold text-lime-400">{rewardsEarned} {TOKEN_LABEL}</span></p>
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={handleClaim}
                disabled={loading}
                className={`${neonButton} bg-orange-500 hover:bg-orange-600 text-black`}
              >
                Claim Rewards
              </button>
            </div>
          </div>
        </section>

        {/* Transaction history & footer */}
        <section className="grid gap-4 mb-8">
          <div className={`${carbonCard} p-4`} style={neonGrid}>
            <h3 className="text-lg font-bold text-orange-300 mb-3">Transaction History</h3>
            {txHistory.length === 0 ? (
              <p className="text-sm text-gray-400">No recent transactions in this session.</p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-auto">
                {txHistory.map((t, i) => (
                  <li key={i} className="text-xs bg-[#070707]/30 p-2 rounded flex justify-between">
                    <div>
                      <div className="font-semibold text-white">{t.tx}</div>
                      <div className="text-gray-400">{new Date(t.time).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="text-center text-xs text-gray-400">
            © 2019-Present AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
          </footer>
        </section>

        {/* small alert */}
        {alertMsg && (
          <div className="fixed right-6 bottom-6 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg">
            {alertMsg}
          </div>
        )}
      </main>
    </div>
  );
}
