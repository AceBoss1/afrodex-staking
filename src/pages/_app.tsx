// src/pages/_app.tsx

import React from 'react';
import type { AppProps } from 'next/app';

// --- RainbowKit & Wagmi Imports ---
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
// We include common chains (mainnet and a testnet) as a robust default configuration.
import { sepolia, mainnet } from 'wagmi/chains'; 
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Global Styles Import (MANDATORY) ---
import '../styles/globals.css';

// --- Configuration ---

// 1. Initialize React Query Client
// Used by Wagmi internally for caching and fetching blockchain data
const queryClient = new QueryClient();

// 2. Configure Chains for RainbowKit/Wagmi
// NOTE: VITE_WALLETCONNECT_PROJECT_ID should be set in your .env.local file
// This is critical for mobile wallet connections (WalletConnect)
const projectId = process.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID';

const config = getDefaultConfig({
  appName: 'AfroDex Staking',
  projectId,
  chains: [
    mainnet, // Ethereum Mainnet
    sepolia, // Ethereum Testnet (Recommended for testing)
    // Add any specific EVM-compatible chain where your contract is deployed here.
  ],
  ssr: true, // Recommended for Next.js apps
});

// --- Main App Component ---
function MyApp({ Component, pageProps }: AppProps) {
  return (
    // 1. QueryClientProvider wraps the entire app
    <QueryClientProvider client={queryClient}>
      {/* 2. WagmiProvider provides the core Web3 state */}
      <WagmiProvider config={config}>
        {/* 3. RainbowKitProvider provides the connection UI and theming */}
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#F59E0B', // Deep Yellowish Orange (AfroDex Brand Color)
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
          modalSize="compact" // Use compact size for better mobile and desktop popups
        >
          {/* The Component is the current page (e.g., index.tsx) */}
          <Component {...pageProps} />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default MyApp;
