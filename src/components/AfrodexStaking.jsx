// Clean, working AfrodexStaking.jsx
// NOTE: Replace provider/signers with your existing ConnectHeader wallet context
// Contract: 0x08130635368AA28b217a4dfb68E1bF8dC525621C
// This file contains:
// ✔ Working stake/unstake auto-claim logic
// ✔ Removed Approve + Claim buttons
// ✔ Shows Token Analytics with Etherscan + CMC links
// ✔ Uses ViewStakeInfoOf for everything
// ✔ Uses decimals=4 for AfroX

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import stakingAbi from "../abi/staking.json";
import tokenAbi from "../abi/token.json";

const STAKING_ADDR = "0x08130635368AA28b217a4dfb68E1bF8dC525621C";
const TOKEN_ADDR = "0x08130635368AA28b217a4dfb68E1bF8dC525621C";

export default function AfrodexStaking({ provider, signer, address }) {
  const [loading, setLoading] = useState(false);
  const [stakeInfo, setStakeInfo] = useState(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [walletBal, setWalletBal] = useState("0");
  const [tokenStats, setTokenStats] = useState(null);
  const decimals = 4; // AfroX

  const staking = signer ? new ethers.Contract(STAKING_ADDR, stakingAbi, signer) : null;
  const token = signer ? new ethers.Contract(TOKEN_ADDR, tokenAbi, signer) : null;

  async function loadAll() {
    if (!provider || !address) return;
    try {
      const bal = await token.balanceOf(address);
      setWalletBal(Number(ethers.formatUnits(bal, decimals)).toLocaleString());

      const info = await staking.ViewStakeInfoOf(address);
      setStakeInfo({
        stakeBalance: Number(ethers.formatUnits(info.stakeBalance, decimals)),
        rewardValue: Number(ethers.formatUnits(info.rewardValue, decimals)),
        lastRewardTimestamp: Number(info.lastRewardTimestamp),
        lastUnstakeTimestamp: Number(info.lastUnstakeTimestamp)
      });

      const maxSupply = await token.MAX_SUPPLY();
      const totalSupply = await token.totalSupply();
      const minted = await staking.totalMintedRewards();
      const unminted = maxSupply - totalSupply;

      setTokenStats({
        maxSupply: Number(ethers.formatUnits(maxSupply, decimals)).toLocaleString(),
        totalSupply: Number(ethers.formatUnits(totalSupply, decimals)).toLocaleString(),
        minted: Number(ethers.formatUnits(minted, decimals)).toLocaleString(),
        unminted: Number(ethers.formatUnits(unminted, decimals)).toLocaleString()
      });
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { loadAll(); }, [provider, address]);

  async function doStake() {
    if (!stakeAmount) return;
    setLoading(true);
    try {
      const amt = ethers.parseUnits(stakeAmount, decimals);
      const tx = await staking.Stake(amt);
      await tx.wait();
      await loadAll();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function doUnstake() {
    if (!unstakeAmount) return;
    setLoading(true);
    try {
      const amt = ethers.parseUnits(unstakeAmount, decimals);
      const tx = await staking.Unstake(amt);
      await tx.wait();
      await loadAll();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">AfroX Staking Dashboard</h1>

      {/* Wallet + Stake Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 p-4 rounded-xl">
          <h2 className="text-lg font-semibold">Wallet Balance</h2>
          <p className="text-2xl mt-2">{walletBal} AfroX</p>
        </div>

        <div className="bg-gray-900 p-4 rounded-xl">
          <h2 className="text-lg font-semibold">Staked Balance</h2>
          <p className="text-2xl mt-2">{stakeInfo?.stakeBalance?.toLocaleString()} AfroX</p>
        </div>

        <div className="bg-gray-900 p-4 rounded-xl">
          <h2 className="text-lg font-semibold">Accumulated Rewards</h2>
          <p className="text-2xl mt-2 text-green-400">{stakeInfo?.rewardValue?.toLocaleString()} AfroX</p>
        </div>
      </div>

      {/* Stake / Unstake */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Stake */}
        <div className="bg-gray-900 p-4 rounded-xl">
          <h2 className="text-lg font-semibold mb-2">Stake AfroX</h2>
          <input
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="w-full mb-3 p-2 rounded bg-black border border-gray-700"
            placeholder="Amount"
          />
          <button
            onClick={doStake}
            disabled={loading}
            className="w-full p-3 mt-1 bg-orange-500 rounded-lg"
          >
            Stake (auto-claims rewards)
          </button>
        </div>

        {/* Unstake */}
        <div className="bg-gray-900 p-4 rounded-xl">
          <h2 className="text-lg font-semibold mb-2">Unstake AfroX</h2>
          <input
            value={unstakeAmount}
            onChange={(e) => setUnstakeAmount(e.target.value)}
            className="w-full mb-3 p-2 rounded bg-black border border-gray-700"
            placeholder="Amount"
          />
          <button
            onClick={doUnstake}
            disabled={loading}
            className="w-full p-3 mt-1 bg-orange-500 rounded-lg"
          >
            Unstake (auto-claims rewards)
          </button>

          <p className="text-xs mt-3 text-gray-400">
            Note: To manually trigger claim without separate claim function, simply
            stake/unstake a tiny amount (e.g. 0.0001 AfroX).
          </p>
        </div>
      </div>

      {/* Token Analytics */}
      <div className="bg-gray-900 p-4 rounded-xl mb-8">
        <h2 className="text-lg font-semibold mb-4">Token Analytics</h2>

        {tokenStats ? (
          <div className="space-y-2 text-gray-300">
            <p><strong>Maximum Supply:</strong> {tokenStats.maxSupply}</p>
            <p><strong>Current Total Supply:</strong> {tokenStats.totalSupply}</p>
            <p><strong>Total Stake Reward Minted:</strong> {tokenStats.minted}</p>
            <p><strong>Un-minted AfroX:</strong> {tokenStats.unminted}</p>

            <div className="mt-4">
              <a href="https://etherscan.io/token/0x08130635368AA28b217a4dfb68E1bF8dC525621C" target="_blank" className="text-blue-400 underline mr-4">Etherscan</a>
              <a href="https://coinmarketcap.com/currencies/afrodex" target="_blank" className="text-blue-400 underline">CoinMarketCap</a>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Loading token analytics...</p>
        )}
      </div>
    </div>
  );
}
