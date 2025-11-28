// src/app/guide/page.js
// User Guide page at hub.afrox.one/guide
import UserGuide from '.../components/UserGuide';

export const metadata = {
  title: 'User Guide | AfroX DeFi Hub',
  description: 'The complete guide to using AfroX DeFi Hub - Staking, LP Mining, AfroSwap, Ambassador Program, and Governance.',
};

export default function GuidePage() {
  return <UserGuide />;
}
