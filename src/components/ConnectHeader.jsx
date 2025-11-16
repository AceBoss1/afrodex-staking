'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function ConnectHeader() {
  return (
    <header className="w-full py-8 bg-black border-b border-gray-800">
      <div className="max-w-6xl mx-auto text-center px-6">

        <h2 className="text-sm text-gray-300 mb-3">
          Staking Powered by AfroDex Community of Trust & AfroDex Ambassadors
        </h2>

        <div className="flex items-center justify-center my-2">
          <ConnectButton />
        </div>

        <h1 className="text-orange-400 text-3xl font-bold flex items-center justify-center gap-4 mt-4">
          <img src="/afrodex_logoT.png" alt="T Logo" className="h-9 w-auto opacity-90" />
          AfroX Staking and Minting Engine
          <img src="/afrodex_logoA.png" alt="A Logo" className="h-9 w-auto opacity-90" />
        </h1>

      </div>
    </header>
  );
}
