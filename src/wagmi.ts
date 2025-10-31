// src/wagmi.ts - Wagmi v2 Configuration Syntax

import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// 1. Get Environment Variables
const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// 2. Define the Alchemy RPC URL as the primary transport
// We construct the URL manually, as the provider helper is no longer used in this manner
const alchemyRpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

// 3. Create the Wagmi Config using RainbowKit's getDefaultConfig helper
// This handles connectors (MetaMask, WalletConnect, etc.) and chains
export const wagmiConfig = getDefaultConfig({
  appName: 'AfroDex Staking Platform',
  projectId: projectId || 'YOUR_FALLBACK_PROJECT_ID', // Use your actual project ID from .env.local
  chains: [mainnet],
  transports: {
    // Only use Alchemy transport for Mainnet
    [mainnet.id]: http(alchemyRpcUrl),
  },
});

// 4. Export chains for the RainbowKitProvider (if needed, but usually redundant in v2)
export const chains = wagmiConfig.chains; // Extract chains from the config
