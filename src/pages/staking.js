import dynamic from 'next/dynamic';
import ConnectHeader from '../components/ConnectHeader';

const AfrodexStaking = dynamic(
  () => import('../components/AfrodexStaking'),
  { ssr: false }
);

export default function StakingPage() {
  return (
    <>
      <ConnectHeader />
      <AfrodexStaking />
    </>
  );
}
