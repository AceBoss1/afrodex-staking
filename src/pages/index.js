// src/pages/index.js
import dynamic from 'next/dynamic';
import ConnectHeader from '../components/ConnectHeader';
const AfrodexStaking = dynamic(() => import('../components/AfrodexStaking'), { ssr: false });

export default function Home() {
  return (
    <>
      <ConnectHeader />
      <AfrodexStaking />
    </>
  );
}
