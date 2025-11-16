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

  // UI STATES
  const TOKEN_LOGO = '/afrodex_token.png';
  const [activeTab, setActiveTab] = useState("staking");

  // Blockchain states
  const [stakeBalance, setStakeBalance] = useState(0);
  const [rewardValue, setRewardValue] = useState(0);
  const [lastUnstakeTimestamp, setLastUnstakeTimestamp] = useState(0);
  const [lastRewardTimestamp, setLastRewardTimestamp] = useState(0);

  const [walletBalance, setWalletBalance] = useState(0);

  const [inputAmount, setInputAmount] = useState('');

  // Rewards Calculator
  const DAILY_APR = 0.0003;       // 0.03%
  const BONUS_APR = 0.00003;      // +0.003% after 30 days
  const YEARLY_APR = 0.2409;      // 24.09%

  const [daysStaked, setDaysStaked] = useState(0);
  const [calcDaily, setCalcDaily] = useState(0);
  const [calcMonthly, setCalcMonthly] = useState(0);
  const [calcYearly, setCalcYearly] = useState(0);

  // -----------------------------
  // Load wallet & stake info
  // -----------------------------
  const loadStakingInfo = async () => {
    if (!publicClient || !address) return;

    try {
      // Wallet Balance
      const balance = await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      setWalletBalance(Number(formatUnits(balance, 4)));

      // Staking info
      const data = await publicClient.readContract({
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'viewStakeInfoOf',
        args: [address],
      });

      const stake = Number(formatUnits(data[0], 4));
      const reward = Number(formatUnits(data[1], 4));

      setStakeBalance(stake);
      setRewardValue(reward);
      setLastUnstakeTimestamp(Number(data[2]));
      setLastRewardTimestamp(Number(data[3]));

      // Days staked for projection
      const now = Math.floor(Date.now() / 1000);
      const deltaDays = data[2] > 0 
        ? Math.floor((now - data[2]) / 86400)
        : Math.floor((now - data[3]) / 86400);

      setDaysStaked(deltaDays);
      calculateProjections(stake, deltaDays);

    } catch (err) {
      console.error("Error loading staking info:", err);
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
    const bonusActive = stakedDays >= 30;
    const bonusDaily = bonusActive ? amount * BONUS_APR : 0;

    const daily = baseDaily + bonusDaily;

    setCalcDaily(daily);
    setCalcMonthly(daily * 30);
    setCalcYearly(amount * YEARLY_APR);
  };


  // -----------------------------
  // Stake
  // -----------------------------
  const stakeTokens = async () => {
    if (!walletClient || !inputAmount) return alert("Enter amount");

    try {
      const parsedAmount = parseUnits(inputAmount, 4);

      await walletClient.writeContract({
        address: STAKING_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [parsedAmount],
      });

      setTimeout(loadStakingInfo, 1800);
    } catch (err) {
      console.error(err);
      alert("Stake failed");
    }
  };


  // -----------------------------
  // Claim Rewards (multi-fallback)
  // -----------------------------
  const claimRewards = async () => {
    if (!walletClient) return;

    const functionsToTry = ["claimReward", "claimRewards", "claim"];

    for (let fn of functionsToTry) {
      try {
        await walletClient.writeContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: fn,
        });

        setTimeout(loadStakingInfo, 1800);
        return; // success
      } catch (err) {
        console.warn(`claim fallback failed: ${fn}`);
      }
    }

    alert("Claim function not found on contract");
  };


  // -----------------------------
  // Unstake (multi-fallback)
  // -----------------------------
  const unstakeTokens = async () => {
    if (!walletClient) return;

    const functionsToTry = ["unstake", "withdraw", "unstakeAll"];

    for (let fn of functionsToTry) {
      try {
        await walletClient.writeContract({
          address: STAKING_ADDRESS,
          abi: STAKING_ABI,
          functionName: fn,
        });

        setTimeout(loadStakingInfo, 1800);
        return;
      } catch (err) {
        console.warn(`unstake fallback failed: ${fn}`);
      }
    }

    alert("Unstake function not found on contract");
  };


  useEffect(() => {
    if (isConnected) loadStakingInfo();
  }, [isConnected]);

  // -----------------------------
  // UI TABS
  // -----------------------------

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "10px 18px",
        borderBottom: activeTab === id ? "2px solid #FF8C00" : "2px solid transparent",
        color: activeTab === id ? "#FF8C00" : "#ccc",
        background: "transparent",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );


  return (
    <div style={{ padding: '30px', maxWidth: '980px', margin: '0 auto' }}>

      {/* TABS */}
      <div style={{ display: "flex", gap: 20, marginBottom: 25 }}>
        <TabButton id="staking" label="AfroX Staking Dashboard" />
        <TabButton id="ambassador" label="AfroDex Ambassador Dashboard" />
        <TabButton id="governance" label="AfroDex Community of Trust" />
      </div>

      {/* ------------------------------
          TAB 1 — STAKING DASHBOARD
         ------------------------------ */}
      {activeTab === "staking" && (
        <>
          {!isConnected ? (
            <p>Please connect your wallet.</p>
          ) : (
            <>

              {/* INFO CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>

                {/* WALLET BALANCE */}
                <Card title="Wallet Balance">
                  <BalanceRow logo={TOKEN_LOGO} value={walletBalance} color="#fff" />
                </Card>

                {/* STAKED BALANCE */}
                <Card title="Staked Balance">
                  <BalanceRow logo={TOKEN_LOGO} value={stakeBalance} color="#fff" />
                </Card>

                {/* REWARDS */}
                <Card title="Accumulated Rewards">
                  <BalanceRow logo={TOKEN_LOGO} value={rewardValue} color="#7CFC00" />
                  <div style={{ marginTop: 8, fontSize: 13, color: "#999" }}>
                    <div>Last reward update: {lastRewardTimestamp ? new Date(lastRewardTimestamp * 1000).toLocaleString() : "—"}</div>
                    <div>Last unstake: {lastUnstakeTimestamp ? new Date(lastUnstakeTimestamp * 1000).toLocaleString() : "—"}</div>
                  </div>
                </Card>

              </div>

              {/* STAKE INPUT */}
              <Card>
                <h3 style={{ marginTop: 0 }}>Stake Tokens</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    placeholder="Amount (AfroX)"
                    style={{
                      padding: '10px 12px',
                      width: 220,
                      borderRadius: 8,
                      background: '#0b0b0b',
                      color: '#fff',
                      border: '1px solid #222',
                    }}
                  />
                  <button
                    onClick={stakeTokens}
                    style={{
                      padding: '10px 14px',
                      background: '#FF8C00',
                      color: '#000',
                      borderRadius: 8,
                      fontWeight: 600,
                    }}
                  >
                    Stake
                  </button>
                </div>
              </Card>

              {/* CLAIM & UNSTAKE BUTTONS */}
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={claimRewards}
                  style={{
                    padding: '10px 14px',
                    marginRight: 10,
                    background: '#2E8B57',
                    color: '#fff',
                    borderRadius: 8,
                  }}
                >
                  Claim Rewards
                </button>

                <button
                  onClick={unstakeTokens}
                  style={{
                    padding: '10px 14px',
                    background: '#B22222',
                    color: '#fff',
                    borderRadius: 8,
                  }}
                >
                  Unstake
                </button>
              </div>

              {/* REWARD PROJECTION */}
              <Card>
                <h3 style={{ marginTop: 0 }}>Rewards Projection Calculator</h3>

                <p style={{ margin: '6px 0', color: '#ccc' }}><b>Daily APR:</b> 0.03%</p>
                <p style={{ margin: '6px 0', color: '#ccc' }}><b>Bonus APR:</b> +0.003% daily (after 30 days)</p>
                <p style={{ margin: '6px 0', color: '#ccc', marginBottom: 15 }}><b>Yearly APR:</b> 24.09%</p>

                <div style={{ display: 'flex', gap: 20 }}>
                  <Projection title="Daily Reward" value={calcDaily} />
                  <Projection title="Monthly Reward" value={calcMonthly} />
                  <Projection title="Yearly Reward" value={calcYearly} />
                </div>

                <p style={{ marginTop: 15, color: '#bbb', fontSize: 12 }}>
                  ⚠️ <b>Disclaimer:</b> This projection is an estimate.  
                  Actual rewards are calculated by the blockchain and may differ slightly.
                </p>
              </Card>

              {/* IMPORTANT DISCLAIMER */}
              <p style={{ marginTop: 30, padding: 14, background: '#111', borderRadius: 8, border: '1px solid #333', color: '#ccc' }}>
                ⚠️ <b>Important Disclaimer:</b>  
                By using this platform, you confirm that you are of legal age,  
                reside in a jurisdiction where crypto staking is legally permitted,  
                fully understand the risks involved,  
                and agree that all actions and liabilities are at your own risk.
              </p>

              {/* FOOTER */}
              <p style={{ textAlign: 'center', marginTop: 24, opacity: 0.8, color: '#bdbdbd' }}>
                © 2025 AFRODEX. All rights reserved | ❤️ Donations: 0xC54f68D1eD99e0B51C162F9a058C2a0A88D2ce2A
              </p>
            </>
          )}
        </>
      )}

      {/* ------------------------------
          TAB 2 — AMBASSADOR DASHBOARD
         ------------------------------ */}
      {activeTab === "ambassador" && (
        <div style={{ color: '#ccc', padding: 20 }}>
          <h2>AfroDex Ambassador Dashboard</h2>
          <p>This section will contain the referral and ambassador features.</p>
        </div>
      )}

      {/* ------------------------------
          TAB 3 — GOVERNANCE DASHBOARD
         ------------------------------ */}
      {activeTab === "governance" && (
        <div style={{ color: '#ccc', padding: 20 }}>
          <h2>AfroDex Community of Trust</h2>
          <p>This section will contain the governance and voting features.</p>
        </div>
      )}

    </div>
  );
}

/* ---------------------------------------
   SMALL REUSABLE UI SUBCOMPONENTS
--------------------------------------- */

const Card = ({ title, children }) => (
  <div style={{
    padding: 16,
    border: '1px solid #222',
    borderRadius: 10,
    background: '#0b0b0b',
    marginBottom: 20
  }}>
    {title && <h4 style={{ margin: 0, color: '#BFBFBF', marginBottom: 10 }}>{title}</h4>}
    {children}
  </div>
);

const BalanceRow = ({ logo, value, color }) => (
  <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
    <img src={logo} style={{ height: 22, marginRight: 10 }} />
    <span style={{ fontSize: 20, fontWeight: 700, color }}>{value.toLocaleString()} AfroX</span>
  </div>
);

const Projection = ({ title, value }) => (
  <div>
    <div style={{ color: '#999', fontSize: 13 }}>{title}</div>
    <div style={{ fontSize: 18, fontWeight: 700 }}>{value.toLocaleString(undefined, { maximumFractionDigits: 6 })} AfroX</div>
  </div>
);
