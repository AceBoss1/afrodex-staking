import React from 'react';
import Head from 'next/head';
// FIX: Changed to named import { AfroDexStakingComponent } to match the component's export
import { AfroDexStakingComponent } from '../components/StakingComponent'; 

const Home = () => {
  return (
    // Applying global styles for a clean, full-screen black environment
    <div className="min-h-screen bg-black flex flex-col items-center">
      <Head>
        <title>AfroDex Staking Platform</title>
        <meta name="description" content="Stake APPROVED coins and tokens on AFRODEX and earn huge rewards." />
      </Head>

      {/* Container to center the main content on large screens */}
      <main className="w-full max-w-7xl px-4 py-8">
        <AfroDexStakingComponent />
      </main>

      {/* Simple Footer for completeness */}
      <footer className="w-full py-4 text-center text-gray-600 border-t border-gray-800 mt-auto">
        &copy;2019- {new Date().getFullYear()} AfroDex. All rights reserved.
      </footer>
    </div>
  );
};

export default Home;
