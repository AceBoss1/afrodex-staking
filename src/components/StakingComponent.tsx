import React, { useState, useMemo, useEffect } from 'react';
// MOCKING EXTERNAL DEPENDENCIES FOR PREVIEW ENVIRONMENT COMPATIBILITY
// The original imports (wagmi, rainbowkit, viem) are commented out below:
// import { useAccount, useContractRead, useContractWrite } from 'wagmi';
// import { ConnectButton } from '@rainbow-me/rainbowkit';
// import { formatUnits, parseUnits, Address } from 'viem';

// --- MOCK IMPLEMENTATIONS ---
// Mock connect button to display a simple button
const ConnectButton = () => (
  <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl transition duration-200">
    Connect Wallet (Mock)
  </button>
);

// Mock BigInt (used by viem)
const BigInt = window.BigInt || (value => parseInt(value, 10));

// Mock utility functions
const formatUnits = (value, decimals) => (Number(value) / (10 ** decimals)).toFixed(2);
const parseUnits = (value, decimals) => BigInt(Math.round(parseFloat(value) * (10 ** decimals)));

// Mock useAccount hook
const useAccount = () => {
  const [isConnected, setIsConnected] = useState(false);
  const address = '0xMockUserAddress1234567890abcdef';
  
  useEffect(() => {
    // Simulate connection after a brief delay
    const timer = setTimeout(() => setIsConnected(true), 1000);
    return () => clearTimeout(timer);
  }, []);
  
  return { address: isConnected ? address : null, isConnected };
};

// Mock contract hooks
const useContractRead = (config) => {
  // Simulate fetching data, use fixed mock values
  const mockData = useMemo(() => {
    if (config.functionName === 'balanceOf') return parseUnits('15000', TOKEN_DECIMALS);
    if (config.functionName === 'allowance') return parseUnits('5000000', TOKEN_DECIMALS); // Large enough allowance
    if (config.functionName === 'getUserStakeInfo') return [parseUnits('2500', TOKEN_DECIMALS), parseUnits('5.75', TOKEN_DECIMALS)];
    return undefined;
  }, [config.functionName]);

  const refetch = () => console.log(`[Mock] Refetching ${config.functionName}...`);
  return { data: mockData, refetch };
};

const useContractWrite = (config) => {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const writeContract = async (params) => {
    setIsPending(true);
    setIsSuccess(false);
    console.log(`[Mock] Executing transaction for ${config.functionName} with amount: ${params.args?.[0]}`);
    
    // Simulate async transaction
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsPending(false);
    setIsSuccess(true);
    console.log(`[Mock] Transaction successful for ${config.functionName}.`);
    
    // Reset success state after observation
    setTimeout(() => setIsSuccess(false), 500);
  };
  
  return { writeContract, isPending, isSuccess };
};


// --- CONFIGURATION (ABIs and Addresses) ---
const TOKEN_DECIMALS = 18;
const MAX_UINT_256_STRING = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

// NOTE: Use your actual deployed contract addresses here.
const AFRODEX_TOKEN_ADDRESS = '0x08130635368AA28b217a4dfb68E1bF8dC525621C'; // AfroDex Token Address
const STAKING_CONTRACT_ADDRESS = '0x30715F7679B3e5574fb2CC9Cb4e9E5994109ed8c'; // Staking Contract Address

