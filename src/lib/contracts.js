// src/lib/contracts.js
import { STAKING_ABI } from "@/lib/abis/stakingAbi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import { mainnet } from "wagmi/chains";

export const STAKING_ADDRESS = "YOUR_STAKING_CONTRACT_ADDRESS_HERE";

// READ CLIENT
export function stakingRead() {
  return getPublicClient({ chainId: mainnet.id });
}

// WRITE CLIENT
export async function stakingWrite() {
  return await getWalletClient({ chainId: mainnet.id });
}
