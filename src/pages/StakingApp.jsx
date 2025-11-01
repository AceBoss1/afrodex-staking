import React, { useState, useEffect, useCallback, useMemo } from 'react';

// --- MOCK WEB3 DEPENDENCIES FOR PREVIEW ENVIRONMENT ---
// In your actual GitHub/Vercel deployment, you would REPLACE these mocks 
// with the real imports and ensure the application is wrapped in WagmiConfig/RainbowKitProvider.

/**
 * Mocks the viem utility formatUnits.
 * @param {bigint} value The value in its smallest unit (e.g., wei).
 * @param {number} decimals The number of decimal places.
 * @returns {string} The formatted string (e.g., "12.345 AFRODEX").
 */
const formatUnits = (value, decimals) => {
    if (value === BigInt(0)) return "0.00";
    const stringValue = String(value).padStart(decimals + 1, '0');
    const integerPart = stringValue.slice(0, -decimals) || "0";
    const fractionalPart = stringValue.slice(-decimals).substring(0, 4).replace(/0+$/, '');
    return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
};

/**
 * Mocks the viem utility parseUnits.
 * @param {string} value The human-readable string (e.g., "12.345").
 * @param {number} decimals The number of decimal places.
 * @returns {bigint} The value in its smallest unit.
 */
const parseUnits = (value, decimals) => {
    if (!value || isNaN(parseFloat(value))) return BigInt(0);
    const parts = value.split('.');
    const integer = parts[0];
    let fractional = parts.length > 1 ? parts[1] : '';
    const multiplier = BigInt(10) ** BigInt(decimals);
    let bigIntValue = BigInt(integer) * multiplier;

    if (fractional) {
        fractional = fractional.padEnd(decimals, '0').slice(0, decimals);
        bigIntValue += BigInt(fractional);
    }
    return bigIntValue;
};

// Mock wagmi hooks and components
const MOCK_ADDRESS = '0xAFROdE...F8C2';
const MOCK_TOKEN_ADDRESS = '0x08130635368AA28b217a4dfb68E1bF8dC525621C';
const MOCK_STAKING_ADDRESS = '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c';
const TOKEN_DECIMALS = 18;
const zeroBigInt = BigInt(0);

const useAccount = () => ({
    address: MOCK_ADDRESS,
    isConnected: true, // Always connected in this mock
    isDisconnected: false,
});

// Mock state representing the blockchain data fetched via useContractRead
const mockBlockchainState = {
    // 2500 AFRODEX
    stakedBalance: parseUnits("2500.00", TOKEN_DECIMALS), 
    // 5.75 AFRODEX
    rewards: parseUnits("5.75", TOKEN_DECIMALS),          
    // 15000 AFRODEX
    tokenBalance: parseUnits("15000.00", TOKEN_DECIMALS), 
    // 5M AFRODEX (High allowance to allow staking)
    allowance: parseUnits("5000000.00", TOKEN_DECIMALS),  
};

// Mock useContractRead Hook - Simulates fetching data from the blockchain
const useContractRead = ({ address, abi, functionName, args }) => {
    // Determine which "data" to return based on the function name
    let data = zeroBigInt;
    if (functionName === 'balanceOf') {
        data = mockBlockchainState.tokenBalance;
    } else if (functionName === 'stakedBalanceOf') {
        data = mockBlockchainState.stakedBalance;
    } else if (functionName === 'rewardsOf') {
        data = mockBlockchainState.rewards;
    } else if (functionName === 'allowance') {
        data = mockBlockchainState.allowance;
    }
    
    // Simulate loading delay
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, [functionName]); // Trigger effect on functionName change

    return { data, isLoading, isError: false, refetch: () => setIsLoading(true) };
};

// Mock useContractWrite Hook - Simulates writing data (transactions) to the blockchain
const useContractWrite = ({ address, abi, functionName }) => {
    const [isLoading, setIsLoading] = useState(false);
    const writeAsync = async () => {
        setIsLoading(true);
        // Simulate a transaction delay and success
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        setIsLoading(false);
        // In a real app, this would return a transaction hash
        return { hash: '0xmockTxHash123...' }; 
    };
    return { writeAsync, isLoading };
};

