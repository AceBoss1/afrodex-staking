import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mainnet } from 'wagmi/chains';

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!ALCHEMY_KEY) console.warn("⚠️ Missing NEXT_PUBLIC_ALCHEMY_API_KEY");
if (!WC_PROJECT_ID) console.warn("⚠️ Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");

const { wallets, connectors } = getDefaultWallets({
  appName: 'Afrodex Staking',
  projectId: WC_PROJECT_ID,
  chains: [mainnet],
});

const config = createConfig({
  connectors,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
