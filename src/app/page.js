// src/app/page.js
'use client';

import { Suspense } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import AfrodexStaking from '../components/AfrodexStaking';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-orange-400 text-xl">Loading...</div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      {/* Connect Wallet Header */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">
            DeFi Hub Powered by AfroDex Community of Trust & AfroDex Ambassadors
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* Main App */}
      <Suspense fallback={<LoadingFallback />}>
        <AfrodexStaking />
      </Suspense>
    </div>
  );
}
