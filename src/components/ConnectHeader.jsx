// src/components/ConnectHeader.jsx
'use client';

import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function ConnectHeader() {
  return (
    <header className="w-full py-8">
      <div className="max-w-2xl mx-auto text-center">

        <p className="text-sm text-gray-300 mb-4">
          Staking Powered by AfroDex Community of Trust & AfroDex Ambassadors
        </p>

        <div className="flex items-center justify-center my-4">
          <ConnectButton label="Connect Wallet" />
        </div>

        <h1 className="text-orange-400 text-3xl font-bold flex items-center justify-center gap-4">
          <Image
            src="/afrodex_logoT.png"
            width={40}
            height={40}
            alt="AfroDex Logo Left"
            className="opacity-90"
            priority
          />

          AfroX Staking and Minting Engine

          <Image
            src="/afrodex_logoA.png"
            width={40}
            height={40}
            alt="AfroDex Logo Right"
            className="opacity-90"
            priority
          />
        </h1>

      </div>
    </header>
  );
}
