// src/config/abis.ts

// --- Smart Contract Addresses ---

// The Staking contract address is pulled from the environment variables
export const STAKING_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS as `0x${string}`;

// NOTE: You will also need the token address (AfroDex Token) that is being staked. 
// For this example, we assume the Staking contract (0x307...) is ALSO the token, 
// based on the ABI having token functions (transfer, approve, balanceOf).
// If the token is a SEPARATE contract, you must get its address and add it here.
export const AFRODEX_TOKEN_ADDRESS = STAKING_CONTRACT_ADDRESS; 

// --- Staking and Token ABI (Simplified) ---
// This includes functions for token interaction (balanceOf, approve) and staking (stake, unstake, viewStakeInfoOf)
export const STAKING_ABI = [
  // Token Read: balanceOf(address account) returns (uint256)
  {
    "constant": true,
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  // Token Write: approve(address spender, uint256 amount) returns (bool)
  {
    "constant": false,
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Token Read: allowance(address owner, address spender) returns (uint256)
  {
      "constant": true,
      "inputs": [
        {"internalType": "address", "name": "owner", "type": "address"},
        {"internalType": "address", "name": "spender", "type": "address"}
      ],
      "name": "allowance",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
  },
  // Staking Write: stake(uint256 amount) returns (bool)
  {
    "constant": false,
    "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "stake",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Staking Write: unstake(uint256 amount) returns (bool)
  {
    "constant": false,
    "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
    "name": "unstake",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Staking Read: viewStakeInfoOf(address account) returns (uint256 stakeBalance, uint256 rewardValue, uint256 lastUnstakeTimestamp, uint256 lastRewardTimestamp)
  {
    "constant": true,
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "viewStakeInfoOf",
    "outputs": [
      {"internalType": "uint256", "name": "stakeBalance", "type": "uint256"},
      {"internalType": "uint256", "name": "rewardValue", "type": "uint256"},
      {"internalType": "uint256", "name": "lastUnstakeTimestamp", "type": "uint256"},
      {"internalType": "uint256", "name": "lastRewardTimestamp", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
