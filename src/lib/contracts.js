// src/lib/contracts.js
import { STAKING_ABI } from './abis/stakingAbi';

// Primary address: YOU confirmed this contract is the token + staking implementation
export const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS || '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c';
// since token is implemented in same contract, token address === staking address
export const TOKEN_ADDRESS = STAKING_ADDRESS;

// small wrappers that return null on failure (so UI doesn't crash)
export async function readContractSafe(publicClient, readArgs) {
  try {
    // readArgs example: { address, abi, functionName, args }
    return await publicClient.readContract(readArgs);
  } catch (err) {
    // console.debug('readContractSafe fail', readArgs.functionName, err?.message ?? err);
    return null;
  }
}

// walletClient: should be the object returned by useWalletClient()
// writeArgs: { address, abi, functionName, args }
export async function writeContractSafe(walletClient, writeArgs) {
  if (!walletClient) throw new Error('Wallet client not available');
  try {
    // wagmi walletClient.writeContract returns differing shapes depending on provider
    return await walletClient.writeContract(writeArgs);
  } catch (err) {
    throw err;
  }
}
