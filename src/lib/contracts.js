// src/lib/contracts.js
// Small wagmi/viem-friendly helpers for reads/writes used by AfrodexStaking
// Uses publicClient.readContract and walletClient.writeContract provided by wagmi hooks.

export const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS;

/**
 * readContract helper wrapper
 * @param {object} publicClient - returned from usePublicClient()
 * @param {object} params - { address, abi, functionName, args }
 */
export async function readContractSafe(publicClient, params) {
  if (!publicClient) throw new Error('publicClient required for readContractSafe');
  try {
    return await publicClient.readContract(params);
  } catch (err) {
    // swallow and return null so callers can fallback
    console.debug('readContractSafe error', params.functionName, err?.message ?? err);
    return null;
  }
}

/**
 * writeContractSafe wrapper
 * @param {object} walletClient - returned from useWalletClient()
 * @param {object} params - { address, abi, functionName, args }
 * returns tx object from wallet client (may be connector-specific)
 */
export async function writeContractSafe(walletClient, params) {
  if (!walletClient) throw new Error('walletClient required for writeContractSafe');
  try {
    return await walletClient.writeContract(params);
  } catch (err) {
    console.debug('writeContractSafe error', params.functionName, err?.message ?? err);
    throw err;
  }
}
