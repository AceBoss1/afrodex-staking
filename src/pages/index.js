// src/pages/index.js
import Head from 'next/head';
import dynamic from 'next/dynamic';
import ConnectHeader from '../components/ConnectHeader';

const AfrodexStaking = dynamic(() => import('../components/AfrodexStaking'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>AfroX Staking and Minting Engine</title>
        <meta name="description" content="Stake and mint AfroX tokens to earn rewards." />
      </Head>

      <ConnectHeader />
      <AfrodexStaking />
    </>
  );
}
