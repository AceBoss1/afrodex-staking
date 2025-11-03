import '@/styles/globals.css';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';

// ✅ Query Client for caching blockchain reads
const queryClient = new QueryClient();

// ✅ RainbowKit + Wagmi configuration (Alchemy-powered)
const config = createConfig(
  getDefaultConfig({
    appName: 'AfroDEX Staking',
    projectId: 'afrodex-staking-dapp', // any unique ID or WalletConnect projectId if using it
    chains: [mainnet],
    transports: {
      [mainnet.id]: http(
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
      ),
    },
    ssr: true, // enables server-side rendering
  })
);

export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          {/* Framer Motion wrapper for route/page animations */}
          <AnimatePresence mode="wait" initial={false}>
            <Component {...pageProps} />
          </AnimatePresence>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
