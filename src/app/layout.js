// src/app/layout.js
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'AfroX DeFi Hub | Stake, Mint, Mine, Swap, Earn & Govern',
  description: 'AfroX DeFi Hub - Stake AfroX tokens, Mine LP rewards, Swap tokens, Earn governance rewards, and participate in Community of Trust governance.',
  keywords: 'AfroX, DeFi, Staking, LP Mining, Swap, Governance, Blockchain, Crypto, AfroChain',
  authors: [{ name: 'AFRODEX Labs' }],
  creator: 'AFRODEX',
  publisher: 'AFRODEX',
  icons: {
    icon: '/afrodex_token.png',
    shortcut: '/afrodex_token.png',
    apple: '/afrodex_token.png',
  },
  openGraph: {
    title: 'AfroX DeFi Hub | Stake, Mint, Mine, Swap, Earn & Govern',
    description: 'Your all-in-one DeFi platform for AfroX ecosystem',
    url: 'https://hub.afrox.one',
    siteName: 'AfroX DeFi Hub',
    images: [
      {
        url: '/afrodex_logoA.png',
        width: 512,
        height: 512,
        alt: 'AfroX DeFi Hub',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AfroX DeFi Hub | Stake, Mint, Mine, Swap, Earn & Govern',
    description: 'Your all-in-one DeFi platform for AfroX ecosystem',
    images: ['/afrodex_logoA.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/afrodex_token.png" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={`${inter.className} bg-black`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
