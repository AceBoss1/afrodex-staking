import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';

import { WagmiProvider, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { http } from 'wagmi';
import {
  injectedWallet,
  coinbaseWallet,
  walletConnectWallet,
  safeWallet
} from '@rainbow-me/rainbowkit/wallets';
import {
  connectorsForWallets,
  RainbowKitProvider,
  darkTheme
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const chains = [mainnet];

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended Wallets',
    wallets: [
      injectedWallet({ chains }),
      walletConnectWallet({ projectId: WC_PROJECT_ID, chains }),
      coinbaseWallet({ appName: 'Afrodex Staking', chains }),
      safeWallet({ chains })
    ]
  }
]);

const config = createConfig({
  chains,
  connectors,
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)
  },
  ssr: true
});

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#ff8800',
            accentColorForeground: '#000',
            borderRadius: 'large'
          })}
          coolMode
        >
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
