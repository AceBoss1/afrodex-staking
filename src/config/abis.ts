// --- CONSTANTS ---

/**
 * Replace these with your actual contract addresses.
 */
export const AFRODEX_TOKEN_ADDRESS = '0x08130635368AA28b217a4dfb68E1bF8dC525621C' as `0x${string}`;
export const STAKING_CONTRACT_ADDRESS = '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c' as `0x${string}`;

// --- ABIs ---

/**
 * Minimal ERC-20 ABI for `balanceOf` and `allowance`/`approve`.
 * This should be compatible with your AFRODEX Token contract.
 */
export const AFRODEX_TOKEN_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'owner' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * Minimal Staking Contract ABI for `getStakeInfo`, `stake`, and `unstake`.
 * Adjust function signatures if your contract differs.
 */
export const STAKING_ABI = [
  // getStakeInfo(address user) returns (uint256 stakeBalance, uint256 rewardValue)
  {
    type: 'function',
    name: 'getStakeInfo',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [
      { type: 'uint256', name: 'stakeBalance' },
      { type: 'uint256', name: 'rewardValue' },
    ],
  },
  // stake(uint256 amount)
  {
    type: 'function',
    name: 'stake',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'amount' }],
    outputs: [],
  },
  // unstake(uint256 amount)
  {
    type: 'function',
    name: 'unstake',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256', name: 'amount' }],
    outputs: [],
  },
] as const;
