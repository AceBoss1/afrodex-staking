// pages/api/claim/add.js
import { supabase } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet, amount, chainId, contractAddress } = req.body;

  if (!wallet || !amount)
    return res.status(400).json({ error: "Missing fields" });

  // generate a new nonce for this wallet
  const nonce = Date.now(); // or sequential counter per wallet

  const { error } = await supabase.from("claim_queue").insert({
    wallet,
    amount,
    nonce,
    chain_id: chainId,
    contract_address: contractAddress,
    status: "pending"
  });

  if (error) return res.status(500).json({ error });

  return res.json({ wallet, amount, nonce });
}
