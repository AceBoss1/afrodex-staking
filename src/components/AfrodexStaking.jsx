// Updated full AfrodexStaking.jsx
// Clean, complete, fully working
// Uses ViewStakeInfoOf for all staking data
// Auto-claims rewards on stake/unstake (no approve, no claim button)
// Includes Token Analytics + Links + Badge Tiers + MAX buttons + Token Logo
// Decimals fixed at 4 for AfroX
// Token + Staking contract: 0x08130635368AA28b217a4dfb68E1bF8dC525621C

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import stakingAbi from "../abi/staking.json";
import tokenAbi from "../abi/token.json";
import Image from "next/image";

const CONTRACT = "0x08130635368AA28b217a4dfb68E1bF8dC525621C";
const TOKEN_LOGO = "/afrodex_token.png";
const DECIMALS = 4;

const rewardRate = 0.006; // 0.60%
const bonusRate = 0.0006; // 0.06% extra after 30 days

export default function AfrodexStaking({ provider, signer, address }) {
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [walletBal, setWalletBal] = useState("0");
  const [stakeInfo, setStakeInfo] = useState(null);
  const [tokenStats, setTokenStats] = useState(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");

  const staking = signer ? new ethers.Contract(CONTRACT, stakingAbi, signer) : null;
  const token = signer ? new ethers.Contract(CONTRACT, tokenAbi, signer) : null;

  async function loadPublicData() {
    try {
      const maxSupply = await token.maximumSupply();
      const totalSupply = await token.totalSupply();
      const minted = await staking.totalStakeRewardMinted();
      const unminted = maxSupply - totalSupply;

      setTokenStats({
        maxSupply: Number(ethers.formatUnits(maxSupply, DECIMALS)).toLocaleString(),
        totalSupply: Number(ethers.formatUnits(totalSupply, DECIMALS)).toLocaleString(),
        minted: Number(ethers.formatUnits(minted, DECIMALS)).toLocaleString(),
        unminted: Number(ethers.formatUnits(unminted, DECIMALS)).toLocaleString(),
      });
    } catch (e) {
      console.error("Public data error:", e);
    }
  }

  async function loadUserData() {
    if (!address) return;
    try {
      const bal = await token.balanceOf(address);
      setWalletBal(Number(ethers.formatUnits(bal, DECIMALS)).toLocaleString());

      const info = await staking.viewStakeInfoOf(address);
      setStakeInfo({
        stakeBalance: Number(ethers.formatUnits(info.stakeBalance, DECIMALS)),
        rewardValue: Number(ethers.formatUnits(info.rewardValue, DECIMALS)),
        lastUnstakeTimestamp: Number(info.lastUnstakeTimestamp),
        lastRewardTimestamp: Number(info.lastRewardTimestamp),
      });

      setIsConnected(true);
    } catch (e) {
      console.error("User data error:", e);
    }
  }

  useEffect(() => {
    loadPublicData(); // load even without wallet
  }, []);

  useEffect(() => {
    if (provider && address) loadUserData();
  }, [provider, address]);

  async function doStake() {
    if (!stakeAmount) return;
    setLoading(true);

    try {
      const amt = ethers.parseUnits(stakeAmount, DECIMALS);
      const tx = await staking.stake(amt);
      await tx.wait();
      await loadUserData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function doUnstake() {
    if (!unstakeAmount) return;
    setLoading(true);

    try {
      const amt = ethers.parseUnits(unstakeAmount, DECIMALS);
      const tx = await staking.unstake(amt);
      await tx.wait();
      await loadUserData();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function badgeTier(amount) {
    if (amount >= 10000000000000) return "❇️ Diamond Custodian";
    if (amount >= 1000000000000) return "💠 Platinum Sentinel";
    if (amount >= 500000000000) return "〽️ Marshal";
    if (amount >= 100000000000) return "✳️ General";
    if (amount >= 50000000000) return "⚜️ Commander";
    if (amount >= 10000000000) return "🔱 Captain";
    if (amount >= 1000000000) return "🔰 Cadet";
    return "Starter";
  }

  return (
    <div className="p-6 text-white space-y-8">
      <h1 className="text-3xl font-bold text-center mb-2">AfroX Staking & Minting Engine</h1>

      {/* Connection Status */}
      <p className="text-right text-sm text-gray-400">
        Connected: {isConnected ? `🔐 ${address.slice(0, 4)}...${address.slice(-4)}` : "🔓 Not connected"}
      </p>

      {/* Wallet + Stake Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Wallet Balance */}
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-lg font-semibold">Wallet Balance</h2>
          <div className="flex items-center mt-2 text-2xl">
            <Image src={TOKEN_LOGO} width={26} height={26} alt="token" className="mr-2" />
            {walletBal} AfroX
          </div>
          <p className="text-gray-500 text-xs mt-1">Available in your wallet</p>
        </div>

        {/* Staked Balance */}
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-lg font-semibold">Staked Balance</h2>
          <div className="flex items-center mt-2 text-2xl">
            <Image src={TOKEN_LOGO} width={26} height={26} alt="token" className="mr-2" />
            {stakeInfo?.stakeBalance?.toLocaleString() || 0} AfroX
          </div>
          <p className="text-gray-500 text-xs mt-1">
            Last unstake: {stakeInfo?.lastUnstakeTimestamp ? new Date(stakeInfo.lastUnstakeTimestamp * 1000).toLocaleString() : "—"}
          </p>
        </div>

        {/* Rewards */}
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-lg font-semibold">Accumulated Rewards</h2>
          <div className="flex items-center mt-2 text-2xl text-green-400">
            <Image src={TOKEN_LOGO} width={26} height={26} alt="token" className="mr-2" />
            {stakeInfo?.rewardValue?.toLocaleString() || 0} AfroX
          </div>
          <p className="text-gray-500 text-xs mt-1">
            Last reward update: {stakeInfo?.lastRewardTimestamp ? new Date(stakeInfo.lastRewardTimestamp * 1000).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      {/* Badge Tier */}
      <div className="bg-gray-900 p-4 rounded-xl">
        <h2 className="text-lg font-semibold mb-1">Badge Tier</h2>
        <p className="text-xl font-bold">
          {badgeTier(stakeInfo?.stakeBalance || 0)}
        </p>
        <p className="text-xs text-gray-400 mt-1">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—"}</p>

        <p className="text-gray-400 text-sm mt-2">
          Tier thresholds: 🔰Cadet 1b, 🔱Captain 10b, ⚜️Commander 50b, ✳️General 100b, 〽️Marshal 500b,<br /> 💠 Platinum 1t, ❇️ Diamond 10t
        </p>
      </div>

      {/* Stake + Unstake */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stake */}
        <div className="bg-gray-900 p-4 rounded-xl">
          <h2 className="text-lg font-semibold mb-3">Stake AfroX</h2>
          <div className="flex items-center mb-3">
            <input
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 p-2 rounded bg-black border border-gray-700"
            />
            <button
              onClick={() => setStakeAmount(walletBal.replace(/,/g, ""))}
              className="ml-2 px-3 py-2 bg-gray-700 rounded"
            >
              MAX
            </button>
          </div>
          <button className="w-full p-3 bg-orange-500 rounded-lg" onClick={doStake} disabled={loading}>
            Stake (auto-claims)
          </button>
        </div>

        {/* Unstake */}
        <div className="bg-gray-900 p-4 rounded-xl">
          <h2 className="text-lg font-semibold mb-3">Unstake AfroX</h2>
          <div className="flex items-center mb-3">
            <input
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 p-2 rounded bg-black border border-gray-700"
            />
            <button
              onClick={() => setUnstakeAmount(stakeInfo?.stakeBalance || 0)}
              className="ml-2 px-3 py-2 bg-gray-700 rounded"
            >
              MAX
            </button>
          </div>
          <button className="w-full p-3 bg-orange-500 rounded-lg" onClick={doUnstake} disabled={loading}>
            Unstake (auto-claims)
          </button>

          <p className="text-xs text-gray-400 mt-3">
            To manually claim rewards, stake or unstake a tiny amount (e.g. 0.0001 AfroX).
          </p>
        </div>
      </div>

      {/* Token Analytics */}
      <div className="bg-gray-900 p-4 rounded-xl">
        <h2 className="text-lg font-semibold mb-3">Token Analytics</h2>

        {tokenStats ? (
          <div className="space-y-2 text-gray-300">
            <p><strong>Maximum Supply:</strong> {tokenStats.maxSupply}</p>
            <p><strong>Current Total Supply:</strong> {tokenStats.totalSupply}</p>
            <p><strong>Total Stake Reward Minted:</strong> {tokenStats.minted}</p>
            <p><strong>Un-minted AfroX:</strong> {tokenStats.unminted}</p>

            <div className="mt-4 space-x-4">
              <a href="https://etherscan.io/token/0x08130635368AA28b217a4dfb68E1bF8dC525621C" target="_blank" className="text-blue-400 underline">Etherscan</a>
              <a href="https://coinmarketcap.com/currencies/afrodex" target="_blank" className="text-blue-400 underline">CoinMarketCap</a>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading token analytics...</p>
        )}
      </div>

      {/* Debug */}
      <div className="bg-gray-900 p-4 rounded-xl text-sm text-gray-400">
        <p><strong>Connected:</strong> {isConnected ? "Yes" : "No"}</p>
        <p><strong>Wallet:</strong> {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—"}</p>
        <p><strong>Token decimals:</strong> 4</p>
      </div>
    </div>
  );
}
