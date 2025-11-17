"use client";
import useSWR from "swr";

export default function Leaderboard() {
  const { data } = useSWR("/api/leaderboard", (u) => fetch(u).then((r) => r.json()));

  if (!data) return <div>Loading...</div>;

  return (
    <div className="p-6 bg-gray-900 rounded-xl border border-gray-700">
      <h3 className="text-xl text-orange-400 mb-4">Top Ambassadors</h3>

      {data.map((row, i) => (
        <div key={i} className="flex justify-between py-2 border-b border-gray-700">
          <span className="text-gray-300">{row.wallet}</span>
          <span className="text-orange-300">{row.total_referral_stake} AfroX</span>
        </div>
      ))}
    </div>
  );
}