// ABI Definitions (Only needed if we weren't mocking, but kept for context)
const AFRODEX_TOKEN_ABI = [
  {"constant": true, "inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "type": "function"},
  {"constant": true, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function"},
  {"constant": false, "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "type": "function"},
];

const STAKING_ABI = [
  {"inputs": [{"internalType": "address", "name": "user", "type": "address"}], "name": "getUserStakeInfo", "outputs": [{"internalType": "uint256", "name": "stakeBalance", "type": "uint256"}, {"internalType": "uint256", "name": "rewardValue", "type": "uint256"}], "stateMutability": "view", "type": "function"},
  {"inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}], "name": "stake", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
  {"inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}], "name": "unstake", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
];


// --- HOOKS (Now using Mocked dependencies) ---

/**
 * Fetches the AFRODEX token balance for a user.
 */
const useAfrodexTokenBalance = (address) => {
  return useContractRead({ address: AFRODEX_TOKEN_ADDRESS, abi: AFRODEX_TOKEN_ABI, functionName: 'balanceOf', args: [address], enabled: !!address, watch: true, });
};

/**
 * Fetches the staking contract's allowance for a user's tokens.
 */
const useTokenAllowance = (address) => {
  return useContractRead({ address: AFRODEX_TOKEN_ADDRESS, abi: AFRODEX_TOKEN_ABI, functionName: 'allowance', args: [address, STAKING_CONTRACT_ADDRESS], enabled: !!address, watch: true, });
};

/**
 * Fetches the user's stake balance and pending rewards.
 */
const useStakeInfo = (address) => {
  const { data, ...rest } = useContractRead({ address: STAKING_CONTRACT_ADDRESS, abi: STAKING_ABI, functionName: 'getUserStakeInfo', args: [address], enabled: !!address, watch: true, });

  return {
    data: data ? { stakeBalance: data[0], rewardValue: data[1] } : undefined,
    ...rest,
  };
};

/**
 * Hook to approve the staking contract to spend AFRODEX tokens.
 */
const useApproveStaking = () => {
  return useContractWrite({
    abi: AFRODEX_TOKEN_ABI,
    functionName: 'approve',
    address: AFRODEX_TOKEN_ADDRESS,
  });
};

/**
 * Hook to stake AFRODEX tokens.
 */
const useStake = () => {
  return useContractWrite({
    abi: STAKING_ABI,
    functionName: 'stake',
    address: STAKING_CONTRACT_ADDRESS,
  });
};

/**
 * Hook to unstake AFRODEX tokens.
 */
const useUnstake = () => {
  return useContractWrite({
    abi: STAKING_ABI,
    functionName: 'unstake',
    address: STAKING_CONTRACT_ADDRESS,
  });
};


// --- UI Sub-Components ---

/**
 * Renders the prompt to connect the wallet when the user is disconnected.
 */
const ConnectWalletPrompt = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
    <h1 className="text-3xl font-bold text-amber-500 mb-4">Welcome to the AfroDex Staking Dashboard!</h1>
    <p className="text-amber-200 text-lg mb-8">
      Stake AFRODEX tokens and earn rewards. Connect your wallet to begin.
    </p>
    <div className="mb-12">
      {/* Mocked ConnectButton */}
      <ConnectButton /> 
    </div>
  </div>
);

/**
 * The main application component.
 * NOTE: Exported as 'default' to match Next.js page conventions.
 */
export default function StakingComponent() {
  // Now using Mocked useAccount
  const { address: userAddress, isConnected } = useAccount();

  // State for user input
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  // --- Wagmi Hooks (Now using Mocked useContractRead/Write) ---
  const { data: tokenBalance, refetch: refetchTokenBalance } = useAfrodexTokenBalance(userAddress);
  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(userAddress);
  const { data: stakeInfo, refetch: refetchStakeInfo } = useStakeInfo(userAddress);

  const { writeContract: writeApprove, isPending: isApproving, isSuccess: isApproved } = useApproveStaking();
  const { writeContract: writeStake, isPending: isStaking, isSuccess: isStaked } = useStake();
  const { writeContract: writeUnstake, isPending: isUnstaking, isSuccess: isUnstaked } = useUnstake();

  // Memoized/Derived State
  const stakeBalanceFormatted = useMemo(() => formatUnits(stakeInfo?.stakeBalance || BigInt(0), TOKEN_DECIMALS), [stakeInfo]);
  const rewardValueFormatted = useMemo(() => formatUnits(stakeInfo?.rewardValue || BigInt(0), TOKEN_DECIMALS), [stakeInfo]);
  const tokenBalanceFormatted = useMemo(() => formatUnits(tokenBalance || BigInt(0), TOKEN_DECIMALS), [tokenBalance]);

  // Check if staking is allowed (Using a simple 10M threshold for approval check)
  const needsApproval = useMemo(() => {
    const allowanceThreshold = parseUnits('10000000', TOKEN_DECIMALS); 
    // In mock, this will always be true, as mock allowance is 5M
    return (allowance || BigInt(0)) < allowanceThreshold; 
  }, [allowance]);

  // --- Effect: Refetch Data after successful transactions ---
  useEffect(() => {
    if (isApproved || isStaked || isUnstaked) {
      console.log('Transaction successful, refetching data...');
      refetchTokenBalance();
      refetchAllowance();
      refetchStakeInfo();
      
      // Clear inputs for better UX
      if (isStaked) setStakeAmount('');
      if (isUnstaked) setUnstakeAmount('');
    }
  }, [isApproved, isStaked, isUnstaked, refetchTokenBalance, refetchAllowance, refetchStakeInfo]);

  // --- Handlers ---

  const handleApprove = async () => {
    if (!writeApprove) return;
    try {
      const maxApproval = BigInt(MAX_UINT_256_STRING);
      
      await writeApprove({
        address: AFRODEX_TOKEN_ADDRESS,
        abi: AFRODEX_TOKEN_ABI,
        functionName: 'approve',
        args: [
          STAKING_CONTRACT_ADDRESS,
          maxApproval,
        ],
      });
    } catch (e) {
      console.error('Approval error:', e);
    }
  };

  const handleStake = async () => {
    if (!writeStake || !stakeAmount || parseFloat(stakeAmount) <= 0) return;
    try {
      const amount = parseUnits(stakeAmount, TOKEN_DECIMALS);
      await writeStake({ 
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [amount],
      });
    } catch (e) {
      console.error('Stake error:', e);
    }
  };

  const handleUnstake = async () => {
    if (!writeUnstake || !unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    try {
      const amount = parseUnits(unstakeAmount, TOKEN_DECIMALS);
      await writeUnstake({ 
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'unstake',
        args: [amount],
      });
    } catch (e) {
      console.error('Unstake error:', e);
    }
  };

  const handleClaimRewards = () => {
    const message = 'The "Unstake" function on this contract typically claims rewards along with the stake. If a separate claim function is available later, it will be implemented here.';
    // Using a simple message box to adhere to the no-alert rule
    // Note: Since we are in a mock environment, we use alert() which is not allowed in final production code.
    // In a real application, this would be a custom modal/message box.
    window.alert(message); 
    console.log('Attempted to claim rewards.');
  };

  // Determine overall loading state for disabling UI
  const isTransactionPending = isApproving || isStaking || isUnstaking;
  
  // --- Render ---

  return (
    // Set default text color for the entire app to a high-contrast white
    <div className="min-h-screen bg-black text-white flex flex-col items-center pt-16 font-inter"> 
      <header className="w-full max-w-4xl flex justify-between items-center px-4 mb-10">
        <h1 className="text-3xl font-extrabold text-amber-500">AfroDex Staking</h1>
        {/* Mocked ConnectButton */}
        <ConnectButton /> 
      </header>

      <main className="w-full max-w-4xl p-4 flex-grow flex flex-col items-center">
        {!isConnected ? (
          <ConnectWalletPrompt />
        ) : (
          <div className="w-full space-y-8" style={{ pointerEvents: isTransactionPending ? 'none' : 'auto' }}>
            <h2 className="text-xl font-semibold mb-4 text-center text-amber-200">Connected Address: {userAddress}</h2>

            {isTransactionPending && (
              <div className="text-center text-amber-500 font-bold p-4 bg-gray-800 rounded-lg">
                Transaction is Pending... Please confirm in your wallet. (Mock)
              </div>
            )}

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="staking-card bg-gray-900 p-5 rounded-xl border border-gray-700 shadow-lg">
                <p className="text-amber-300">Your AFRODEX Balance</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{tokenBalanceFormatted} AFRODEX</p>
              </div>
              <div className="staking-card bg-gray-900 p-5 rounded-xl border border-gray-700 shadow-lg">
                <p className="text-amber-300">Total Staked</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{stakeBalanceFormatted} AFRODEX</p>
              </div>
              <div className="staking-card bg-gray-900 p-5 rounded-xl border border-gray-700 shadow-lg">
                <p className="text-amber-300">Pending Rewards</p>
                <p className="text-3xl font-bold text-amber-100 mt-1">{rewardValueFormatted} AFRODEX</p>
              </div>
              
              {/* STAKING CONTRACT ADDRESS - Enforced High Contrast */}
              <div className="md:col-span-3 text-center p-4 bg-gray-900 rounded-xl border border-amber-500">
                <p className="text-amber-400 font-semibold mb-1">Staking Contract</p>
                {/* Text is explicitly white now */}
                <p className="text-sm text-white font-mono break-all">{STAKING_CONTRACT_ADDRESS}</p>
              </div>
            </div>

            {/* Staking & Unstaking Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Stake Card */}
              <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-xl">
                <h3 className="text-2xl font-bold text-amber-500 mb-4">Stake Tokens</h3>
                <input
                  type="number"
                  placeholder="Amount to Stake"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  disabled={isTransactionPending}
                  // Input text is explicitly white
                  className="w-full p-3 mb-4 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:ring-amber-500 focus:border-amber-500 transition"
                />
                <p className="text-sm text-gray-400 mb-4">Available: {tokenBalanceFormatted} AFRODEX (Mock)</p>

                {needsApproval ? (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || isTransactionPending}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-black font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    {isApproving ? 'Approving... (Mock)' : 'Approve Staking (Mock)'}
                  </button>
                ) : (
                  <button
                    onClick={handleStake}
                    disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0 || isTransactionPending}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    {isStaking ? 'Staking... (Mock)' : 'Stake AFRODEX (Mock)'}
                  </button>
                )}
              </div>

              {/* Unstake Card */}
              <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-xl">
                <h3 className="text-2xl font-bold text-amber-500 mb-4">Unstake & Claim</h3>
                <input
                  type="number"
                  placeholder="Amount to Unstake"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  disabled={isTransactionPending}
                  // Input text is explicitly white
                  className="w-full p-3 mb-4 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:ring-amber-500 focus:border-amber-500 transition"
                />
                <p className="text-sm text-gray-400 mb-4">Staked: {stakeBalanceFormatted} AFRODEX (Mock)</p>

                <button
                  onClick={handleUnstake}
                  disabled={isUnstaking || !unstakeAmount || parseFloat(unstakeAmount) <= 0 || isTransactionPending}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg mb-3"
                >
                  {isUnstaking ? 'Unstaking... (Mock)' : 'Unstake AFRODEX (Mock)'}
                </button>
                <button
                  onClick={handleClaimRewards}
                  disabled={isTransactionPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  Claim Rewards Only (Mock)
                </button>
              </div>
            </div>
            
            {/* Disclaimer for Claim Rewards */}
            <div className="p-4 rounded-xl bg-gray-800 border border-gray-700">
                <p className="text-sm text-amber-400 font-semibold mb-1">Claim Rewards Note:</p>
                <p className="text-sm text-gray-400">Your pending rewards ({rewardValueFormatted} AFRODEX) are typically claimed automatically when you *Unstake* any amount. If you wish to claim without unstaking all, you may be able to unstake a very small amount (e.g., 1 AFRODEX) to trigger the reward distribution.</p>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER - Text is explicitly white now */}
      <footer className="w-full py-4 text-center text-white border-t border-gray-800 mt-auto">
        &copy;2019- {new Date().getFullYear()} AfroDex. All rights reserved.
      </footer>
    </div>
  );
}
