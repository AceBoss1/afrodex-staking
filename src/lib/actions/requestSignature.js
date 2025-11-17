export async function requestClaimSignature(wallet) {
  const res = await fetch("/api/claim/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet })
  });

  if (!res.ok) throw new Error("Failed to get signature");

  return await res.json(); // {wallet, amount, nonce, signature}
}
