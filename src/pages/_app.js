import '../styles/globals.css';
import { WagmiConfig, configureChains, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';


const { chains, publicClient } = configureChains([mainnet], [publicProvider()]);
const { connectors } = getDefaultWallets({
appName: 'Afrodex Staking DApp',
projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
chains,
});


const wagmiConfig = createConfig({
autoConnect: true,
connectors,
publicClient,
});


export default function App({ Component, pageProps }) {
return (
<WagmiConfig config={wagmiConfig}>
<RainbowKitProvider chains={chains}>
<Component {...pageProps} />
</RainbowKitProvider>
</WagmiConfig>
);
}
