import Head from 'next/head';
import AfrodexStaking from '../components/AfrodexStaking';

const Home: React.FC = () => {
  return (
    <>
      <Head>
        <title>Afrodex Staking</title>
      </Head>
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <h1 className="text-4xl font-extrabold text-afrodexBlue mb-8">
          Welcome to Afrodex Staking
        </h1>
        <AfrodexStaking />
      </main>
    </>
  );
};

export default Home;
