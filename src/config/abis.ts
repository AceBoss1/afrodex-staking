// --- CONTRACT ADDRESSES ---
// NOTE: Please replace these with the actual addresses of your deployed contracts.
// Using placeholder addresses for now.
export const AFRODEX_TOKEN_ADDRESS = '0x08130635368AA28b217a4dfb68E1bF8dC525621C' as const;
export const STAKING_CONTRACT_ADDRESS = '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c' as const;

// --- ABIS ---

// Simplified ERC-20 ABI for essential functions: balanceOf, allowance, and approve
export const AFRODEX_TOKEN_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Simplified Staking ABI for essential functions: stake, unstake, getStakeInfo
export const STAKING_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getStakeInfo',
    outputs: [
      { internalType: 'uint256', name: 'stakeBalance', type: 'uint256' },
      { internalType: 'uint256', name: 'rewardValue', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
