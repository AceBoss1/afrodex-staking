import { STAKING_ADDRESS } from "./contracts";
import { STAKING_ABI } from "@/lib/abis/stakingAbi";
import { stakingRead, stakingWrite } from "./contracts";
import { parseUnits } from "viem";

export async function getStakeInfo(address) {
  const client = stakingRead();

  return await client.readContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "viewStakeInfoOf",
    args: [address],
  });
}

export async function stakeTokens(amount, decimals = 18) {
  const wallet = await stakingWrite();
  const value = parseUnits(amount.toString(), decimals);

  return await wallet.writeContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "stake",
    args: [value],
  });
}

export async function unstakeTokens(amount, decimals = 18) {
  const wallet = await stakingWrite();
  const value = parseUnits(amount.toString(), decimals);

  return await wallet.writeContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "unstake",
    args: [value],
  });
}
