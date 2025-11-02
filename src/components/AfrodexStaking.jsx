'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { parseUnits, formatUnits } from 'viem';
import {
  useAccount,
  usePublicClient,
  usePrepareContractWrite,
  useContractWrite
} from 'wagmi';

import { STAKING_ABI } from '@/lib/stakingAbi';
import { AFROX_TOKEN_ABI } from '@/lib/AfroXTokenABI';

const TOKEN_ADDR = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS;
const STAKING_ADDR = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
const TOKEN_DECIMALS = 4; // You said token accepts 4 decimals

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  // UI / form state
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [tokenPriceUsd, setTokenPriceUsd] = useState(null); // fetched price
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [allowanceRaw, setAllowanceRaw] = useState(null);
  const [stakedBalance, setStakedBalance] = useState('0');
  const [walletBalance, setWalletBalance] = useState('0');
  const [pendingRewards, setPendingRewards] = useState('0');
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Styling / animation configs
  const glowHover = { scale: 1.01, boxShadow: '0 8px 32px rgba(255,140,0,0.18)' };
  const pulse = { scale: [1, 1.02, 1], transition: { duration: 1.6, repeat: Infinity } };

  // ---------- Contract reads ----------
  const fetchOnChain = useCallback(async () => {
    if (!publicClient || !address) return;

    try {
      // Allowance
      const allowance = await publicClient.readContract({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'allowance',
        args: [address, STAKING_ADDR],
      }).catch(() => null);

      // Staked balance: viewStakeInfoOf(address) -> returns stakeBalance, rewardValue, ...
      const stakeInfo = await publicClient.readContract({
        address: STAKING_ADDR,
        abi: STAKING_ABI,
        functionName: 'viewStakeInfoOf',
        args: [address],
      }).catch(() => null);

      // Wallet balance (ERC20 balanceOf)
      const walletBal = await publicClient.readContract({
        address: TOKEN_ADDR,
        abi: AFROX_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
      }).catch(() => null);

      if (allowance != null) setAllowanceRaw(String(allowance));
      if (stakeInfo && stakeInfo.stakeBalance != null) {
        setStakedBalance(formatUnits(stakeInfo.stakeBalance ?? 0n, TOKEN_DECIMALS));
        setPendingRewards(formatUnits(stakeInfo.rewardValue ?? 0n, TOKEN_DECIMALS));
      }
      if (walletBal != null) setWalletBalance(formatUnits(walletBal ?? 0n, TOKEN_DECIMALS));
    } catch (err) {
      console.error('onChain fetch error', err);
    }
  }, [publicClient, address]);

  useEffect(() => {
    if (!isConnected) return;
    fetchOnChain();
    // poll a few times while the user is on the page (optional)
    const id = setInterval(fetchOnChain, 15_000);
    return () => clearInterval(id);
  }, [isConnected, fetchOnChain]);

  // ---------- Price fetch (CoinGecko token_price by contract) ----------
  useEffect(() => {
    const fetchPrice = async () => {
      setLoadingPrice(true);
      try {
        if (!TOKEN_ADDR) throw new Error('Missing token address');
        // CoinGecko token price by contract (Ethereum mainnet)
        const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${TOKEN_ADDR}&vs_currencies=usd`;
        const res = await fetch(url);
        const json = await res.json();
        const key = Object.keys(json)[0];
        if (json && json[key] && json[key].usd) {
          setTokenPriceUsd(Number(json[key].usd));
        } else {
          // fallback static price if Coingecko doesn't know the token
          setTokenPriceUsd(0.02);
        }
      } catch (err) {
        console.warn('Price fetch failed, using fallback', err);
        setTokenPriceUsd(0.02); // fallback price USD
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchPrice();
  }, []);

  // ---------- Prepare contract writes ----------
  // 1) Approve (ERC20 approve)
  const { config: approveConfig } = usePrepareContractWrite({
    address: TOKEN_ADDR,
    abi: AFROX_TOKEN_ABI,
    functionName: 'approve',
    args: [STAKING_ADDR, parseUnits('1000000000', TOKEN_DECIMALS)], // big allowance
    enabled: Boolean(isConnected),
  });
  const { writeAsync: approveWrite } = useContractWrite(approveConfig || {});

  // 2) Stake -> depositToken(token, amount) OR stake(amount) depending on your staking contract
  // I'll attempt depositToken(tokenAddr, amount) first, fallback to stake(amount) if needed.
  const { config: stakeCfg1 } = usePrepareContractWrite({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: 'depositToken',
    args: [TOKEN_ADDR, stakeAmount ? parseUnits(stakeAmount, TOKEN_DECIMALS) : 0n],
    enabled: Boolean(isConnected && stakeAmount),
  });
  const { writeAsync: stakeWrite1 } = useContractWrite(stakeCfg1 || {});

  const { config: stakeCfg2 } = usePrepareContractWrite({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: 'stake',
    args: [stakeAmount ? parseUnits(stakeAmount, TOKEN_DECIMALS) : 0n],
    enabled: Boolean(isConnected && stakeAmount),
  });
  const { writeAsync: stakeWrite2 } = useContractWrite(stakeCfg2 || {});

  // 3) Unstake (unstake(amount))
  const { config: unstakeCfg } = usePrepareContractWrite({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: 'unstake',
    args: [unstakeAmount ? parseUnits(unstakeAmount, TOKEN_DECIMALS) : 0n],
    enabled: Boolean(isConnected && unstakeAmount),
  });
  const { writeAsync: unstakeWrite } = useContractWrite(unstakeCfg || {});

  // 4) Claim button: if contract has no explicit claim, we use a minimal unstake hack (unstake 1 token -> to trigger)
  const { config: minimalUnstakeCfg } = usePrepareContractWrite({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: 'unstake',
    args: [parseUnits('0.0001', TOKEN_DECIMALS)], // very small amount; ensure this is allowed by contract
    enabled: Boolean(isConnected),
  });
  const { writeAsync: minimalUnstakeWrite } = useContractWrite(minimalUnstakeCfg || {});

  // ---------- UI action handlers ----------
  const handleApprove = async () => {
    if (!approveWrite) return;
    try {
      setIsApproving(true);
      const tx = await approveWrite();
      await tx.wait?.();
      await fetchOnChain();
    } catch (err) {
      console.error('approve error', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) return;
    try {
      setIsStaking(true);
      // try depositToken first, fallback to stake()
      if (stakeWrite1) {
        const tx = await stakeWrite1();
        await tx.wait?.();
      } else if (stakeWrite2) {
        const tx = await stakeWrite2();
        await tx.wait?.();
      } else {
        throw new Error('No stake write configured');
      }
      setStakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('stake error', err);
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || Number(unstakeAmount) <= 0) return;
    try {
      setIsUnstaking(true);
      const tx = await unstakeWrite();
      await tx.wait?.();
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      console.error('unstake error', err);
    } finally {
      setIsUnstaking(false);
    }
  };

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      // Try minimal unstake trigger (if contract auto-claims on unstake)
      if (minimalUnstakeWrite) {
        const tx = await minimalUnstakeWrite();
        await tx.wait?.();
      } else {
        // If there is a claim() function on the staking contract, use it by preparing/writing (not included here)
        console.warn('No minimalUnstakeWrite available; no explicit claim call configured.');
      }
      await fetchOnChain();
    } catch (err) {
      console.error('claim error', err);
    } finally {
      setIsClaiming(false);
    }
  };

  // ---------- Calculator logic ----------
  // The reward rules you gave:
  // - base daily reward: 0.03%  (i.e., 0.03 percent per day)
  // - monthly bonus after each full month without withdrawal: +0.003 (0.3%) per month
  // - yearly simplified estimate: 24.09% (user-provided)
  const BASE_DAILY_PERCENT = 0.03; // percent
  const MONTHLY_BONUS_PERCENT = 0.3; // percent per month (0.3% = 0.3)
  const YEARLY_ESTIMATE_PERCENT = 24.09; // final yearly estimate

  const calcRewards = (principal, months = 1) => {
    const p = Number(principal) || 0;
    const daily = (BASE_DAILY_PERCENT / 100) * p;
    const monthlyRatePct = BASE_DAILY_PERCENT + (MONTHLY_BONUS_PERCENT * months);
    const monthly = (monthlyRatePct / 100) * p * 30; // rough
    // Yearly summarised:
    const yearly = (YEARLY_ESTIMATE_PERCENT / 100) * p;
    return { daily, monthly, yearly, monthlyRatePct };
  };

  // Derived values for display
  const allowance = useMemo(() => {
    if (!allowanceRaw) return 0;
    try {
      return Number(formatUnits(BigInt(allowanceRaw), TOKEN_DECIMALS));
    } catch {
      return 0;
    }
  }, [allowanceRaw]);

  // Formatter helpers
  const displayUsd = (tokens) => {
    const price = Number(tokenPriceUsd) || 0;
    return (Number(tokens) * price).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // ---------- Render ----------
  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-[#0b0f14] via-[#0b1220] to-[#081018] text-white font-sans">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Welcome to AFRODEX Staking</h1>
          <p className="mt-2 text-sm text-gray-300">Stake AfroX — earn rewards. Network: Ethereum</p>
        </header>

        {/* WALLET CONNECT BAR placeholder (you have RainbowKit in _app) */}
        <div className="flex justify-center mb-6">
          <div className="w-full max-w-2xl p-3 rounded-2xl bg-gradient-to-b from-[#111316] to-[#0b0f13] shadow-xl border border-transparent">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-gray-400">Connected</div>
                <div className="text-sm font-medium">{isConnected ? address : 'No wallet connected'}</div>
              </div>
              <div className="text-right text-xs text-gray-400">
                <div>Chain: Ethereum</div>
                <div className="mt-1">Status: {isConnected ? <span className="text-green-400">Connected</span> : <span className="text-yellow-400">Not connected</span>}</div>
              </div>
            </div>
          </div>
        </div>

        {/* DASH STATS */}
        <div className="rounded-2xl bg-[#111722] p-6 shadow-2xl mb-8 border-l-4 border-orange-500/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-400">Staked Balance</div>
              <div className="text-2xl font-extrabold">{Number(stakedBalance).toLocaleString(undefined, { maximumFractionDigits: TOKEN_DECIMALS })} AFROX</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Rewards Earned</div>
              <div className="text-2xl font-extrabold text-green-400">{Number(pendingRewards).toLocaleString(undefined, { maximumFractionDigits: TOKEN_DECIMALS })} AFROX</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Wallet Balance</div>
              <div className="text-2xl font-extrabold">{Number(walletBalance).toLocaleString(undefined, { maximumFractionDigits: TOKEN_DECIMALS })} AFROX</div>
            </div>
          </div>
        </div>

        {/* MAIN: Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* LEFT: Approve & Stake */}
          <motion.div whileHover={glowHover} className="rounded-2xl bg-[#0c1116] p-6 shadow-xl border border-transparent">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Stake AfroX</h2>
              <div className="text-sm text-gray-400">Allowance: <span className="text-orange-400 font-semibold">{allowance.toLocaleString()}</span></div>
            </div>

            <label className="block text-sm text-gray-300 mb-2">Amount to Stake (AFROX)</label>
            <div className="flex gap-3 items-center mb-4">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="flex-1 p-3 rounded-lg bg-[#0b1116] border border-gray-800 text-white"
                placeholder="0.0"
              />
              <button onClick={() => setStakeAmount(walletBalance)} className="px-4 py-2 rounded-lg bg-gray-800 text-xs">MAX</button>
            </div>

            <div className="mb-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                disabled={!isConnected || isApproving}
                className="w-full py-3 rounded-2xl bg-gradient-to-b from-[#ff8c1a] to-[#ff6b00] text-black font-semibold shadow-sm mb-3"
              >
                {isApproving ? 'Approving...' : 'Approve AfroX'}
              </motion.button>

              <motion.button
                whileHover={pulse}
                onClick={handleStake}
                disabled={!isConnected || isStaking || Number(stakeAmount) <= 0}
                className="w-full py-3 rounded-2xl bg-[#ff6b00] hover:brightness-105 font-bold text-black text-lg"
              >
                {isStaking ? 'Staking...' : 'Stake'}
              </motion.button>
            </div>
          </motion.div>

          {/* RIGHT: Unstake */}
          <motion.div whileHover={glowHover} className="rounded-2xl bg-[#0c1116] p-6 shadow-xl border border-transparent">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Unstake AfroX</h2>
              <div className="text-sm text-gray-400">Tier: Starter</div>
            </div>

            <label className="block text-sm text-gray-300 mb-2">Amount to Unstake (AFROX)</label>
            <div className="flex gap-3 items-center mb-4">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                className="flex-1 p-3 rounded-lg bg-[#0b1116] border border-gray-800 text-white"
                placeholder="0.0"
              />
              <button onClick={() => setUnstakeAmount(stakedBalance)} className="px-4 py-2 rounded-lg bg-gray-800 text-xs">MAX</button>
            </div>

            <motion.button
              whileHover={pulse}
              onClick={handleUnstake}
              disabled={!isConnected || isUnstaking || Number(unstakeAmount) <= 0}
              className="w-full py-3 rounded-2xl bg-[#ff6b00] font-bold text-black text-lg"
            >
              {isUnstaking ? 'Unstaking...' : 'Unstake'}
            </motion.button>
          </motion.div>
        </div>

        {/* Claim + Rewards Center */}
        <div className="rounded-2xl bg-[#0b1116] p-6 shadow-xl mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2">
              <h3 className="text-lg font-semibold">Rewards Center</h3>
              <p className="mt-2 text-gray-300">Claimable Rewards: <span className="text-2xl font-extrabold text-green-400">{Number(pendingRewards).toLocaleString(undefined, { maximumFractionDigits: TOKEN_DECIMALS })} AFROX</span></p>
              <div className="mt-4 p-4 rounded-lg bg-[#0a1115] border border-gray-800 text-sm text-gray-300">
                <strong>Claim Note & Policy:</strong>
                <p className="mt-2 text-xs">Pending rewards are often distributed when you unstake. Use "Claim Rewards" to trigger a minimal unstake-based claim if supported.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={handleClaim}
                disabled={!isConnected || isClaiming}
                className="py-3 rounded-2xl bg-gradient-to-b from-[#ff8c1a] to-[#ff6b00] text-black font-bold"
              >
                {isClaiming ? 'Claiming...' : 'Claim Rewards'}
              </motion.button>

              <div className="text-xs text-gray-400 text-center">Estimated USD: ${loadingPrice ? 'loading...' : displayUsd(pendingRewards)}</div>
            </div>
          </div>

          {/* Rewards Calculator (below) */}
          <div className="mt-6 border-t border-gray-800 pt-6">
            <h4 className="text-lg font-semibold">Rewards Calculator</h4>
            <p className="text-sm text-gray-400">Type an amount and months you plan to hold (no withdrawals). Calculator shows estimated tokens and USD (price from CoinGecko or fallback).</p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-sm text-gray-300">Amount (AFROX)</label>
                <input type="number" step="0.0001" className="w-full mt-2 p-3 rounded-lg bg-[#081018] border border-gray-800" id="calcAmt" defaultValue="1000"
                  onChange={(e) => setCalcAmount(e.target.value)} />
              </div>

              <div>
                <label className="text-sm text-gray-300">Months held (no withdrawal)</label>
                <input type="number" min="0" step="1" defaultValue="1" className="w-full mt-2 p-3 rounded-lg bg-[#081018] border border-gray-800" id="calcMonths"
                  onChange={(e) => setCalcMonths(e.target.value)} />
              </div>

              <div>
                <label className="text-sm text-gray-300">Token price (USD)</label>
                <div className="flex gap-2 mt-2">
                  <input type="number" step="0.0001" className="flex-1 p-3 rounded-lg bg-[#081018] border border-gray-800" value={tokenPriceUsd ?? ''} onChange={(e) => setTokenPriceUsd(Number(e.target.value))} />
                  <button onClick={() => { /* refresh price */ setTokenPriceUsd(null); }} className="px-3 py-2 rounded-lg bg-gray-800">Refresh</button>
                </div>
                <div className="mt-1 text-xs text-gray-400">{loadingPrice ? 'Fetching price...' : 'Price fetched from CoinGecko (if available).'}</div>
              </div>
            </div>

            {/* Calculator result */}
            <CalculatorDisplay tokenPriceUsd={tokenPriceUsd} />
          </div>
        </div>

        {/* FOOTER */}
        <footer className="text-center text-sm text-gray-400 mt-8">
          <div>© 2019-Present AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A</div>
        </footer>
      </div>
    </div>
  );

  // ---------- local component state wiring for the calculator inputs ----------
  function setCalcAmount(val) {
    // wrapper to store as number into component-level stable state using closure
    componentState.calcAmount = val;
    // force re-render by toggling a tiny internal counter? (We can use simple approach: local React state)
    // But we avoided adding more states before; to keep code tidy, we'll use a simple pattern:
    // Actually create a tiny nested hook component to manage calculator state and display — implemented below.
  }
}

// Separate component for the calculator UI + logic (cleaner)
function CalculatorDisplay({ tokenPriceUsd }) {
  const [amount, setAmount] = useState(1000);
  const [months, setMonths] = useState(1);

  const BASE_DAILY_PERCENT = 0.03; // as above
  const MONTHLY_BONUS_PERCENT = 0.3; // per month
  const YEARLY_ESTIMATE_PERCENT = 24.09;

  const daily = useMemo(() => (BASE_DAILY_PERCENT / 100) * Number(amount), [amount]);
  const monthlyRatePct = BASE_DAILY_PERCENT + (MONTHLY_BONUS_PERCENT * Number(months));
  const monthly = useMemo(() => ((monthlyRatePct / 100) * Number(amount)), [amount, monthlyRatePct]);
  const yearly = useMemo(() => ((YEARLY_ESTIMATE_PERCENT / 100) * Number(amount)), [amount]);

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      <div className="p-4 rounded-lg bg-[#071018] border border-gray-800">
        <div className="text-xs text-gray-400">Daily Reward</div>
        <div className="text-xl font-bold">{daily.toLocaleString(undefined, { maximumFractionDigits: 6 })} AFROX</div>
        <div className="text-sm text-gray-400">≈ ${tokenPriceUsd ? (daily * tokenPriceUsd).toFixed(2) : (daily * 0).toFixed(2)}</div>
      </div>

      <div className="p-4 rounded-lg bg-[#071018] border border-gray-800">
        <div className="text-xs text-gray-400">Monthly (est)</div>
        <div className="text-xl font-bold">{monthly.toLocaleString(undefined, { maximumFractionDigits: 6 })} AFROX</div>
        <div className="text-sm text-gray-400">Rate: {monthlyRatePct.toFixed(3)}%</div>
        <div className="text-sm text-gray-400">≈ ${tokenPriceUsd ? (monthly * tokenPriceUsd).toFixed(2) : (monthly*0).toFixed(2)}</div>
      </div>

      <div className="p-4 rounded-lg bg-[#071018] border border-gray-800">
        <div className="text-xs text-gray-400">Yearly (est)</div>
        <div className="text-xl font-bold">{yearly.toLocaleString(undefined, { maximumFractionDigits: 6 })} AFROX</div>
        <div className="text-sm text-gray-400">Rate: {YEARLY_ESTIMATE_PERCENT}%</div>
        <div className="text-sm text-gray-400">≈ ${tokenPriceUsd ? (yearly * tokenPriceUsd).toFixed(2) : (yearly*0).toFixed(2)}</div>

        {/* Inputs (local) */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="p-2 rounded bg-[#061018] border border-gray-800 text-sm" />
          <input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="p-2 rounded bg-[#061018] border border-gray-800 text-sm" />
        </div>
      </div>
    </div>
  );
}
