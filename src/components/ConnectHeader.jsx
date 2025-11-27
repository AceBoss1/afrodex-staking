'use client';


import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';


export default function ConnectHeader() {
return (
<header className="w-full py-8">
<div className="max-w-6xl mx-auto px-6 text-center">


<h2 className="text-lg text-gray-300 mb-4">
DeFi Powered by AfroDex Community of Trust & AfroDex Ambassadors
</h2>


<div className="flex items-center justify-center my-2">
<ConnectButton />
</div>

</header>
);
}
