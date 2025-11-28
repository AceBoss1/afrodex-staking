// src/components/UserGuide.jsx
// Comprehensive User Guide Component
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const SECTIONS = [
  { id: 'introduction', title: '📖 Introduction', icon: '📖' },
  { id: 'getting-started', title: '🚀 Getting Started', icon: '🚀' },
  { id: 'staking', title: '💰 AfroX Staking', icon: '💰' },
  { id: 'lp-mining', title: '⛏️ LP Mining', icon: '⛏️' },
  { id: 'afroswap', title: '🔄 AfroSwap', icon: '🔄' },
  { id: 'ambassador', title: '🤝 Ambassador Program', icon: '🤝' },
  { id: 'governance', title: '🏛️ Governance', icon: '🏛️' },
  { id: 'badge-tiers', title: '🏅 Badge Tiers', icon: '🏅' },
  { id: 'faq', title: '❓ FAQ', icon: '❓' },
  { id: 'support', title: '📞 Support', icon: '📞' },
];

export default function UserGuide() {
  const [activeSection, setActiveSection] = useState('introduction');

  const scrollToSection = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 py-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/afrodex_logoT.png" alt="AfroX" className="h-12 w-12 rounded-full" />
              <div>
                <h1 className="text-2xl font-bold text-orange-400">AfroX DeFi Hub</h1>
                <p className="text-sm text-gray-400">User Guide</p>
              </div>
            </div>
            <Link href="/" className="px-4 py-2 bg-orange-500 text-black rounded-lg font-semibold hover:bg-orange-600 transition-colors">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <nav className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-8 space-y-2">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 space-y-12">
            {/* Introduction */}
            <Section id="introduction" title="📖 Introduction">
              <p className="text-gray-300 mb-4">
                Welcome to <strong className="text-orange-400">AfroX DeFi Hub</strong> - your all-in-one decentralized finance platform for the AfroX ecosystem.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <FeatureCard icon="💰" title="Stake" description="Stake AfroX tokens and earn daily rewards" />
                <FeatureCard icon="⛏️" title="Mine" description="Lock LP tokens for additional yields" />
                <FeatureCard icon="🔄" title="Swap" description="Trade tokens using our integrated DEX" />
                <FeatureCard icon="🤝" title="Earn" description="Refer friends through ambassador program" />
                <FeatureCard icon="🏛️" title="Govern" description="Vote on community proposals" />
              </div>

              <InfoBox title="Platform Access" type="info">
                <p className="mb-2"><strong>Primary Dashboard:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><a href="https://hub.afrox.one" className="text-orange-400 hover:underline">https://hub.afrox.one</a></li>
                </ul>
                <p className="mt-3 mb-2"><strong>Alternative / Mirror Links:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><a href="https://dashboard.afrox.one" className="text-orange-400 hover:underline">https://dashboard.afrox.one</a></li>
                  <li><a href="https://app.afrox.one" className="text-orange-400 hover:underline">https://app.afrox.one</a></li>
                  <li><a href="https://defi.afrox.one" className="text-orange-400 hover:underline">https://defi.afrox.one</a></li>
                </ul>
                <p className="mt-3 text-sm text-gray-400">All links point to the same platform. Use any that works best for you.</p>
              </InfoBox>
            </Section>

            {/* Getting Started */}
            <Section id="getting-started" title="🚀 Getting Started">
              <StepGuide steps={[
                {
                  title: 'Connect Your Wallet',
                  content: 'Click the "Connect Wallet" button in the top-right corner. Select your wallet provider (MetaMask, WalletConnect, Coinbase Wallet, etc.). Approve the connection and ensure you\'re on Ethereum Mainnet.'
                },
                {
                  title: 'Get AfroX Tokens',
                  content: 'If you don\'t have AfroX tokens, click "AfroSwap" and swap ETH or other tokens for AfroX. You can also purchase from supported exchanges.'
                },
                {
                  title: 'Start Using the Platform',
                  content: 'Navigate between dashboards using the tabs: Staking, LP Mining, AfroSwap, Ambassador, and Governance.'
                }
              ]} />
            </Section>

            {/* Staking */}
            <Section id="staking" title="💰 AfroX Staking Dashboard">
              <p className="text-gray-300 mb-4">
                Stake your AfroX tokens to earn daily rewards. The longer you stake, the more you earn with bonus rates after 30 days.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Dashboard Cards</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left">Card</th>
                      <th className="px-4 py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr><td className="px-4 py-2 text-orange-400">Wallet Balance</td><td className="px-4 py-2 text-gray-300">AfroX tokens available in your wallet</td></tr>
                    <tr><td className="px-4 py-2 text-orange-400">Staked Balance</td><td className="px-4 py-2 text-gray-300">AfroX tokens currently staked</td></tr>
                    <tr><td className="px-4 py-2 text-orange-400">Accumulated Rewards</td><td className="px-4 py-2 text-gray-300">Rewards earned (auto-claimed on unstake)</td></tr>
                    <tr><td className="px-4 py-2 text-orange-400">Badge Tier</td><td className="px-4 py-2 text-gray-300">Your current tier based on staked amount</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-white mb-3">How to Stake</h3>
              <StepGuide steps={[
                { title: 'Approve (first time)', content: 'Enter amount, click "Approve", confirm in wallet' },
                { title: 'Stake', content: 'Enter amount, click "Stake", confirm transaction' },
              ]} />

              <h3 className="text-lg font-semibold text-white mb-3 mt-6">Reward Rates</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left">Period</th>
                      <th className="px-4 py-2 text-left">Base Rate</th>
                      <th className="px-4 py-2 text-left">Bonus (after 30 days)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr><td className="px-4 py-2">Daily</td><td className="px-4 py-2 text-green-400">0.6%</td><td className="px-4 py-2 text-blue-400">+0.06%</td></tr>
                    <tr><td className="px-4 py-2">Monthly</td><td className="px-4 py-2 text-green-400">~18%</td><td className="px-4 py-2 text-blue-400">+~1.8%</td></tr>
                    <tr><td className="px-4 py-2">Yearly</td><td className="px-4 py-2 text-green-400">~219%</td><td className="px-4 py-2 text-blue-400">+~21.9%</td></tr>
                  </tbody>
                </table>
              </div>

              <InfoBox title="Important Notes" type="warning">
                <ul className="list-disc list-inside space-y-2">
                  <li>Your proxy auto-claims rewards on stake/unstake</li>
                  <li>To manually trigger claim, stake/unstake a tiny amount (e.g., 0.0001 AfroX)</li>
                  <li>Reward projections are estimates - real-time rewards show in "Accumulated Rewards"</li>
                </ul>
              </InfoBox>
            </Section>

            {/* LP Mining */}
            <Section id="lp-mining" title="⛏️ LP Token Lock-Mining">
              <p className="text-gray-300 mb-4">
                Lock your Liquidity Provider (LP) tokens to earn additional mining rewards. Longer lock periods = higher APY.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Lock Duration Options</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left">Duration</th>
                      <th className="px-4 py-2 text-left">Base APY</th>
                      <th className="px-4 py-2 text-left">Instant Bonus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr><td className="px-4 py-2">30 Days</td><td className="px-4 py-2 text-green-400">10%</td><td className="px-4 py-2 text-blue-400">5%</td></tr>
                    <tr><td className="px-4 py-2">60 Days</td><td className="px-4 py-2 text-green-400">17%</td><td className="px-4 py-2 text-blue-400">5%</td></tr>
                    <tr><td className="px-4 py-2">90 Days</td><td className="px-4 py-2 text-green-400">25%</td><td className="px-4 py-2 text-blue-400">5%</td></tr>
                    <tr><td className="px-4 py-2">180 Days</td><td className="px-4 py-2 text-green-400">72%</td><td className="px-4 py-2 text-blue-400">5%</td></tr>
                    <tr><td className="px-4 py-2">365 Days</td><td className="px-4 py-2 text-green-400">155%</td><td className="px-4 py-2 text-blue-400">5%</td></tr>
                  </tbody>
                </table>
              </div>

              <InfoBox title="Early Unlock Penalty" type="error">
                If you unlock before your lock period ends, you lose <strong>50%</strong> of your remaining rewards. Instant bonus is not affected.
              </InfoBox>
            </Section>

            {/* AfroSwap */}
            <Section id="afroswap" title="🔄 AfroSwap">
              <p className="text-gray-300 mb-4">
                AfroSwap is our integrated decentralized exchange powered by Uniswap V2.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <FeatureCard icon="🔄" title="Swap" description="Instantly swap between tokens" />
                <FeatureCard icon="📊" title="Limit Orders" description="Set target price and auto-execute" />
                <FeatureCard icon="💧" title="Liquidity" description="Add/remove liquidity and earn LP tokens" />
              </div>

              <h3 className="text-lg font-semibold text-white mb-3">How to Swap</h3>
              <StepGuide steps={[
                { title: 'Select Tokens', content: 'Choose input token (e.g., ETH) and output token (e.g., AfroX)' },
                { title: 'Enter Amount', content: 'Type the amount you want to swap' },
                { title: 'Review & Confirm', content: 'Check the rate and slippage, then click "Swap"' },
              ]} />
            </Section>

            {/* Ambassador */}
            <Section id="ambassador" title="🤝 Ambassador Program">
              <p className="text-gray-300 mb-4">
                Earn commissions by referring new users to the platform through our 5-level referral system.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Commission Structure</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left">Level</th>
                      <th className="px-4 py-2 text-left">Relationship</th>
                      <th className="px-4 py-2 text-left">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr><td className="px-4 py-2">L1</td><td className="px-4 py-2 text-gray-300">Direct referral</td><td className="px-4 py-2 text-green-400">15%</td></tr>
                    <tr><td className="px-4 py-2">L2</td><td className="px-4 py-2 text-gray-300">Referral of referral</td><td className="px-4 py-2 text-green-400">12%</td></tr>
                    <tr><td className="px-4 py-2">L3</td><td className="px-4 py-2 text-gray-300">3rd level</td><td className="px-4 py-2 text-green-400">9%</td></tr>
                    <tr><td className="px-4 py-2">L4</td><td className="px-4 py-2 text-gray-300">4th level</td><td className="px-4 py-2 text-green-400">6%</td></tr>
                    <tr><td className="px-4 py-2">L5</td><td className="px-4 py-2 text-gray-300">5th level</td><td className="px-4 py-2 text-green-400">3%</td></tr>
                  </tbody>
                </table>
              </div>

              <InfoBox title="Important Rules" type="info">
                <ul className="list-disc list-inside space-y-2">
                  <li>Commission is a <strong>one-time bonus</strong> per referee (first 30 days rewards)</li>
                  <li>Commission is <strong>pending for 30 days</strong></li>
                  <li>Only <strong>claimable after 30 days</strong></li>
                  <li><strong>Forfeited</strong> if referee unstakes before 30 days</li>
                  <li>You must maintain <strong>≥1B AfroX staked</strong> to be eligible</li>
                </ul>
              </InfoBox>
            </Section>

            {/* Governance */}
            <Section id="governance" title="🏛️ Community of Trust (Governance)">
              <p className="text-gray-300 mb-4">
                Shape the future of AfroX by voting on proposals and creating new ones.
              </p>

              <h3 className="text-lg font-semibold text-white mb-3">Voting Power by Tier</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left">Tier</th>
                      <th className="px-4 py-2 text-left">Multiplier</th>
                      <th className="px-4 py-2 text-left">Can Propose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr><td className="px-4 py-2">Starter</td><td className="px-4 py-2 text-gray-500">0x</td><td className="px-4 py-2 text-red-400">No</td></tr>
                    <tr><td className="px-4 py-2">Cadet</td><td className="px-4 py-2 text-green-400">1x</td><td className="px-4 py-2 text-red-400">No</td></tr>
                    <tr><td className="px-4 py-2">Captain</td><td className="px-4 py-2 text-green-400">2x</td><td className="px-4 py-2 text-red-400">No</td></tr>
                    <tr><td className="px-4 py-2">Commander</td><td className="px-4 py-2 text-green-400">3x</td><td className="px-4 py-2 text-red-400">No</td></tr>
                    <tr><td className="px-4 py-2">General+</td><td className="px-4 py-2 text-green-400">4-5x</td><td className="px-4 py-2 text-green-400">Yes</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Badge Tiers */}
            <Section id="badge-tiers" title="🏅 Badge Tier System">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left">Tier</th>
                      <th className="px-4 py-2 text-left">Minimum Stake</th>
                      <th className="px-4 py-2 text-left">Vote Power</th>
                      <th className="px-4 py-2 text-left">Referral Levels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <tr><td className="px-4 py-2">✳️ Starter</td><td className="px-4 py-2">0</td><td className="px-4 py-2">0x</td><td className="px-4 py-2">None</td></tr>
                    <tr><td className="px-4 py-2">🔰 Cadet</td><td className="px-4 py-2">1B AfroX</td><td className="px-4 py-2">1x</td><td className="px-4 py-2">L1</td></tr>
                    <tr><td className="px-4 py-2">🔱 Captain</td><td className="px-4 py-2">10B AfroX</td><td className="px-4 py-2">2x</td><td className="px-4 py-2">L1-L2</td></tr>
                    <tr><td className="px-4 py-2">⚜️ Commander</td><td className="px-4 py-2">50B AfroX</td><td className="px-4 py-2">3x</td><td className="px-4 py-2">L1-L3</td></tr>
                    <tr><td className="px-4 py-2">⭐ General</td><td className="px-4 py-2">100B AfroX</td><td className="px-4 py-2">4x</td><td className="px-4 py-2">L1-L4</td></tr>
                    <tr><td className="px-4 py-2">〽️ Marshal</td><td className="px-4 py-2">500B AfroX</td><td className="px-4 py-2">5x</td><td className="px-4 py-2">L1-L5</td></tr>
                    <tr><td className="px-4 py-2">💠 Platinum Sentinel</td><td className="px-4 py-2">1T AfroX</td><td className="px-4 py-2">5x</td><td className="px-4 py-2">L1-L5</td></tr>
                    <tr><td className="px-4 py-2">❇️ Diamond Custodian</td><td className="px-4 py-2">10T AfroX</td><td className="px-4 py-2">5x</td><td className="px-4 py-2">L1-L5</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* FAQ */}
            <Section id="faq" title="❓ Frequently Asked Questions">
              <div className="space-y-4">
                <FAQItem question="What network does AfroX DeFi Hub use?" answer="Ethereum Mainnet" />
                <FAQItem question="Are there any platform fees?" answer="No platform fees for staking. Only standard Ethereum gas fees apply." />
                <FAQItem question="When do I receive my staking rewards?" answer="Rewards accumulate continuously and are auto-claimed when you unstake." />
                <FAQItem question="Can I stake more while already staking?" answer="Yes! You can add to your stake at any time." />
                <FAQItem question="Where do I get LP tokens?" answer="Add liquidity in AfroSwap (AfroX + ETH pair) to receive LP tokens." />
                <FAQItem question="Why is my ambassador commission pending?" answer="Commissions have a 30-day lock to ensure referees maintain their stake." />
              </div>
            </Section>

            {/* Support */}
            <Section id="support" title="📞 Contact & Support">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                  <h3 className="text-lg font-semibold text-orange-400 mb-4">📧 Email Support</h3>
                  <div className="space-y-3">
                    <a href="mailto:support@afrox.one" className="flex items-center gap-2 text-gray-300 hover:text-orange-400">
                      <span>🛠️</span> General Support: <span className="text-orange-400">support@afrox.one</span>
                    </a>
                    <a href="mailto:cot@afrox.one" className="flex items-center gap-2 text-gray-300 hover:text-orange-400">
                      <span>🏛️</span> Community of Trust: <span className="text-orange-400">cot@afrox.one</span>
                    </a>
                    <a href="mailto:ambassadors@afrox.one" className="flex items-center gap-2 text-gray-300 hover:text-orange-400">
                      <span>🤝</span> Ambassadors: <span className="text-orange-400">ambassadors@afrox.one</span>
                    </a>
                  </div>
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                  <h3 className="text-lg font-semibold text-orange-400 mb-4">💬 Community</h3>
                  <div className="space-y-3">
                    <a href="https://t.me/AfroDex" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-orange-400">
                      <span>📱</span> Telegram: <span className="text-orange-400">t.me/AfroDex</span>
                    </a>
                    <a href="https://discord.gg/5EwRguT" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-orange-400">
                      <span>💬</span> Discord: <span className="text-orange-400">discord.gg/5EwRguT</span>
                    </a>
                    <a href="https://twitter.com/AfroDex1" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300 hover:text-orange-400">
                      <span>🐦</span> Twitter: <span className="text-orange-400">@AfroDex1</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-6 bg-gray-900 rounded-xl border border-orange-500/30">
                <h3 className="text-lg font-semibold text-white mb-4">🌐 Platform Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 mb-2">Primary Dashboard:</p>
                    <a href="https://hub.afrox.one" className="text-orange-400 hover:underline">https://hub.afrox.one</a>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-2">Alternative Links:</p>
                    <ul className="space-y-1">
                      <li><a href="https://dashboard.afrox.one" className="text-orange-400 hover:underline">https://dashboard.afrox.one</a></li>
                      <li><a href="https://app.afrox.one" className="text-orange-400 hover:underline">https://app.afrox.one</a></li>
                      <li><a href="https://defi.afrox.one" className="text-orange-400 hover:underline">https://defi.afrox.one</a></li>
                    </ul>
                  </div>
                </div>
              </div>
            </Section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-400">
          <p>© 2019-Present AFRODEX. All rights reserved.</p>
          <p className="mt-2">Last Updated: November 2025 | Version 1.0</p>
        </div>
      </footer>
    </div>
  );
}

// Helper Components
function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-2xl font-bold text-white mb-6 pb-2 border-b border-gray-800">{title}</h2>
      {children}
    </section>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

function InfoBox({ title, type, children }) {
  const colors = {
    info: 'border-blue-500/50 bg-blue-500/10',
    warning: 'border-yellow-500/50 bg-yellow-500/10',
    error: 'border-red-500/50 bg-red-500/10',
  };
  return (
    <div className={`p-4 rounded-xl border ${colors[type]} my-4`}>
      <h4 className="font-semibold text-white mb-2">{title}</h4>
      <div className="text-sm text-gray-300">{children}</div>
    </div>
  );
}

function StepGuide({ steps }) {
  return (
    <div className="space-y-3 my-4">
      {steps.map((step, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-black flex items-center justify-center font-bold text-sm">
            {index + 1}
          </div>
          <div>
            <h4 className="font-semibold text-white">{step.title}</h4>
            <p className="text-sm text-gray-400">{step.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-800 transition-colors"
      >
        <span className="font-medium text-white">{question}</span>
        <span className="text-orange-400">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-3 text-sm text-gray-400">{answer}</div>
      )}
    </div>
  );
}
