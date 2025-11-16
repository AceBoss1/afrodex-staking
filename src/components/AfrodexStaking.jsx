// src/components/AfrodexStaking.jsx
import React, { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { STAKING_ADDRESS, TOKEN_ADDRESS } from '../lib/contracts';
import { STAKING_ABI } from '../lib/abis/stakingAbi';

export default function AfrodexStaking() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const TOKEN_LOGO = '/afrodex_token.png';

  const [stakeBalance, setStakeBalance] = useState(0);
  const [rewardValue, setRewardValue] = useState(0);
  const [lastUnstakeTimestamp, setLastUnstakeTimestamp] = useState(0);
  const [lastRewardTimestamp, setLastRewardTimestamp] = useState(0);

  const [inputAmount, setInputAmount] = useState('');

  // --- Rewards Calculator ---
  const DAILY_APR = 0.0003;         // 0.03%
  const BONUS_APR = 0.00003;        // 0.003% daily bonus
  const YEARLY_APR = 0.2409;        // 24.09%

  const [daysStaked, setDaysStaked] = useState(0);
  const [calcDaily, setCalcDaily] = useState(0);
  const [calcMonthly, setCalcMonthly] = useState(0);
  const [calcYearly, setCalcYearly] = useState(0);

  // -----------------------------
  // Load staking info
  // -----------------------------
  const loadStakingInfo = async () => {
    if (!publicClient || !address) return;

    try {
      // read viewStakeInfoOf (your contract returns [stakeBalance, rewardValue, lastUnstakeTimestamp, lastRewardTimestamp])
      const data = await publicClient.readContract({
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'viewStakeInfoOf',
        args: [address],
      });

      // use 4 decimals for formatting (AfroX uses 4)
      const stake = Number(formatUnits(data[0], 4));
      const reward = Number(formatUnits(data[1], 4));
      const unstakeTS = Number(data[2]);
      const rewardTS = Number(data[3]);

      setStakeBalance(stake);
      setRewardValue(reward);
      setLastUnstakeTimestamp(unstakeTS);
      setLastRewardTimestamp(rewardTS);

      // days since lastUnstakeTimestamp
      const now = Math.floor(Date.now() / 1000);
      const deltaDays = unstakeTS && unstakeTS > 0 ? Math.floor((now - unstakeTS) / 86400) : Math.floor((now - rewardTS) / 86400);
      setDaysStaked(deltaDays);

      calculateProjections(stake, deltaDays);
    } catch (e) {
      console.error('Load error:', e);
      // fallback: zero everything
      setStakeBalance(0);
      setRewardValue(0);
      setLastUnstakeTimestamp(0);
      setLastRewardTimestamp(0);
      setDaysStaked(0);
      calculateProjections(0, 0);
    }
  };

  // -----------------------------
  // Reward Projections
  // -----------------------------
  const calculateProjections = (amount, stakedDays) => {
    if (!amount || amount <= 0) {
      setCalcDaily(0);
      setCalcMonthly(0);
      setCalcYearly(0);
      return;
    }

    const baseDaily = amount * DAILY_APR;

    const bonusUnlocked = stakedDays >= 30;
    const dailyBonus = bonusUnlocked ? amount * BONUS_APR : 0;

    const daily = baseDaily + dailyBonus;
    const monthly = daily * 30;
    const yearly = amount * YEARLY_APR;

    setCalcDaily(daily);
    setCalcMonthly(monthly);
    setCalcYearly(yearly);
  };

  // -----------------------------
  // Stake
  // -----------------------------
  const stakeTokens = async () => {
    if (!walletClient || !inputAmount) return alert('Enter amount');

    try {
      const amountParsed = parseUnits(inputAmount, 4);

      await walletClient.writeContract({
        address: TOKEN_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [amountParsed],
      });

      // refresh after slight delay
      setTimeout(loadStakingInfo, 2000);
    } catch (err) {
      console.error(err);
      alert('Stake failed');
    }
  };

  // -----------------------------
  // Claim Rewards
  // -----------------------------
  const claimReward = async () => {
    if (!walletClient) return;

    try {
      // try common claim function names — prefer 'claimReward' else fallback to 'claim'
      try {
        await walletClient.writeContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'claimReward',
        });
      } catch (e) {
        // fallback
        await walletClient.writeContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: 'claim',
        });
      }

      setTimeout(loadStakingInfo, 2000);
    } catch (err) {
      console.error(err);
      alert('Claim failed');
    }
  };

  // -----------------------------
  // Unstake
  // -----------------------------
  const unstakeTokens = async () => {
    if (!walletClient) return;

    try {
      await walletClient.writeContract({
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'unstake',
        // some contracts expect amount; if you want full unstake you may pass parseUnits(String(amount),4)
        // here we call without args to match earlier UI, fallback handled by contract.
      });

      setTimeout(loadStakingInfo, 2000);
    } catch (err) {
      console.error(err);
      alert('Unstake failed');
    }
  };

  useEffect(() => {
    if (isConnected) loadStakingInfo();
  }, [isConnected]);

  return (
    <div style={{ padding: '30px', maxWidth: '980px', margin: '0 auto', fontFamily: 'Inter, Arial, sans-serif' }}>
      <h2 style={{ color: '#FF8C00', marginBottom: 12 }}>AfroX Staking Dashboard</h2>

      {!isConnected ? (
        <p>Please connect your wallet.</p>
      ) : (
        <>
          {/* Stake Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            {/* Wallet Balance */}
            <div style={{ padding: 16, border: '1px solid #222', borderRadius: 10, background: '#0b0b0b' }}>
              <h4 style={{ margin: 0, color: '#BFBFBF' }}>Wallet Balance</h4>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
                <img src={TOKEN_LOGO} alt="AfroX" style={{ height: 22, marginRight: 10 }} />
                <span style={{ fontSize: 20, color: '#fff', fontWeight: 600 }}>{stakeBalance ? stakeBalance.toLocaleString() : '0'} AfroX</span>
              </div>
            </div>

            {/* Staked Balance */}
            <div style={{ padding: 16, border: '1px solid #222', borderRadius: 10, background: '#0b0b0b' }}>
              <h4 style={{ margin: 0, color: '#BFBFBF' }}>Staked Balance</h4>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
                <img src={TOKEN_LOGO} alt="AfroX" style={{ height: 22, marginRight: 10 }} />
                <span style={{ fontSize: 20, color: '#fff', fontWeight: 600 }}>{stakeBalance.toLocaleString()} AfroX</span>
              </div>
            </div>

            {/* Accumulated Rewards */}
            <div style={{ padding: 16, border: '1px solid #222', borderRadius: 10, background: '#0b0b0b' }}>
              <h4 style={{ margin: 0, color: '#BFBFBF' }}>Accumulated Rewards</h4>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
                <img src={TOKEN_LOGO} alt="AfroX" style={{ height: 22, marginRight: 10 }} />
                <span style={{ fontSize: 20, color: '#7CFC00', fontWeight: 700 }}>{rewardValue.toLocaleString()} AfroX</span>
              </div>
              <div style={{ marginTop: 8, color: '#9b9b9b', fontSize: 13 }}>
                <div>Last reward update: {lastRewardTimestamp ? new Date(lastRewardTimestamp * 1000).toLocaleString() : '—'}</div>
                <div>Last unstake: {lastUnstakeTimestamp ? new Date(lastUnstakeTimestamp * 1000).toLocaleString() : '—'}</div>
              </div>
            </div>
          </div>

          {/* Stake Input */}
          <div style={{ padding: 18, border: '1px solid #333', borderRadius: 10, marginBottom: 18, background: '#070707' }}>
            <h3 style={{ marginTop: 0, color: '#EAEAEA' }}>Stake Tokens</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="Amount (AfroX)"
                style={{ padding: '10px 12px', width: 220, borderRadius: 8, background: '#0b0b0b', color: '#fff', border: '1px solid #222' }}
              />
              <button onClick={stakeTokens} style={{ padding: '10px 14px', background: '#FF8C00', color: '#000', borderRadius: 8, fontWeight: 600 }}>
                Stake
              </button>
            </div>
          </div>

          {/* Reward Actions */}
          <div style={{ marginBottom: 20 }}>
            <button onClick={claimReward} style={{ padding: '10px 14px', marginRight: 10, background: '#2E8B57', color: '#fff', borderRadius: 8 }}>
              Claim Rewards
            </button>
            <button onClick={unstakeTokens} style={{ padding: '10px 14px', background: '#B22222', color: '#fff', borderRadius: 8 }}>
              Unstake
            </button>
          </div>

          {/* Rewards Calculator */}
          <div style={{ padding: 18, border: '1px solid #444', borderRadius: 10, background: '#0f0f0f' }}>
            <h3 style={{ marginTop: 0, color: '#EAEAEA' }}>Rewards Projection Calculator</h3>

            <div style={{ color: '#cfcfcf', marginTop: 8 }}>
              <p style={{ margin: '6px 0' }}><b>Daily APR:</b> 0.03%</p>
              <p style={{ margin: '6px 0' }}><b>Bonus APR:</b> +0.003% daily (after 30 days)</p>
              <p style={{ margin: '6px 0 12px' }}><b>Yearly APR:</b> 24.09%</p>

              <div style={{ display: 'flex', gap: 18 }}>
                <div>
                  <div style={{ color: '#9b9b9b', fontSize: 13 }}>Daily Reward</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{calcDaily.toLocaleString(undefined, { maximumFractionDigits: 6 })} AfroX</div>
                </div>

                <div>
                  <div style={{ color: '#9b9b9b', fontSize: 13 }}>Monthly Reward</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{calcMonthly.toLocaleString(undefined, { maximumFractionDigits: 6 })} AfroX</div>
                </div>

                <div>
                  <div style={{ color: '#9b9b9b', fontSize: 13 }}>Yearly Reward</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{calcYearly.toLocaleString(undefined, { maximumFractionDigits: 6 })} AfroX</div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <p style={{ textAlign: 'center', marginTop: 24, opacity: 0.85, color: '#bdbdbd' }}>
            © 2025 AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
          </p>
        </>
      )}
    </div>
  );
}
