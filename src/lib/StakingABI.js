export const STAKING_ABI = [
  {
    inputs: [{ internalType: 'address', name: '_token', type: 'address' }],
    name: 'depositToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_user', type: 'address' }],
    name: 'viewStakeInfoOf',
    outputs: [
      { internalType: 'uint256', name: 'stakeBalance', type: 'uint256' },
      { internalType: 'uint256', name: 'rewardValue', type: 'uint256' },
      { internalType: 'uint256', name: 'lastUnstakeTimestamp', type: 'uint256' },
      { internalType: 'uint256', name: 'lastRewardTimestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
