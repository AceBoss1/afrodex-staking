import '@/styles/globals.css'; // <-- ensure this file exists
import '@rainbow-me/rainbowkit/styles.css';

import { WagmiProvider, http, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const walletConnectPID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Wallet connectors (RainbowKit recommended setup)
const { wallets, connectors } = getDefaultWallets({
  appName: 'Afrodex Staking',
  projectId: walletConnectPID, // WalletConnect ID
  chains: [mainnet],
});

// Wagmi Client
const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors,
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`),
  },
});

// React Query Client
const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={[mainnet]} showRecentTransactions>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
