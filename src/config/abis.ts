 // --- Contract ABIs ---

    // Minimal ERC-20 ABI for interacting with the AFRODEX token (balanceOf, approve)
    export const AFRODEX_TOKEN_ABI = [
        {
            "inputs": [
                { "internalType": "address", "name": "owner", "type": "address" },
                { "internalType": "address", "name": "spender", "type": "address" }
            ],
            "name": "allowance",
            "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                { "internalType": "address", "name": "spender", "type": "address" },
                { "internalType": "uint256", "name": "amount", "type": "uint256" }
            ],
            "name": "approve",
            "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
            "name": "balanceOf",
            "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "decimals",
            "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "symbol",
            "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    // Minimal Staking Contract ABI (stake, unstake, getStakeInfo)
    export const STAKING_ABI = [
        {
            "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
            "name": "getStakeInfo",
            "outputs": [
                { "internalType": "uint256", "name": "stakeBalance", "type": "uint256" },
                { "internalType": "uint256", "name": "rewardValue", "type": "uint256" }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
            "name": "stake",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
            "name": "unstake",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    // --- Contract Addresses (Loaded from Environment Variables) ---

    // The AFRODEX Token address, loaded from NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS
    export const AFRODEX_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS as `0x${string}`;

    // The Staking Contract address, loaded from NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS
    export const STAKING_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS as `0x${string}`;

    // Ensure the addresses are defined at build time (Next.js requires public env vars to start with NEXT_PUBLIC_)
    if (!AFRODEX_TOKEN_ADDRESS || !STAKING_CONTRACT_ADDRESS) {
        console.error("FATAL ERROR: Contract addresses are missing. Please ensure NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS and NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS are set in your .env.local file.");
    }
