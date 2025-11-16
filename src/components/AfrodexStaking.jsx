'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import ConnectHeader from './ConnectHeader';
import { STAKING_ABI } from '../lib/abis/stakingAbi';
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';

const DEFAULT_DECIMALS = 4;
const PRICE_USD_STATIC = 0.000001;
const TOKEN_LABEL = 'AfroX';
const TOKEN_LOGO = '/afrodex_token.png';

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();

  const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
  const [walletBalance, setWalletBalance] = useState('0');
  const [stakedBalance, setStakedBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [allowance, setAllowance] = useState('0');

  const [amount, setAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [rewardRate, setRewardRate] = useState(0);
  const [bonusRate, setBonusRate] = useState(0);
  const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
  const [lastRewardTs, setLastRewardTs] = useState(0);

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  const toHuman = useCallback((raw) => {
    try { return formatUnits(raw ?? 0n, decimals); } catch { return String(raw ?? '0'); }
  }, [decimals]);

  const toRaw = useCallback((human) => {
    try { return parseUnits(String(human || '0'), decimals); } catch { return 0n; }
  }, [decimals]);

  const shortAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '—';
  const showAlert = (m, t = 5000) => { setAlertMsg(String(m)); setTimeout(() => setAlertMsg(null), t); };

  const fetchOnChain = useCallback(async () => {
    if (!publicClient) return;
    try {
      const decimalsRaw = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: STAKING_ABI, functionName: 'decimals' });
      const d = decimalsRaw !== null && decimalsRaw !== undefined ? Number(decimalsRaw) : DEFAULT_DECIMALS;
      setDecimals(Number.isFinite(d) ? d : DEFAULT_DECIMALS);

      const balRaw = address ? await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: STAKING_ABI, functionName: 'balanceOf', args: [address] }) : 0n;
      setWalletBalance(toHuman(balRaw ?? 0n));

      const allowRaw = address ? await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: STAKING_ABI, functionName: 'allowance', args: [address, STAKING_ADDRESS] }) : 0n;
      setAllowance(toHuman(allowRaw ?? 0n));

      if (address) {
        const stakeInfo = await readContractSafe(publicClient, { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'viewStakeInfoOf', args: [address] });
        if (stakeInfo) {
          setStakedBalance(toHuman(stakeInfo.stakeBalance ?? stakeInfo[0] ?? 0n));
          setRewards(toHuman(stakeInfo.rewardValue ?? stakeInfo[1] ?? 0n));
          setLastUnstakeTs(Number(stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2] ?? 0n));
          setLastRewardTs(Number(stakeInfo.lastRewardTimestamp ?? stakeInfo[3] ?? 0n));
        }
      }

      const rewardRateRaw = await readContractSafe(publicClient, { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'rewardRate' });
      const bonusRateRaw = await readContractSafe(publicClient, { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'bonusRate' });

      setRewardRate(rewardRateRaw ? Number(formatUnits(rewardRateRaw, decimals)) : 0);
      setBonusRate(bonusRateRaw ? Number(formatUnits(bonusRateRaw, decimals)) : 0);

    } catch (err) {
      console.error('fetchOnChain error', err);
    }
  }, [publicClient, address, decimals, toHuman]);

  useEffect(() => {
    fetchOnChain();
    const t = setInterval(fetchOnChain, 20_000);
    return () => clearInterval(t);
  }, [fetchOnChain]);

  // Write helpers
  const doApprove = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    setLoading(true);
    try {
      const raw = toRaw(humanAmount);
      const tx = await writeContractSafe(walletClient, { address: TOKEN_ADDRESS, abi: STAKING_ABI, functionName: 'approve', args: [STAKING_ADDRESS, raw] });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      if (tx?.request) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
      else if (tx?.hash) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      await fetchOnChain();
      showAlert('Approve confirmed');
    } catch (err) { console.error('approve err', err); showAlert('Approve failed'); }
    finally { setLoading(false); }
  };

  const doStake = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to stake'); return; }
    setLoading(true); setTxHash(null);
    try {
      const raw = toRaw(humanAmount);
      const allowRaw = await readContractSafe(publicClient, { address: TOKEN_ADDRESS, abi: STAKING_ABI, functionName: 'allowance', args: [address, STAKING_ADDRESS] });
      if ((allowRaw ?? 0n) < raw) { showAlert('Allowance low — approving first'); await doApprove('1000000000000'); }

      const tx = await writeContractSafe(walletClient, { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'stake', args: [raw] });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      if (tx?.request) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
      else if (tx?.hash) await publicClient.waitForTransactionReceipt({ hash: tx.hash });

      showAlert('Stake confirmed'); setAmount(''); await fetchOnChain();
    } catch (err) { console.error('stake err', err); showAlert('Stake failed'); } 
    finally { setLoading(false); }
  };

  const doUnstake = async (humanAmount) => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    if (!humanAmount || Number(humanAmount) <= 0) { showAlert('Enter amount to unstake'); return; }
    setLoading(true); setTxHash(null);
    try {
      const raw = toRaw(humanAmount);
      const tx = await writeContractSafe(walletClient, { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'unstake', args: [raw] });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      if (tx?.request) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
      else if (tx?.hash) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      showAlert('Unstake confirmed'); setUnstakeAmount(''); await fetchOnChain();
    } catch (err) { console.error('unstake err', err); showAlert('Unstake failed'); }
    finally { setLoading(false); }
  };

  const doClaim = async () => {
    if (!walletClient || !isConnected) { showAlert('Connect wallet'); return; }
    setLoading(true); setTxHash(null);
    try {
      const tx = await writeContractSafe(walletClient, { address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'claim', args: [] });
      setTxHash(tx?.hash ?? tx?.request?.hash ?? null);
      if (tx?.request) await publicClient.waitForTransactionReceipt({ hash: tx.request.hash });
      else if (tx?.hash) await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      showAlert('Claim executed'); await fetchOnChain();
    } catch (err) { console.error('claim err', err); showAlert('Claim failed'); }
    finally { setLoading(false); }
  };

  const fmtTs = (s) => (!s || s <= 0) ? 'N/A' : new Date(s * 1000).toLocaleString();

  return (
    <div className="min-h-screen w-full bg-black text-white antialiased">
      <ConnectHeader />

      <main className="max-w-6xl mx-auto px-6 pb-12">

        {/* Top analytics row */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/** Your Stake, Rewards, Wallet, Badge cards **/}
          {[{
            label: 'Your Stake', value: stakedBalance, extra: `Last reward update: ${fmtTs(lastRewardTs)}`
          }, {
            label: 'Rewards', value: rewards, extra: `Last unstake: ${fmtTs(lastUnstakeTs)}`
          }, {
            label: 'Wallet Balance', value: walletBalance, extra: `Allowance: ${allowance}`
          }, {
            label: 'Badge Tier', value: 'Starter', extra: address ? shortAddr(address) : 'Not connected'
          }].map((card, idx) => (
            <motion.div key={idx} className="bg-gray-900 p-4 rounded-2xl border border-orange-600/10" whileHover={{ boxShadow: '0 0 18px rgba(255,140,0,0.24)' }}>
              <div className="text-sm text-gray-300">{card.label}</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {idx < 3 && <img src={TOKEN_LOGO} alt={TOKEN_LABEL} className="h-6 w-6 rounded-full opacity-90" />}
                {card.value} {idx < 3 ? TOKEN_LABEL : ''}
              </div>
              <div className="text-xs text-gray-400 mt-2">{card.extra}</div>
            </motion.div>
          ))}
        </section>

        {/* Stake / Unstake section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/** Approve & Stake Card **/}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
            <h2 className="text-xl font-bold mb-3">Approve & Stake</h2>
            <input type="number" step={1 / (10 ** decimals)} value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.0" className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => doApprove(amount || '1000000')} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium" disabled={!isConnected || loading}>Approve</button>
              <button onClick={() => doStake(amount)} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={!isConnected || loading}>Stake</button>
            </div>
          </motion.div>

          {/** Unstake & Claim Card **/}
          <motion.div className="bg-gray-900 p-6 rounded-3xl border border-transparent hover:border-orange-500/30">
            <h2 className="text-xl font-bold mb-3">Unstake</h2>
            <input type="number" step={1 / (10 ** decimals)} value={unstakeAmount} onChange={e => setUnstakeAmount(e.target.value)}
              placeholder="0.0" className="w-full mb-4 p-3 rounded bg-gray-800 text-white placeholder-gray-400 outline-none border border-transparent focus:border-orange-500" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => doUnstake(unstakeAmount)} className="py-3 rounded-xl bg-black border-2 border-orange-500 text-orange-50 font-medium" disabled={!isConnected || loading}>Unstake</button>
              <button onClick={doClaim} className="py-3 rounded-xl bg-orange-500 text-black font-semibold" disabled={!isConnected || loading}>Claim Rewards</button>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-gray-800 py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">
          © 2019-Present AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
        </div>
      </footer>

      {alertMsg && <div className="fixed right-6 bottom-6 bg-[#0b0b0b] border border-orange-500 text-orange-300 p-3 rounded shadow-lg">{alertMsg}</div>}
    </div>
  );
}
