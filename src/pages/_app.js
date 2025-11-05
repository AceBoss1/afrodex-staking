import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';

import { WagmiProvider, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { http } from 'wagmi';

import { RainbowKitProvider, connectorsForWallets, walletConnectWallet, coinbaseWallet, safeWallet } from '@rainbow-me/rainbowkit';
import { InjectedConnector } from '@wagmi/connectors/injected';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!ALCHEMY_KEY) console.warn("⚠️ Missing NEXT_PUBLIC_ALCHEMY_API_KEY");
if (!WC_PROJECT_ID) console.warn("⚠️ Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");

const chains = [mainnet];

const connectors = connectorsForWallets([
  {
    groupName: 'Wallets',
    wallets: [
      // ✅ Pure browser MetaMask / Brave / Coinbase extension
      {
        id: 'injected',
        name: 'Browser Wallet',
        iconUrl: async () => (await import('@rainbow-me/rainbowkit/assets/wallet.svg')).default,
        iconBackground: '#fff',
        createConnector: () => {
          return {
            connector: new InjectedConnector({ chains })
          };
        }
      },
      walletConnectWallet({ projectId: WC_PROJECT_ID, chains }),
      coinbaseWallet({ appName: 'Afrodex Staking', chains }),
      safeWallet({ chains }),
    ]
  }
]);

const config = createConfig({
  chains,
  connectors,
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)
  },
  ssr: true,
});

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{
            blurs: {
              modalOverlay: 'blur(12px)'
            }
          }}
        >
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
