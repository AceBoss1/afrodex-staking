// src/components/ConnectHeader.jsx
'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function ConnectHeader() {
  return (
    <header className="w-full py-8">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-lg text-gray-300 mb-4">Welcome to Afrodex Staking</h2>

        <div className="flex items-center justify-center my-2">
          <ConnectButton label="Connect Wallet" />
        </div>

      <h1 className="mt-6 text-3xl md:text-4xl font-extrabold text-orange-500 pulse-flame">

          AfroX Staking Dashboard
        </h1>
      </div>
    </header>
  );
}
