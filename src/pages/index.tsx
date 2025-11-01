import type { NextPage } from 'next';
import Head from 'next/head';
import AfrodexStaking from '../components/AfrodexStaking';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Afrodex Staking</title>
        <meta name="description" content="Afrodex Staking DApp" />
      </Head>

      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <h1 className="text-4xl font-extrabold text-orange-500 mb-8">
          Welcome to Afrodex Staking
        </h1>
        <AfrodexStaking />
      </main>
    </>
  );
};

export default Home;
