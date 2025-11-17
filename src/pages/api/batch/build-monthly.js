// pages/api/batch/build-monthly.js
import { supabase } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { month } = req.body;

  // Query all active users & calculate monthly amounts (this is simplified)
  const { data: claims } = await supabase
    .from("claim_queue")
    .select("wallet, amount")
    .eq("status", "pending");

  if (!claims) return res.status(500).json({ error: "query failed" });

  const grouped = {};
  claims.forEach((c) => {
    grouped[c.wallet] = (grouped[c.wallet] || 0) + Number(c.amount);
  });

  const inserts = Object.entries(grouped).map(([wallet, amount]) => ({
    wallet,
    amount: amount.toString(),
    month
  }));

  await supabase.from("monthly_rewards").insert(inserts);

  return res.json({ success: true, count: inserts.length });
}
