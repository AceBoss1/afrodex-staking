import '@/styles/globals.css';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { getDefaultWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { alchemyProvider } from '@wagmi/core/providers/alchemy';
import { http } from 'wagmi';

import '@rainbow-me/rainbowkit/styles.css';

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const WALLETCONNECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const { wallets } = getDefaultWallets({
  appName: 'Afrodex Staking',
  projectId: WALLETCONNECT_ID,
  chains: [mainnet],
});

// Wagmi v2 configuration
const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)
  },
  connectors: wallets,
  ssr: true, // enables server-side rendering safety
});

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  // Prevent hydration mismatch warnings when injecting RainbowKit theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={[mainnet]}
          theme={darkTheme({
            accentColor: '#ff8800',
            accentColorForeground: 'black',
            borderRadius: 'large',
            overlayBlur: 'small',
          })}
        >
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
