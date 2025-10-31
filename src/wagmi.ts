import { createConfig, configureChains, mainnet } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { getDefaultWallets } from '@rainbow-me/rainbowkit';

// 1. Get Alchemy API Key from the environment variable
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// 2. Define chains and providers
// We use alchemyProvider and publicProvider as a fallback for robustness
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet], // The AfroDex contract is on Ethereum Mainnet
  [
    // Alchemy provider is first, using your API Key
    alchemyProvider({ apiKey: alchemyApiKey! }),
    // Public provider as a fallback
    publicProvider(),
  ]
);

// 3. Configure RainbowKit connectors
const { connectors } = getDefaultWallets({
  appName: 'AfroDex Staking Platform',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
  chains,
});

// 4. Create the final Wagmi Config
export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
});

// Export chains for RainbowKitProvider
export { chains };
