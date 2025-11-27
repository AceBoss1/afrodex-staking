// src/app/page.js
// Root page that renders AfrodexStaking component
// Handles all tab routing via query params (?tab=lp-mining, ?tab=governance, etc.)

import AfrodexStaking from '../components/AfrodexStaking';

export const metadata = {
  title: 'AfroX DeFi Hub | Stake, Mint, Mine, Swap, Earn & Govern',
  description: 'AfroX DeFi Hub - Stake AfroX tokens, Mine LP rewards, Swap tokens, Earn governance rewards, and participate in Community of Trust governance.',
  keywords: 'AfroX, DeFi, Staking, LP Mining, Swap, Governance, Blockchain, Crypto',
  openGraph: {
    title: 'AfroX DeFi Hub | Stake, Mint, Mine, Swap, Earn & Govern',
    description: 'Your all-in-one DeFi platform for AfroX ecosystem',
    type: 'website',
  },
};

export default function Home() {
  return <AfrodexStaking />;
}
