import React, { useState, useEffect, useCallback, useMemo } from 'react';

// --- MOCK WEB3 UTILITIES (REPLACE WITH VIEM IN LIVE ENVIRONMENT) ---

const TOKEN_DECIMALS = 18;
const zeroBigInt = BigInt(0);

// Mocks the viem utility formatUnits.
const formatUnits = (value, decimals = TOKEN_DECIMALS) => {
    if (value === zeroBigInt) return "0.00";
    const stringValue = String(value).padStart(decimals + 1, '0');
    const integerPart = stringValue.slice(0, -decimals) || "0";
    const fractionalPart = stringValue.slice(-decimals).substring(0, 4).replace(/0+$/, '');
    return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
};

// Mocks the viem utility parseUnits.
const parseUnits = (value, decimals = TOKEN_DECIMALS) => {
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

// --- MOCK WEB3 HOOKS (REPLACE WITH WAGMI/RAINBOWKIT IN LIVE ENVIRONMENT) ---

const MOCK_ADDRESS = '0xAFROdE...F8C2';
const MOCK_TOKEN_ADDRESS = '0xAFRODEX_Token_Address';
const MOCK_STAKING_ADDRESS = '0xAFRODEX_Staking_Contract';

const useAccount = () => ({
    address: MOCK_ADDRESS,
    isConnected: true,
    isDisconnected: false,
});

// Mock state representing the blockchain data
const mockBlockchainInitialState = {
    stakedBalance: parseUnits("2500.00"), 
    rewards: parseUnits("5.75"),          
    tokenBalance: parseUnits("15000.00"), 
    allowance: parseUnits("5000000.00"),  
};

// Mock useContractRead Hook - returns the current local mock state
const useContractRead = ({ functionName }) => {
    const [data, setData] = useState(zeroBigInt);
    const [isLoading, setIsLoading] = useState(true);

    // This effect ensures we only load once to simulate a fetch
    useEffect(() => {
        const timer = setTimeout(() => {
            if (functionName === 'balanceOf') setData(mockBlockchainInitialState.tokenBalance);
            if (functionName === 'stakedBalanceOf') setData(mockBlockchainInitialState.stakedBalance);
            if (functionName === 'rewardsOf') setData(mockBlockchainInitialState.rewards);
            if (functionName === 'allowance') setData(mockBlockchainInitialState.allowance);
            setIsLoading(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [functionName]);

    return { data, isLoading, isError: false, refetch: () => setIsLoading(true) };
};

// Mock useContractWrite Hook - simulates a transaction delay
const useContractWrite = () => {
    const [isLoading, setIsLoading] = useState(false);
    const writeAsync = async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        setIsLoading(false);
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

// --- MAIN APPLICATION COMPONENT (DEFAULT EXPORT FOR NEXT.JS PAGES) ---

const AfroDexStakingApp = () => {
    // UI State
    const [activeTab, setActiveTab] = useState('stake');
    const [stakeAmount, setStakeAmount] = useState('');
    const [unstakeAmount, setUnstakeAmount] = useState('');
    const [alert, setAlert] = useState({ message: '', type: '', visible: false });

    // Mock Blockchain Data State (Managed locally for simulation)
    const [mockData, setMockData] = useState(mockBlockchainInitialState);

    // Replace with real Wagmi hooks when deploying
    const { address, isConnected } = useAccount();
    const { writeAsync: writeApprove, isLoading: isApproving } = useContractWrite({ functionName: 'approve' });
    const { writeAsync: writeStake, isLoading: isStaking } = useContractWrite({ functionName: 'stake' });
    const { writeAsync: writeUnstake, isLoading: isUnstaking } = useContractWrite({ functionName: 'unstake' });
    const { writeAsync: writeClaim, isLoading: isClaiming } = useContractWrite({ functionName: 'claimRewards' });

    // Data Accessors (Use local mockData for dynamic updates)
    const currentTokenBalance = mockData.tokenBalance;
    const currentStakedBalance = mockData.stakedBalance;
    const currentRewards = mockData.rewards;
    const currentAllowance = mockData.allowance;
    
    // Simulate initial loading (you can remove this once real wagmi is integrated)
    const [initialLoad, setInitialLoad] = useState(true);
    useEffect(() => {
        setTimeout(() => setInitialLoad(false), 500);
    }, []);

    const isLoading = initialLoad || isApproving || isStaking || isUnstaking || isClaiming;

    const showAlert = useCallback((message, type) => {
        setAlert({ message, type, visible: true });
        setTimeout(() => setAlert(prev => ({ ...prev, visible: false })), 5000);
    }, []);

    // Helper function to update mock state after a "successful" transaction
    const updateMockState = useCallback((type, amount) => {
        const amountBigInt = parseUnits(amount);
        
        if (type === 'approve') {
            const approvedAmount = parseUnits("100000000.00"); 
            setMockData(prev => ({ ...prev, allowance: approvedAmount }));
            showAlert(`Mock Approval Successful! Approved ${formatUnits(approvedAmount)} AFRODEX.`, 'success');
        } else if (type === 'stake') {
            setMockData(prev => ({
                ...prev,
                tokenBalance: prev.tokenBalance - amountBigInt,
                stakedBalance: prev.stakedBalance + amountBigInt,
            }));
            setStakeAmount('');
            showAlert(`Successfully staked ${amount} AFRODEX!`, 'success');
        } else if (type === 'unstake') {
            const claimed = currentRewards;
            setMockData(prev => ({
                ...prev,
                tokenBalance: prev.tokenBalance + amountBigInt + claimed,
                stakedBalance: prev.stakedBalance - amountBigInt,
                rewards: zeroBigInt,
            }));
            setUnstakeAmount('');
            showAlert(`Successfully unstaked ${amount} AFRODEX and claimed ${formatUnits(claimed)} rewards!`, 'success');
        } else if (type === 'claim') {
            const claimed = currentRewards;
            setMockData(prev => ({
                ...prev,
                tokenBalance: prev.tokenBalance + claimed,
                rewards: zeroBigInt,
            }));
            showAlert(`Successfully claimed ${formatUnits(claimed)} AFRODEX!`, 'success');
        }
    }, [currentRewards, showAlert]);


    // --- Transaction Execution Functions ---

    const handleApprove = async () => {
        try {
            // NOTE: In live wagmi, replace with: await writeApprove({ args: [MOCK_STAKING_ADDRESS, BigInt(2**256 - 1)] });
            await writeApprove(); 
            updateMockState('approve', '0');
        } catch (error) {
            showAlert('Approval failed (Mock Error).', 'error');
        }
    };

    const handleStake = async () => {
        const amountBigInt = parseUnits(stakeAmount);
        if (amountBigInt <= zeroBigInt || amountBigInt > currentTokenBalance) {
            showAlert("Invalid amount or insufficient balance.", 'error');
            return;
        }
        if (amountBigInt > currentAllowance) {
            showAlert("Please approve enough tokens before staking.", 'error');
            return;
        }

        try {
            // NOTE: In live wagmi, replace with: await writeStake({ args: [amountBigInt] });
            await writeStake(); 
            updateMockState('stake', stakeAmount);
        } catch (error) {
            showAlert('Staking failed (Mock Error).', 'error');
        }
    };

    const handleUnstake = async () => {
        const amountBigInt = parseUnits(unstakeAmount);
        if (amountBigInt <= zeroBigInt || amountBigInt > currentStakedBalance) {
            showAlert("Invalid amount or insufficient staked balance.", 'error');
            return;
        }

        try {
            // NOTE: In live wagmi, replace with: await writeUnstake({ args: [amountBigInt] });
            await writeUnstake(); 
            updateMockState('unstake', unstakeAmount);
        } catch (error) {
            showAlert('Unstaking failed (Mock Error).', 'error');
        }
    };

    const handleClaim = async () => {
        if (currentRewards === zeroBigInt) {
            showAlert("No rewards to claim.", 'error');
            return;
        }

        try {
            // NOTE: In live wagmi, replace with: await writeClaim();
            await writeClaim(); 
            updateMockState('claim', '0');
        } catch (error) {
            showAlert('Claim failed (Mock Error).', 'error');
        }
    };


    // --- UI Logic and Eligibility ---
    const stakeAmountBigInt = useMemo(() => parseUnits(stakeAmount), [stakeAmount]);
    const unstakeAmountBigInt = useMemo(() => parseUnits(unstakeAmount), [unstakeAmount]);
    
    const isStakeApproved = stakeAmountBigInt <= currentAllowance;
    const canStake = stakeAmountBigInt > zeroBigInt && stakeAmountBigInt <= currentTokenBalance && isStakeApproved && !isStaking;
    const canUnstake = unstakeAmountBigInt > zeroBigInt && unstakeAmountBigInt <= currentStakedBalance && !isUnstaking;

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
                    onClick={() => setStakeAmount(formatUnits(currentTokenBalance))}
                    className="btn-secondary rounded-lg px-4 font-semibold text-sm"
                    disabled={isLoading}
                >
                    MAX
                </button>
            </div>
            
            <div className="mb-4 p-3 bg-orange-900/30 border border-orange-700 rounded-lg">
                <p className="text-sm text-gray-200">
                    Allowance: <span className="font-bold text-orange-400">{formatUnits(currentAllowance)}</span> AFRODEX
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
                    onClick={() => setUnstakeAmount(formatUnits(currentStakedBalance))}
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
            {/* Tailwind CSS Styling Block (placed inline for single-file mandate) */}
            <style jsx global>{`
                :root {
                    --primary: #F97316;
                    --primary-dark: #EA580C;
                }
                body {
                    font-family: 'Inter', sans-serif;
                    background-color: #111827;
                    color: #F3F4F6;
                }
                .card {
                    background-color: #1F2937;
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
                .btn-primary:hover:not(:disabled) {
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
                            {isLoading ? '...' : formatUnits(currentStakedBalance)} AFRODEX
                        </p>
                    </div>
                    <div className="p-2 rounded-lg">
                        <p className="text-sm font-medium text-gray-400">Rewards Earned</p>
                        <p className="text-2xl font-bold text-lime-400 mt-1">
                            {isLoading ? '...' : formatUnits(currentRewards)} AFRODEX
                        </p>
                    </div>
                    <div className="p-2 rounded-lg">
                        <p className="text-sm font-medium text-gray-400">Wallet Balance</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            {isLoading ? '...' : formatUnits(currentTokenBalance)} AFRODEX
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
                            disabled={isLoading}
                        >
                            Stake AFRODEX
                        </button>
                        <button 
                            className={`tab-button py-3 px-4 text-lg font-semibold flex-1 ${activeTab === 'unstake' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('unstake')}
                            disabled={isLoading}
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
                            {isLoading ? '...' : formatUnits(currentRewards)}
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
                <p className="mb-2">This file is optimized for your Next.js project and Vercel deployment. It uses **mock** Web3 hooks for preview compatibility. **Replace the mock functions with real `wagmi` and `viem` imports for live deployment.**</p>
                <p>&copy; {new Date().getFullYear()} AFRODEX Finance. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default AfroDexStakingApp;
