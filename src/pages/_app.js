// src/pages/_app.js
import '../styles/globals.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';
import { http } from 'wagmi';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const config = getDefaultConfig({
  appName: 'AfroDex Staking',
  projectId,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`)
  },
  ssr: true,
});

