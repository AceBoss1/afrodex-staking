export const stakingAbi = [
  /* Core staking user actions */
  {
    "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "stake",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "unstake",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  /* View user staking info */
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "viewStakeInfoOf",
    "outputs": [
      { "internalType": "uint256", "name": "stakeBalance", "type": "uint256" },
      { "internalType": "uint256", "name": "rewardValue", "type": "uint256" },
      { "internalType": "uint256", "name": "lastUnstakeTimestamp", "type": "uint256" },
      { "internalType": "uint256", "name": "lastRewardTimestamp", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },

  /* APR + bonus parameters */
  {
    "inputs": [],
    "name": "rewardRate",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "bonusRate",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },

  /* General protocol settings */
  {
    "inputs": [],
    "name": "stakeRewardPeriod",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "stakeBonusPeriod",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },

  /* Metadata */
  {
    "inputs": [],
    "name": "minStake",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];
