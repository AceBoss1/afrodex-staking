"use client";
import useSWR from "swr";

export default function TierStatus({ wallet }) {
  const { data } = useSWR(`/api/tiers?wallet=${wallet}`, (u) => fetch(u).then(r => r.json()));

  if (!data) return <div>Loading...</div>;

  return (
    <div className="p-4 bg-gray-900 border border-gray-700 rounded-xl">
      <h3 className="text-lg text-orange-400">Your Tier: {data.tier}</h3>
      <p className="text-gray-400 mt-2">Eligible depth: {data.depth}</p>
      <p className="text-gray-400">L1 referrals: {data.L1Count}</p>
      <p className="text-gray-400">L2–L5 total: {data.L2_5Count}</p>
    </div>
  );
}
