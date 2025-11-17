"use client";
import { useAccount } from "wagmi";
import TierStatus from "./TierStatus";
import ReferralLinkBox from "./ReferralLinkBox";
import ReferralSummary from "./ReferralSummary";
import ClaimButton from "./ClaimButton";

export default function AmbassadorDashboard() {
  const { address } = useAccount();

  if (!address)
    return <div className="text-center p-6 text-gray-400">Connect wallet</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      <h2 className="text-xl text-orange-400 font-bold">
        AfroDex Ambassador Dashboard
      </h2>

      <TierStatus wallet={address} />

      <ReferralLinkBox wallet={address} />

      <ReferralSummary wallet={address} />

      <ClaimButton contractAddress={process.env.NEXT_PUBLIC_REWARD_CONTRACT} />
    </div>
  );
}
