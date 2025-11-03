// src/components/ConnectHeader.jsx
'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function ConnectHeader() {
  return (
    <header className="w-full py-8">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-lg text-gray-300 mb-4">Staking Powered by AfroDex Communinity of Trust & AfroDex Ambassadors</h2>

        <div className="flex items-center justify-center my-2">
          <ConnectButton label="Connect Wallet" />
        </div>

<h1 className="text-orange-400 text-3xl font-bold flex items-center gap-3">
  <img src="/afrodex_logoT.png" className="h-8 w-auto" />
  AfroX Staking and Minting Engine
  <img src="/afrodex_logoA.png" className="h-8 w-auto" />
</h1>
      </div>
    </header>
  );
}
