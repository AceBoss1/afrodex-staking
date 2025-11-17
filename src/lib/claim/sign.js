// pages/api/claim/sign.js
import { supabase } from "../../../lib/supabase";
import { generateClaimSignature } from "../../../lib/signer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: "Missing wallet" });

    // Load pending claim data for that wallet
    const { data, error } = await supabase
      .from("claim_queue")
      .select("*")
      .eq("wallet", wallet)
      .eq("status", "pending")
      .single();

    if (error || !data)
      return res.status(404).json({ error: "No pending rewards" });

    const { amount, nonce, chain_id, contract_address } = data;

    // Generate signed claim authorization
    const { signature } = await generateClaimSignature({
      chainId: chain_id,
      contractAddress: contract_address,
      claimant: wallet,
      amount,
      nonce
    });

    // Save "issued" status
    await supabase
      .from("claim_queue")
      .update({ status: "issued", signature })
      .eq("wallet", wallet);

    return res.status(200).json({
      wallet,
      amount,
      nonce,
      signature
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal error" });
  }
}
