// src/wagmi.ts
import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// ✅ Environment variables
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';

// ✅ Create the config using RainbowKit's helper
export const wagmiConfig = getDefaultConfig({
  appName: 'AfroX Staking Dashboard',
  projectId,
  chains: [mainnet],
  ssr: true, // ✅ Enables SSR-safe hydration for Next.js
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`),
  },
});

// ✅ Export for provider setup
export const chains = [mainnet];
export default wagmiConfig;
