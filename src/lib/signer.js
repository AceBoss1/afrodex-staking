// lib/signer.js
import { Wallet, keccak256, toUtf8Bytes, AbiCoder, TypedDataEncoder } from "ethers";

// Your backend private key (Store in Vercel env variable!)
const PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  throw new Error("BACKEND_SIGNER_PRIVATE_KEY missing");
}

export const signer = new Wallet(PRIVATE_KEY);

// Simple helper to generate manual-claim signature
export async function generateClaimSignature({
  chainId,
  contractAddress,
  claimant,
  amount,
  nonce
}) {
  // Must match exactly the Solidity hash:
  // keccak256(abi.encodePacked(chainId, address(this), claimant, amount, nonce))

  const abiCoder = new AbiCoder();
  const packed = abiCoder.encode(
    ["uint256", "address", "address", "uint256", "uint256"],
    [chainId, contractAddress, claimant, amount, nonce]
  );

  const hash = keccak256(packed);

  // Sign the hash as an Ethereum Signed Message
  const signature = await signer.signMessage(Buffer.from(hash.slice(2), "hex"));

  return { hash, signature };
}
