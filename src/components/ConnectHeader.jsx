'use client';


import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';


export default function ConnectHeader() {
return (
<header className="w-full py-8">
<div className="max-w-6xl mx-auto px-6 text-center">


<h2 className="text-lg text-gray-300 mb-4">
Staking Powered by AfroDex Community of Trust & AfroDex Ambassadors
</h2>


<div className="flex items-center justify-center my-2">
<ConnectButton />
</div>


<h1 className="text-orange-400 text-3xl font-bold flex items-center gap-4 justify-center">
<img src="/afrodex_logoT.png" alt="T Logo" className="h-9 w-auto opacity-90" />
AfroX Staking and Minting Engine
<img src="/afrodex_logoA.png" alt="A Logo" className="h-9 w-auto opacity-90" />
</h1>


</div>
</header>
);
}
