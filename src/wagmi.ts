import { http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Load environment values
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';

export const wagmiConfig = getDefaultConfig({
  appName: 'AfroX Staking Dashboard',
  projectId,
  chains: [mainnet],
  ssr: true, // Required for Next.js pages router or app router hydration correctness

  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`),
  },
});

export const chains = [mainnet];
export default wagmiConfig;
