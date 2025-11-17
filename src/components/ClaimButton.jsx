"use client";
import { useAccount, useWriteContract } from "wagmi";
import { requestClaimSignature } from "../lib/actions/requestSignature";
import ABI from "../contracts/AfroDexGovernanceReward.json";

export default function ClaimButton({ contractAddress }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  async function handleClaim() {
    if (!address) return alert("Connect wallet");

    // 1. Fetch signature & claim data from backend
    const data = await requestClaimSignature(address);

    const { amount, nonce, signature } = data;

    // 2. Call manualClaim() to withdraw tokens
    await writeContractAsync({
      address: contractAddress,
      abi: ABI,
      functionName: "manualClaim",
      args: [amount, nonce, signature],
    });

    alert("Claim successful!");
  }

  return (
    <button
      className="px-4 py-2 rounded bg-green-600 text-white"
      onClick={handleClaim}
    >
      Claim Rewards
    </button>
  );
}
