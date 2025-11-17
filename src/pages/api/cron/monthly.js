// /pages/api/cron/monthly.js
import { supabase } from "../../../lib/supabase";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  // Trigger ONLY via Vercel Scheduler
  if (req.headers.get("x-vercel-cron") !== "1") {
    return new Response(JSON.stringify({ error: "not authorized" }), {
      status: 401,
    });
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  // 1. Fetch pending reward entries
  const { data: pending, error } = await supabase
    .from("claim_queue")
    .select("wallet, amount")
    .eq("status", "pending");

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  if (!pending.length) {
    return new Response(JSON.stringify({ ok: true, message: "No pending rewards" }));
  }

  // 2. Group by wallet
  const grouped = {};
  pending.forEach((p) => {
    grouped[p.wallet] = (grouped[p.wallet] || 0) + Number(p.amount);
  });

  // 3. Insert batch into monthly_rewards
  const rows = Object.entries(grouped).map(([wallet, amount]) => ({
    wallet,
    amount: amount.toString(),
    month,
  }));

  const { error: insertError } = await supabase
    .from("monthly_rewards")
    .insert(rows);

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError }), { status: 500 });
  }

  // 4. Mark all pending entries as "batched"
  await supabase
    .from("claim_queue")
    .update({ status: "batched" })
    .eq("status", "pending");

  return new Response(JSON.stringify({ ok: true, batch_size: rows.length }));
}
