'''Updated Wallet Balance Functions

// -----------------------------
// READ FUNCTIONS (Updated)
// -----------------------------
async function loadTokenBalance() {
  if (!publicClient || !address) return;

  const bal = await readContractSafe(publicClient, {
    address: TOKEN_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'balanceOf',
    args: [address],
  });

  if (bal !== null) setTokenBalance(bal.toString());
}

async function loadDecimals() {
  const d = await readContractSafe(publicClient, {
    address: TOKEN_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'decimals',
    args: [],
  });

  if (d !== null) setDecimals(Number(d));
}

// Insert loadTokenBalance + loadDecimals into the main lifecycle:
// useEffect(() => {
//   if (!isConnected) return;
//   loadDecimals();
//   loadTokenBalance();
//   loadStakeInfo();
// }, [isConnected, address]);

// useEffect(() => {
//   if (!isConnected) return;
//   const t = setInterval(() => {
//     loadStakeInfo();
//     loadTokenBalance();
//   }, 20000);
//   return () => clearInterval(t);
// }, [isConnected]);
'''}]}
