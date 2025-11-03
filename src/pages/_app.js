// src/pages/_app.js

import '../styles/globals.css'; // ✅ Local file, relative import (fixes build)
import '@rainbow-me/rainbowkit/styles.css'; // ✅ Package import, do not change

import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mainnet } from 'wagmi/chains';
import { http } from 'wagmi';

// 🧠 Create Wagmi + Alchemy + RainbowKit config
const wagmiConfig = getDefaultConfig({
  appName: 'AfroX Staking DApp',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
