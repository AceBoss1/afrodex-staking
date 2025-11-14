export const STAKING_ABI = [
  // --- Events ---
  { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Approval", "type": "event" },

  { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" } ], "name": "Transfer", "type": "event" },

  // --- ERC-20 ---
  { "constant": true, "inputs": [ { "internalType": "address", "name": "account", "type": "address" } ], "name": "balanceOf", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },

  { "constant": true, "inputs": [], "name": "decimals", "outputs": [ { "internalType": "uint8", "name": "", "type": "uint8" } ], "stateMutability": "view", "type": "function" },

  // --- Staking Core ---
  { "constant": false, "inputs": [ { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "stake", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" },

  { "constant": false, "inputs": [ { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "unstake", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "nonpayable", "type": "function" },

  { "constant": true, "inputs": [ { "internalType": "address", "name": "account", "type": "address" } ], "name": "viewStakeInfoOf", "outputs": [
      { "internalType": "uint256", "name": "stakeBalance", "type": "uint256" },
      { "internalType": "uint256", "name": "rewardValue", "type": "uint256" },
      { "internalType": "uint256", "name": "lastUnstakeTimestamp", "type": "uint256" },
      { "internalType": "uint256", "name": "lastRewardTimestamp", "type": "uint256" }
  ], "stateMutability": "view", "type": "function" },

  // --- Rates ---
  { "constant": true, "inputs": [], "name": "rewardRate", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },

  { "constant": true, "inputs": [], "name": "bonusRate", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },

  { "constant": true, "inputs": [], "name": "stakeRewardPeriod", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },

  { "constant": true, "inputs": [], "name": "stakeBonusPeriod", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
];
