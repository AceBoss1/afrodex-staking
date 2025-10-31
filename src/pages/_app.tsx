import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';

import type { AppProps } from 'next/app';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';

// --- Environment Variables (Must be NEXT_PUBLIC_ prefix) ---
// Note: This check ensures the variables are available at runtime.
const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

if (!projectId) {
    console.error("CRITICAL ERROR: NEXT_PUBLIC_PROJECT_ID is not set. WalletConnect will fail.");
}
if (!alchemyApiKey) {
    console.error("CRITICAL ERROR: NEXT_PUBLIC_ALCHEMY_API_KEY is not set. RPC connection will be unstable.");
}

// 1. Initialize Query Client for React Query
const queryClient = new QueryClient();

// 2. Configure Wagmi and RainbowKit
const config = getDefaultConfig({
  appName: 'AfroDex Staking Platform',
  projectId: projectId || 'MISSING_PROJECT_ID', // Use fallback if missing
  chains: [
    mainnet,
    sepolia,
  ],
  // Use Alchemy transport for maximum stability if the key is available
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`),
  },
  ssr: true,
});

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({
            accentColor: '#F59E0B', 
            accentColorForeground: '#000000', 
            borderRadius: 'large',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
        >
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default MyApp;
