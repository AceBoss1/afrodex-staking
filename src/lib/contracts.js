import { STAKING_ABI } from './abis';


export const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS || '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c';
export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS || STAKING_ADDRESS;


// Read wrapper returns null on failure
export async function readContractSafe(publicClient, readArgs) {
try {
return await publicClient.readContract(readArgs);
} catch (err) {
// console.debug('readContractSafe fail', readArgs?.functionName, err?.message ?? err);
return null;
}
}


// Write wrapper: attempts to use walletClient.writeContract, else throws with guidance
export async function writeContractSafe(walletClient, writeArgs) {
// writeArgs example: { address, abi, functionName, args }
if (!walletClient) throw new Error('Wallet client not available');


// Preferred API: walletClient.writeContract (wagmi/v1+ viem wrapper)
if (typeof walletClient.writeContract === 'function') {
return await walletClient.writeContract(writeArgs);
}


// Some wallet clients expose `request` (like wagmi older return shapes). We can try to build a simple eth_sendTransaction
if (typeof walletClient.request === 'function') {
// We cannot reliably build calldata here without a signer/encoder. Throw explicit error explaining the fix.
throw new Error('walletClient.request exists but writeContract() not available. Use getWalletClient() from @wagmi/core or upgrade wagmi so walletClient.writeContract is provided.');
}


throw new Error('wallet client does not support writeContract(). Use getWalletClient() or update wagmi/wallet adapter.');
}
