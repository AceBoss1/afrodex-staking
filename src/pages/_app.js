import '../styles/globals.css';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';
import { EthereumClient, w3mConnectors, w3mProvider } from '@web3modal/ethereum';
import { Web3Modal } from '@web3modal/react';


const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;


const { chains, publicClient } = configureChains(
[mainnet],
[alchemyProvider({ apiKey: alchemyKey }), publicProvider()]
);


const wagmiConfig = createConfig({
autoConnect: true,
connectors: w3mConnectors({ projectId, version: 2, chains }),
publicClient,
});


const ethereumClient = new EthereumClient(wagmiConfig, chains);


export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
</WagmiConfig>
<Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
</>
);
}
