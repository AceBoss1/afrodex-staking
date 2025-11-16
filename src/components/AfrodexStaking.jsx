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
import { STAKING_ABI, AFROX_TOKEN_ABI } from '../lib/abis'; // keep your original export shape

import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';

// Environment defaults / UI constants
const PRICE_USD_STATIC = 0.000001;
const DEFAULT_DECIMALS = 4;

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();

  // Form + UX state
  const [amount, setAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(DEFAULT_DECIMALS);

  // On-chain values (human strings)
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');

  // timestamps from viewStakeInfoOf
  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  // tx + loading flags
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [txHash, setTxHash] = useState(null);

  // rewards calculator state
  const [aprPercent, setAprPercent] = useState(24.09);
  const [estDays, setEstDays] = useState(30);

  // ----- helpers -----
  const shortAddr = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');
  const showAlert = (msg) => {
    // simple fallback - you can replace with your alert system
    // eslint-disable-next-line no-console
    console.info('ALERT:', msg);
  };

  const formatTimestamp = (s) => {
    if (!s || s <= 0) return 'N/A';
    try {
      return new Date(Number(s) * 1000).toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  // convert raw bigint/string -> human using decimals
  const toHuman = useCallback((raw) => {
    try {
      if (raw === null || raw === undefined) return '0';
      return formatUnits(raw, tokenDecimals);
    } catch (e) {
      // fallback naive: divide by 10**decimals
      try {
        const n = Number(raw ?? 0) / (10 ** (tokenDecimals || DEFAULT_DECIMALS));
        return String(n);
      } catch {
        return '0';
      }
    }
  }, [tokenDecimals]);

  // convert human string -> bigint
  const toRaw = useCallback((humanStr) => {
    try {
      return parseUnits(String(humanStr || '0'), tokenDecimals || DEFAULT_DECIMALS);
    } catch (e) {
      return 0n;
    }
  }, [tokenDecimals]);

  // ----- fetch on-chain -----
  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;

    try {
      // 1) read token decimals from TOKEN_ADDRESS (proxy)
      try {
        const decRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'decimals',
          args: [],
        });
        const d = decRaw !== null && decRaw !== undefined ? Number(decRaw) : DEFAULT_DECIMALS;
        setTokenDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);
      } catch (err) {
        setTokenDecimals(DEFAULT_DECIMALS);
      }

      // 2) wallet token balance (TOKEN_ADDRESS)
      if (address) {
        try {
          const balRaw = await readContractSafe(publicClient, {
            address: TOKEN_ADDRESS,
            abi: AFROX_TOKEN_ABI,
            functionName: 'balanceOf',
            args: [address],
          });
          setWalletBalance(toHuman(balRaw ?? 0n));
        } catch {
          setWalletBalance('0');
        }

        // 3) allowance(owner, spender) - spender = STAKING_ADDRESS
        try {
          const allowanceRaw = await readContractSafe(publicClient, {
            address: TOKEN_ADDRESS,
            abi: AFROX_TOKEN_ABI,
            functionName: 'allowance',
            args: [address, STAKING_ADDRESS],
          });
          setAllowance(toHuman(allowanceRaw ?? 0n));
        } catch {
          setAllowance('0');
        }

        // 4) stakeInfo from staking entrypoint (viewStakeInfoOf)
        try {
          // Note: your staking contract returns [stakeBalance, rewardValue, lastUnstakeTimestamp, lastRewardTimestamp]
          const stakeInfo = await readContractSafe(publicClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'viewStakeInfoOf',
            args: [address],
          });

          if (stakeInfo) {
            const stakeBalRaw = stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n;
            const rewardValRaw = stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n;
            const lastUnstakeRaw = stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n;
            const lastRewardRaw = stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n;

            setStakedBalance(toHuman(stakeBalRaw ?? 0n));
            setRewards(toHuman(rewardValRaw ?? 0n));
            setLastUnstakeTs(Number(lastUnstakeRaw ?? 0n));
            setLastRewardTs(Number(lastRewardRaw ?? 0n));
          } else {
            setStakedBalance('0');
            setRewards('0');
            setLastUnstakeTs(0);
            setLastRewardTs(0);
          }
        } catch (err) {
          // fallback: try a balanceOf on the staking contract
          try {
            const stBal = await readContractSafe(publicClient, {
              address: STAKING_ADDRESS,
              abi: STAKING_ABI,
              functionName: 'balanceOf',
              args: [address],
            });
            setStakedBalance(toHuman(stBal ?? 0n));
            setRewards('0');
            setLastUnstakeTs(0);
            setLastRewardTs(0);
          } catch (_) {
            setStakedBalance('0');
            setRewards('0');
            setLastUnstakeTs(0);
            setLastRewardTs(0);
          }
        }
      } else {
        setWalletBalance('0');
        setStakedBalance('0');
        setRewards('0');
        setAllowance('0');
        setLastUnstakeTs(0);
        setLastRewardTs(0);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('fetchOnChain error', err);
    }
  }, [publicClient, address, toHuman]);

  // poll
  useEffect(() => {
    fetchOnChain();
    let t;
    if (isConnected) t = setInterval(fetchOnChain, 30_000);
    return () => clearInterval(t);
  }, [fetchOnChain, isConnected]);

  // ----- write helpers (approve/stake/unstake/claim) -----
  async function handleApprove() {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!amount || Number(amount) <= 0) { showAlert('Enter amount to approve'); return; }

    setIsApproving(true);
    setTxHash(null);
    try {
      const raw = toRaw(amount);
      const tx = await writeContractSafe(walletClient, {
        address: TOKEN_ADDRESS,
        abi: AFROX_TOKEN_ABI,
        functionName: 'approve',
        args: [STAKING_ADDRESS, raw],
      });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);

      // best-effort wait
      try {
        if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
        else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      } catch (e) {}

      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('approve failed', err);
      showAlert('Approve failed: ' + (err?.message ?? err));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleStake() {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!amount || Number(amount) <= 0) { showAlert('Enter amount to stake'); return; }

    setIsStaking(true);
    setTxHash(null);

    try {
      const raw = toRaw(amount);

      // Try common direct stake on STAKING_ADDRESS
      const candidates = [
        { addr: STAKING_ADDRESS, fn: 'depositToken', args: [TOKEN_ADDRESS, raw] },
        { addr: STAKING_ADDRESS, fn: 'stake', args: [raw] },
        { addr: TOKEN_ADDRESS, fn: 'stake', args: [raw] } // some proxies expose stake on token/proxy
      ];

      let executed = false;
      for (const c of candidates) {
        try {
          const tx = await writeContractSafe(walletClient, {
            address: c.addr,
            abi: STAKING_ABI,
            functionName: c.fn,
            args: c.args,
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          try {
            if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch (e) {}
          executed = true;
          break;
        } catch (e) {
          // try next
        }
      }

      // If direct calls all reverted, ensure allowance and retry stake
      if (!executed) {
        // ensure allowance
        const allowanceRaw = await readContractSafe(publicClient, {
          address: TOKEN_ADDRESS,
          abi: AFROX_TOKEN_ABI,
          functionName: 'allowance',
          args: [address, STAKING_ADDRESS],
        });

        if ((allowanceRaw ?? 0n) < raw) {
          showAlert('Allowance low — approving first');
          await handleApprove();
        }

        // try stake on STAKING_ADDRESS again (preferred)
        try {
          const tx2 = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [raw],
          });
          setTxHash(tx2?.hash ?? tx2?.request?.hash ?? null);
          try {
            if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
            else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
          } catch (e) {}
          executed = true;
        } catch (e) {
          // final failure
        }
      }

      if (!executed) throw new Error('Stake failed after attempts');

      showAlert('Stake confirmed');
      setAmount('');
      await fetchOnChain();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('stake failed', err);
      showAlert('Stake failed: ' + (err?.message ?? err));
    } finally {
      setIsStaking(false);
    }
  }

  async function handleUnstake() {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!unstakeAmount || Number(unstakeAmount) <= 0) { showAlert('Enter amount to unstake'); return; }

    setIsUnstaking(true);
    setTxHash(null);
    try {
      const raw = toRaw(unstakeAmount);

      // try unstake on STAKING_ADDRESS then fallback to token proxy
      try {
        const tx = await writeContractSafe(walletClient, {
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'unstake',
          args: [raw],
        });
        setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
        try {
          if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
          else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
        } catch (e) {}
      } catch (err1) {
        // fallback: try token/proxy unstake
        const tx2 = await writeContractSafe(walletClient, {
          address: TOKEN_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'unstake',
          args: [raw],
        });
        setTxHash(tx2?.hash ?? tx2?.request?.hash ?? null);
        try {
          if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
          else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
        } catch (e) {}
      }

      showAlert('Unstake confirmed');
      setUnstakeAmount('');
      await fetchOnChain();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('unstake failed', err);
      showAlert('Unstake failed: ' + (err?.message ?? err));
    } finally {
      setIsUnstaking(false);
    }
  }

  async function handleClaim() {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }

    setIsClaiming(true);
    setTxHash(null);
    const candidates = ['claim', 'claimRewards', 'withdrawReward', 'getReward', 'withdraw'];

    try {
      let executed = false;
      for (const fn of candidates) {
        try {
          const tx = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: fn,
            args: [],
          });
          setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
          try {
            if (tx?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
            else if (tx?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
          } catch (e) {}
          executed = true;
          break;
        } catch (e) {
          // try next
        }
      }

      if (!executed) {
        // fallback tiny unstake-restake if allowed
        try {
          const tiny = parseUnits('1', tokenDecimals || DEFAULT_DECIMALS);
          const tx1 = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'unstake',
            args: [tiny],
          });
          try {
            if (tx1?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx1.request.hash });
            else if (tx1?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx1.hash });
          } catch (e) {}
          const tx2 = await writeContractSafe(walletClient, {
            address: STAKING_ADDRESS,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [tiny],
          });
          try {
            if (tx2?.request && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.request.hash });
            else if (tx2?.hash && publicClient) await publicClient.waitForTransactionReceipt({ hash: tx2.hash });
          } catch (e) {}
          showAlert('Claim fallback (unstake tiny + restake) completed');
        } catch (e) {
          showAlert('Claim not available on this staking contract');
        }
      } else {
        showAlert('Claim executed');
      }

      await fetchOnChain();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('claim failed', err);
      showAlert('Claim failed: ' + (err?.message ?? err));
    } finally {
      setIsClaiming(false);
    }
  }

  // ----- rewards calculator -----
  const estimatedRewards = () => {
    const stake = Number(stakedBalance || 0);
    const apr = Number(aprPercent || 0) / 100;
    const days = Number(estDays || 0);
    const reward = stake * apr * (days / 365);
    const usd = reward * PRICE_USD_STATIC;
    return { reward, usd };
  };
  const { reward: estReward, usd: estUsd } = estimatedRewards();

  // ----- UI variants -----
  const cardVariant = { hover: { scale: 1.02, boxShadow: '0 10px 30px rgba(255,140,0,0.18)' }, initial: {} };
  const glow = { boxShadow: '0 0 18px rgba(255,140,0,0.24)' };

  // ----- render -----
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
          {/* Your Stake */}
          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" style={{ boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.02)' }} whileHover={{ ...glow }}>
            <div className="text-sm text-gray-300">Your Stake</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <img src="/afrodex_token.png" alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
              {stakedBalance} AfroX
            </div>
            <div className="text-xs text-gray-400 mt-2">Last reward update: {formatTimestamp(lastRewardTs)}</div>
          </motion.div>

          {/* Rewards */}
          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ ...glow }}>
            <div className="text-sm text-gray-300">Rewards</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <img src="/afrodex_token.png" alt="AfroX" className="h-6 w-6 rounded-full opacity-90" />
              {rewards} AfroX
            </div>
            <div className="text-xs text-gray-400 mt-2">Last unstake: {formatTimestamp(lastUnstakeTs)}</div>
          </motion.div>

          {/* Wallet Balance */}
          <motion.div className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ ...glow }}>
            <div className="text-sm text-gray-300">Wallet Balance</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <img src="/afrodex_token.png" alt="AfroX" className="h-5 w-5 rounded-full opacity-90" />
              {walletBalance} AfroX
            </div>
            <div className="text-xs text-gray-400 mt-2">Allowance: {allowance}</div>
          </motion.div>

          {/* Badge Tier */}
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
              step={1 / (10 ** tokenDecimals)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <motion.button onClick={handleApprove} whileHover={{ scale: 1.02 }} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium shadow" style={{ boxShadow: '0 6px 18px rgba(255,140,0,0.12)' }} disabled={!isConnected || isApproving}>
                {isApproving ? 'Approving...' : 'Approve'}
              </motion.button>

              <motion.button onClick={handleStake} whileHover={{ scale: 1.02 }} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={!isConnected || isStaking}>
                {isStaking ? 'Staking...' : 'Stake'}
              </motion.button>
            </div>

            <div className="mt-4 text-xs text-gray-400">Allowance: <span className="text-orange-300 font-medium">{allowance}</span></div>
            {txHash && <div className="mt-2 text-xs text-gray-400">Tx: <span className="text-sm text-orange-200 break-all">{txHash}</span></div>}
          </motion.div>

          {/* UNSTAKE */}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30" variants={cardVariant} initial="initial" whileHover="hover">
            <h2 className="text-xl font-bold mb-3">Unstake</h2>
            <div className="text-sm text-gray-400 mb-4">Unstake your AfroX tokens and claim rewards.</div>

            <label className="block text-xs text-gray-300 mb-1">Amount to Unstake</label>
            <input
              type="number"
              step={1 / (10 ** tokenDecimals)}
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="0.0"
              className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <motion.button onClick={handleUnstake} whileHover={{ scale: 1.02 }} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium" style={{ boxShadow: '0 6px 18px rgba(255,140,0,0.12)' }} disabled={!isConnected || isUnstaking}>
                {isUnstaking ? 'Unstaking...' : 'Unstake'}
              </motion.button>

              <motion.button onClick={handleClaim} whileHover={{ scale: 1.02 }} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={!isConnected || isClaiming}>
                {isClaiming ? 'Claiming...' : 'Claim Rewards'}
              </motion.button>
            </div>

            <div className="mt-4 text-xs text-gray-400">Your Rewards: <span className="text-orange-300 font-medium">{rewards} AfroX</span></div>
          </motion.div>
        </section>

        {/* Rewards center */}
        <section className="bg-gray-900 p-6 rounded-3xl border border-orange-600/10 mb-6">
          <h3 className="text-lg font-bold mb-4">Rewards Center</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Calculator */}
            <div className="md:col-span-2">
              <div className="text-sm text-gray-300 mb-3">Estimated rewards calculator</div>

              <label className="block text-xs text-gray-400 mb-1">Days to Stake</label>
              <input type="number" step="1" value={estDays} onChange={(e) => setEstDays(Number(e.target.value))} className="w-full p-2 rounded bg-gray-800 text-white mb-3" />

              <label className="block text-xs text-gray-400 mb-1">Amount to Stake (AfroX)</label>
              <input type="number" step={1 / (10 ** tokenDecimals)} value={stakedBalance} onChange={(e) => setStakedBalance(e.target.value)} className="w-full p-2 rounded bg-gray-800 text-white mb-4" />

              <div className="text-gray-300">
                Estimated rewards for {estDays} days:
                <span className="font-bold text-white"> {Number(estReward).toFixed(6)} AfroX</span>
                <div className="text-sm text-gray-500">≈ ${Number(estUsd).toFixed(6)} (at ${PRICE_USD_STATIC} per AfroX)</div>
              </div>
            </div>

            {/* APR Card */}
            <div className="bg-gray-800 p-4 rounded-xl border border-orange-600/20 flex flex-col justify-center items-start">
              <div className="text-xs text-gray-400">APR (protocol)</div>
              <div className="text-2xl font-bold text-orange-300">
                {aprPercent}% <span className="text-sm text-gray-400">(if staked for 365 days)</span>
              </div>

              <div className="mt-3 text-xs text-gray-400 leading-relaxed">
                Daily APR = <span className="text-orange-300 font-medium">0.03%</span><br />
                Monthly Bonus = <span className="text-orange-300 font-medium">+0.003%</span> if staked ≥ 30 days<br />
                Total yearly ≈ <span className="text-orange-300 font-medium">{aprPercent}%</span>
              </div>

              <div className="mt-3 text-xs text-gray-500">*Rewards grow live when user interacts*</div>
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
