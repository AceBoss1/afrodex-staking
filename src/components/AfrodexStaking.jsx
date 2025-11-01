'use client';
import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';
import { ethers } from 'ethers';
import { STAKING_ABI, AFRODEX_TOKEN_ABI } from '../lib/abis';


const stakingAddress = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS;
const tokenAddress = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS;


export default function AfrodexStaking() {
const { address, isConnected } = useAccount();
const [amount, setAmount] = useState('');


const { config: depositConfig } = usePrepareContractWrite({
address: stakingAddress,
abi: STAKING_ABI,
functionName: 'depositToken',
args: [tokenAddress, ethers.parseUnits(amount || '0', 18)],
enabled: Boolean(isConnected && amount),
});


const { write: deposit, isLoading: depositing } = useContractWrite(depositConfig);


return (
<div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
<h1 className="text-3xl font-bold mb-6">Afrodex Staking Dashboard</h1>
{isConnected ? (
<div className="w-full max-w-md p-6 bg-gray-800 rounded-2xl shadow-lg">
<input
type="number"
value={amount}
onChange={(e) => setAmount(e.target.value)}
placeholder="Amount to stake"
className="w-full mb-4 p-3 rounded bg-gray-700 text-white"
/>
<button
onClick={() => deposit?.()}
disabled={!deposit || depositing}
className="w-full py-3 rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500"
>
{depositing ? 'Staking...' : 'Stake Tokens'}
</button>
</div>
) : (
<p className="text-gray-400">Please connect your wallet to continue.</p>
)}
</div>
);
}
