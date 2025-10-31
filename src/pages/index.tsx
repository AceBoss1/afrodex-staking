// pages/index.tsx

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Head from 'next/head';

const Home = () => {
  return (
    <>
      <Head>
        <title>AfroDex Staking Platform</title>
      </Head>

      <main style={{ padding: '24px' }}>
        {/* The ConnectButton should still be visible and working */}
        <ConnectButton /> 
        
        {/* Your new content will go here */}
        <h1>Welcome to the AfroDex Staking Dashboard!</h1> 
        <p>Start developing your staking logic here.</p>
        
        {/* Eventually, you will import and use your custom Staking component here */}
        {/* <StakingComponent /> */} 
      </main>
    </>
  );
};

export default Home;