// Mock ConnectButton component
const ConnectButton = () => {
    const { isConnected, address } = useAccount();
    const displayAddress = isConnected ? `${address.substring(0, 6)}...${address.substring(MOCK_ADDRESS.length - 4)}` : 'Connect Wallet';

    return (
        <button 
            className="flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-full transition duration-200 shadow-md"
            onClick={() => console.log("Mock Wallet Connect Clicked")}
        >
            {isConnected ? (
                <>
                    <div className="w-2 h-2 bg-lime-400 rounded-full mr-2 animate-pulse"></div>
                    {displayAddress}
                </>
            ) : (
                'Connect Wallet (Mock)'
            )}
        </button>
    );
};
// --- END MOCK WEB3 DEPENDENCIES ---


// --- Main Application Component ---
const App = () => {
    // UI State
    const [activeTab, setActiveTab] = useState('stake');
    const [stakeAmount, setStakeAmount] = useState('');
    const [unstakeAmount, setUnstakeAmount] = useState('');
    const [alert, setAlert] = useState({ message: '', type: '', visible: false });

    // Mock Blockchain Data State (Allows us to simulate state changes)
    const [mockData, setMockData] = useState(mockBlockchainState);

    // 1. Fetch Walet and Contract Data (Mocked with useContractRead)
    const { address, isConnected } = useAccount();

    const { data: tokenBalance, isLoading: isTokenLoading, refetch: refetchBalance } = useContractRead({
        address: MOCK_TOKEN_ADDRESS,
        abi: [], // Mock ABI
        functionName: 'balanceOf',
        args: [address],
    });

    const { data: stakedBalance, isLoading: isStakedLoading, refetch: refetchStaked } = useContractRead({
        address: MOCK_STAKING_ADDRESS,
        abi: [], // Mock ABI
        functionName: 'stakedBalanceOf',
        args: [address],
    });

    const { data: rewards, isLoading: isRewardsLoading, refetch: refetchRewards } = useContractRead({
        address: MOCK_STAKING_ADDRESS,
        abi: [], // Mock ABI
        functionName: 'rewardsOf',
        args: [address],
    });

    const { data: allowance, isLoading: isAllowanceLoading, refetch: refetchAllowance } = useContractRead({
        address: MOCK_TOKEN_ADDRESS,
        abi: [], // Mock ABI
        functionName: 'allowance',
        args: [address, MOCK_STAKING_ADDRESS],
    });
    
    // Overriding fetched data with local mock state for simulation
    const currentTokenBalance = mockData.tokenBalance;
    const currentStakedBalance = mockData.stakedBalance;
    const currentRewards = mockData.rewards;
    const currentAllowance = mockData.allowance;
    const isDataLoading = isTokenLoading || isStakedLoading || isRewardsLoading || isAllowanceLoading;

    // 2. Define Transaction Handlers (Mocked with useContractWrite)
    // --- Approve Transaction ---
    const { writeAsync: writeApprove, isLoading: isApproving } = useContractWrite({
        address: MOCK_TOKEN_ADDRESS,
        abi: [],
        functionName: 'approve',
    });

    // --- Stake Transaction ---
    const { writeAsync: writeStake, isLoading: isStaking } = useContractWrite({
        address: MOCK_STAKING_ADDRESS,
        abi: [],
        functionName: 'stake',
    });

    // --- Unstake Transaction ---
    const { writeAsync: writeUnstake, isLoading: isUnstaking } = useContractWrite({
        address: MOCK_STAKING_ADDRESS,
        abi: [],
        functionName: 'unstake',
    });

    // --- Claim Transaction ---
    const { writeAsync: writeClaim, isLoading: isClaiming } = useContractWrite({
        address: MOCK_STAKING_ADDRESS,
        abi: [],
        functionName: 'claimRewards',
    });

    // Utility to show temporary alert
    const showAlert = useCallback((message, type) => {
        setAlert({ message, type, visible: true });
        setTimeout(() => setAlert(prev => ({ ...prev, visible: false })), 5000);
    }, []);

    // Helper function to update mock state after a "successful" transaction
    const updateMockState = useCallback((type, amount) => {
        const amountBigInt = parseUnits(amount, TOKEN_DECIMALS);
        
        if (type === 'approve') {
            // Mocking a successful approval for a very large amount (100M tokens)
            const approvedAmount = parseUnits("100000000.00", TOKEN_DECIMALS); 
            setMockData(prev => ({ ...prev, allowance: approvedAmount }));
            showAlert(`Mock Approval Successful! Approved ${formatUnits(approvedAmount, TOKEN_DECIMALS)} AFRODEX.`, 'success');

        } else if (type === 'stake') {
            setMockData(prev => ({
                ...prev,
                tokenBalance: prev.tokenBalance - amountBigInt,
                stakedBalance: prev.stakedBalance + amountBigInt,
            }));
            setStakeAmount('');
            showAlert(`Successfully staked ${amount} AFRODEX!`, 'success');

        } else if (type === 'unstake') {
            // Mock: Claim rewards and unstake amount
            const claimed = currentRewards;
            setMockData(prev => ({
                ...prev,
                tokenBalance: prev.tokenBalance + amountBigInt + claimed,
                stakedBalance: prev.stakedBalance - amountBigInt,
                rewards: zeroBigInt,
            }));
            setUnstakeAmount('');
            showAlert(`Successfully unstaked ${amount} AFRODEX and claimed ${formatUnits(claimed, TOKEN_DECIMALS)} rewards!`, 'success');

        } else if (type === 'claim') {
            const claimed = currentRewards;
            setMockData(prev => ({
                ...prev,
                tokenBalance: prev.tokenBalance + claimed,
                rewards: zeroBigInt,
            }));
            showAlert(`Successfully claimed ${formatUnits(claimed, TOKEN_DECIMALS)} AFRODEX!`, 'success');
        }
    }, [currentRewards, showAlert]);


    // --- Transaction Execution Functions ---

    const handleApprove = async () => {
        try {
            // Replace with: const tx = await writeApprove({ args: [MOCK_STAKING_ADDRESS, BigInt(2**256 - 1)] });
            await writeApprove(); // Mock call
            updateMockState('approve', '0');
        } catch (error) {
            showAlert('Approval failed (Mock Error).', 'error');
            console.error(error);
        }
    };

    const handleStake = async () => {
        const amountBigInt = parseUnits(stakeAmount, TOKEN_DECIMALS);
        if (amountBigInt <= zeroBigInt || amountBigInt > currentTokenBalance) {
            showAlert("Invalid amount or insufficient balance.", 'error');
            return;
        }
        if (amountBigInt > currentAllowance) {
            showAlert("Please approve enough tokens before staking.", 'error');
            return;
        }

        try {
            // Replace with: const tx = await writeStake({ args: [amountBigInt] });
            await writeStake(); // Mock call
            updateMockState('stake', stakeAmount);
        } catch (error) {
            showAlert('Staking failed (Mock Error).', 'error');
            console.error(error);
        }
    };

    const handleUnstake = async () => {
        const amountBigInt = parseUnits(unstakeAmount, TOKEN_DECIMALS);
        if (amountBigInt <= zeroBigInt || amountBigInt > currentStakedBalance) {
            showAlert("Invalid amount or insufficient staked balance.", 'error');
            return;
        }

        try {
            // Replace with: const tx = await writeUnstake({ args: [amountBigInt] });
            await writeUnstake(); // Mock call
            updateMockState('unstake', unstakeAmount);
        } catch (error) {
            showAlert('Unstaking failed (Mock Error).', 'error');
            console.error(error);
        }
    };

    const handleClaim = async () => {
        if (currentRewards === zeroBigInt) {
            showAlert("No rewards to claim.", 'error');
            return;
        }

        try {
            // Replace with: const tx = await writeClaim();
            await writeClaim(); // Mock call
            updateMockState('claim', '0');
        } catch (error) {
            showAlert('Claim failed (Mock Error).', 'error');
            console.error(error);
        }
    };


    // --- UI Logic and Eligibility ---

    const stakeAmountBigInt = useMemo(() => parseUnits(stakeAmount, TOKEN_DECIMALS), [stakeAmount]);
    const unstakeAmountBigInt = useMemo(() => parseUnits(unstakeAmount, TOKEN_DECIMALS), [unstakeAmount]);
    
    const isStakeApproved = stakeAmountBigInt <= currentAllowance;
    const canStake = stakeAmountBigInt > zeroBigInt && stakeAmountBigInt <= currentTokenBalance && isStakeApproved && !isStaking;
    const canUnstake = unstakeAmountBigInt > zeroBigInt && unstakeAmountBigInt <= currentStakedBalance && !isUnstaking;

    const isLoading = isDataLoading || isApproving || isStaking || isUnstaking || isClaiming;

    const StakeView = (
        <div id="stake-view">
            <p className="text-sm text-gray-400 mb-2">Amount to Stake (AFRODEX)</p>
            <div className="flex space-x-2 mb-4">
                <input 
                    type="number" 
                    placeholder="e.g. 1000" 
                    className="input-box flex-grow" 
                    min="0" 
                    step="0.000000000000000001"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    disabled={isLoading}
                />
                <button 
                    onClick={() => setStakeAmount(formatUnits(currentTokenBalance, TOKEN_DECIMALS))}
                    className="btn-secondary rounded-lg px-4 font-semibold text-sm"
                    disabled={isLoading}
                >
                    MAX
                </button>
            </div>
            
            <div className="mb-4 p-3 bg-orange-900/30 border border-orange-700 rounded-lg">
                <p className="text-sm text-gray-200">
                    Allowance: <span className="font-bold text-orange-400">{formatUnits(currentAllowance, TOKEN_DECIMALS)}</span> AFRODEX
                </p>
                {stakeAmountBigInt > currentAllowance ? (
                    <button 
                        onClick={handleApprove}
                        className="mt-2 w-full btn-primary rounded-lg py-2 font-semibold text-sm"
                        disabled={isApproving || !isConnected || isLoading}
                    >
                        {isApproving ? 'Approving...' : 'Approve Staking'}
                    </button>
                ) : (
                    <p className="text-xs text-lime-400 mt-2 font-semibold">
                        Allowance sufficient for staking amount.
                    </p>
                )}
            </div>

            <button 
                onClick={handleStake}
                className="w-full btn-primary rounded-lg py-3 text-lg font-bold" 
                disabled={!canStake || !isConnected || isLoading}
            >
                {isStaking ? 'Staking...' : 'Stake'}
            </button>
        </div>
    );

    const UnstakeView = (
        <div id="unstake-view">
            <p className="text-sm text-gray-400 mb-2">Amount to Unstake (AFRODEX)</p>
            <div className="flex space-x-2 mb-4">
                <input 
                    type="number" 
                    placeholder="e.g. 500" 
                    className="input-box flex-grow" 
                    min="0" 
                    step="0.000000000000000001"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    disabled={isLoading}
                />
                <button 
                    onClick={() => setUnstakeAmount(formatUnits(currentStakedBalance, TOKEN_DECIMALS))}
                    className="btn-secondary rounded-lg px-4 font-semibold text-sm"
                    disabled={isLoading}
                >
                    MAX
                </button>
            </div>
            <button 
                onClick={handleUnstake}
                className="w-full btn-primary rounded-lg py-3 text-lg font-bold"
                disabled={!canUnstake || !isConnected || isLoading}
            >
                {isUnstaking ? 'Unstaking & Claiming...' : 'Unstake'}
            </button>
        </div>
    );

    // Render logic for the Alert component
    const AlertComponent = useMemo(() => {
        if (!alert.visible) return null;
        
        const baseClasses = "p-3 mb-4 rounded-lg text-sm font-medium border";
        const successClasses = "bg-lime-900/30 text-lime-300 border-lime-700";
        const errorClasses = "bg-red-900/30 text-red-300 border-red-700";
        
        return (
            <div 
                className={`${baseClasses} ${alert.type === 'success' ? successClasses : errorClasses}`} 
                role="alert"
            >
                {alert.message}
            </div>
        );
    }, [alert]);

    return (
        <div className="p-4 md:p-8 min-h-screen flex flex-col items-center justify-center bg-gray-900">
            <style jsx global>{`
                /* Orange Color Scheme Variables (Vibrant Orange Accents) */
                :root {
                    --primary: #F97316; /* Tailwind Orange 500 */
                    --primary-dark: #EA580C; /* Tailwind Orange 600 */
                }
                body {
                    font-family: 'Inter', sans-serif;
                    background-color: #111827; /* Dark Gray 900 */
                    color: #F3F4F6; /* Light Gray 100 for crisp text */
                }
                .card {
                    background-color: #1F2937; /* Dark Gray 800 */
                    border-radius: 1rem;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
                    transition: transform 0.3s ease;
                    border: 1px solid #374151;
                }
                .btn-primary {
                    background-color: var(--primary);
                    color: black;
                    transition: background-color 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px var(--primary-dark);
                }
                .btn-primary:hover {
                    background-color: var(--primary-dark);
                    box-shadow: 0 2px var(--primary-dark);
                    transform: translateY(2px);
                }
                .btn-primary:disabled {
                    background-color: #9CA3AF;
                    color: #4B5563;
                    box-shadow: none;
                    transform: none;
                }
                .btn-secondary {
                    background-color: #374151;
                    color: #D1D5DB;
                    transition: background-color 0.2s;
                }
                .btn-secondary:hover:not(:disabled) {
                    background-color: #4B5563;
                }
                .input-box {
                    background-color: #111827;
                    color: white;
                    border: 2px solid #374151;
                    border-radius: 0.5rem;
                    padding: 0.75rem;
                    transition: border-color 0.2s;
                }
                .input-box:focus {
                    border-color: var(--primary);
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.5);
                }
                .tab-button {
                    color: #9CA3AF;
                    border-color: transparent;
                    transition: all 0.2s ease;
                }
                .tab-button:hover:not(.active) {
                    color: #E5E7EB;
                }
                .tab-button.active {
                    color: var(--primary);
                    border-bottom: 4px solid var(--primary);
                }
            `}</style>
            
            <div className="w-full max-w-2xl flex-grow">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-extrabold text-white tracking-wide">AFRODEX Staking</h1>
                    <ConnectButton />
                </header>

                {/* Staking Stats Card */}
                <div className="card p-6 mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="p-2 rounded-lg">
                        <p className="text-sm font-medium text-gray-400">Staked Balance</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            {isLoading ? '...' : formatUnits(currentStakedBalance, TOKEN_DECIMALS)} AFRODEX
                        </p>
                    </div>
                    <div className="p-2 rounded-lg">
                        <p className="text-sm font-medium text-gray-400">Rewards Earned</p>
                        <p className="text-2xl font-bold text-lime-400 mt-1">
                            {isLoading ? '...' : formatUnits(currentRewards, TOKEN_DECIMALS)} AFRODEX
                        </p>
                    </div>
                    <div className="p-2 rounded-lg">
                        <p className="text-sm font-medium text-gray-400">Wallet Balance</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            {isLoading ? '...' : formatUnits(currentTokenBalance, TOKEN_DECIMALS)} AFRODEX
                        </p>
                    </div>
                </div>

                {/* Staking/Unstaking Card */}
                <div className="card p-6 mb-8">
                    {AlertComponent}

                    <div className="flex border-b border-gray-700 mb-6">
                        <button 
                            className={`tab-button py-3 px-4 text-lg font-semibold flex-1 ${activeTab === 'stake' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('stake')}
                        >
                            Stake AFRODEX
                        </button>
                        <button 
                            className={`tab-button py-3 px-4 text-lg font-semibold flex-1 ${activeTab === 'unstake' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('unstake')}
                        >
                            Unstake AFRODEX
                        </button>
                    </div>

                    {activeTab === 'stake' ? StakeView : UnstakeView}
                </div>

                {/* Claim Rewards Card */}
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Rewards Center</h2>
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-gray-400">Claimable Rewards:</p>
                        <p className="text-3xl font-extrabold text-lime-400">
                            {isLoading ? '...' : formatUnits(currentRewards, TOKEN_DECIMALS)}
                        </p>
                    </div>

                    <div className="p-3 mb-4 rounded-lg bg-gray-700/50 border border-gray-600">
                        <p className="text-xs text-gray-400">
                            Your pending rewards are generally claimed automatically when you *Unstake*. This button executes an explicit claim transaction.
                        </p>
                    </div>
                    
                    <button 
                        onClick={handleClaim}
                        className="w-full btn-primary rounded-lg py-3 text-lg font-bold" 
                        disabled={currentRewards === zeroBigInt || isClaiming || !isConnected || isLoading}
                    >
                        {isClaiming ? 'Claiming...' : 'Claim Rewards'}
                    </button>
                </div>
            </div>

            {/* Footer with Disclaimer and Copyright */}
            <footer className="w-full max-w-2xl mt-8 text-center text-xs text-gray-400 p-4">
                <p className="font-semibold mb-2">Development Note:</p>
                <p className="mb-2">This is a mock interface using custom-defined **React components and hooks** to simulate the behavior of `wagmi` and `viem` for preview compatibility. All data is hypothetical.</p>
                <p>&copy; {new Date().getFullYear()} AFRODEX. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;
