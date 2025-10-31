// pages/index.tsx

import Head from 'next/head';
import AfroDexStakingComponent from '../src/components/StakingComponent';

const Home = () => {
  return (
    <>
      <Head>
        <title>AfroDex Staking Platform</title>
        <meta name="description" content="Stake AFRODEX tokens and earn rewards." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* The Staking Component handles the wallet connection internally */}
      <AfroDexStakingComponent />
    </>
  );
};

export default Home;
