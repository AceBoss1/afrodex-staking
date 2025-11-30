// src/lib/priceUtils.js

/**
 * Fetch AfroX token price in USD
 * Uses multiple sources with fallbacks
 */

// Your AfroX token address
const AFROX_TOKEN_ADDRESS = '0x08130635368aa28b217a4dfb68e1bf8dc525621c'; // TODO: Update this
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

/**
 * Method 1: Get price from Uniswap V2 pair reserves
 * This is the most reliable method
 */
export async function getPriceFromUniswapPair(publicClient, pairAddress) {
  try {
    const PAIR_ABI = [
      'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() view returns (address)',
      'function token1() view returns (address)'
    ];

    // Get token order
    const [token0, token1, reserves] = await Promise.all([
      publicClient.readContract({
        address: pairAddress,
        abi: PAIR_ABI,
        functionName: 'token0'
      }),
      publicClient.readContract({
        address: pairAddress,
        abi: PAIR_ABI,
        functionName: 'token1'
      }),
      publicClient.readContract({
        address: pairAddress,
        abi: PAIR_ABI,
        functionName: 'getReserves'
      })
    ]);

    const reserve0 = Number(reserves[0]);
    const reserve1 = Number(reserves[1]);

    // Determine which reserve is AfroX and which is WETH
    const isAfroXToken0 = token0.toLowerCase() === AFROX_TOKEN_ADDRESS.toLowerCase();
    const afroxReserve = isAfroXToken0 ? reserve0 : reserve1;
    const wethReserve = isAfroXToken0 ? reserve1 : reserve0;

    // Get ETH price in USD
    const ethPriceUSD = await getETHPriceUSD();

    // Calculate AfroX price
    // Price = (WETH Reserve / AfroX Reserve) * ETH Price
    const afroxPriceInETH = wethReserve / afroxReserve;
    const afroxPriceUSD = afroxPriceInETH * ethPriceUSD;

    return afroxPriceUSD;
  } catch (error) {
    console.error('Error getting price from Uniswap pair:', error);
    return null;
  }
}

/**
 * Method 2: Get ETH price from Alchemy
 */
export async function getETHPriceUSD() {
  try {
    // Try Alchemy
// prices-fetch-script.js

// Replace with your Alchemy API key:
const apiKey = "NEXT_PUBLIC_ALCHEMY_API_KEY";

// Define the network and contract addresses you want to fetch prices for.
const addresses = [
  {
    network: "eth-mainnet",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" // WETH
  },
  {
    network: "eth-mainnet",
    address: "0x08130635368aa28b217a4dfb68e1bf8dc525621c" // AfroX
  }
];

async function getTokenPricesByAddress() {
  try {
    const response = await fetch('https://api.g.alchemy.com/prices/v1/tokens/by-address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ addresses })
    });

    const data = await response.json();
    console.log("Token Prices By Address:");
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

getTokenPricesByAddress();

  }
}

/**
 * Method 3: Get price from Dexscreener (shows same data as wallets)
 */
export async function getPriceFromDexscreener(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      // Get the pair with highest liquidity
      const mainPair = data.pairs.sort((a, b) => 
        parseFloat(b.liquidity.usd) - parseFloat(a.liquidity.usd)
      )[0];
      
      return {
        priceUSD: parseFloat(mainPair.priceUsd),
        priceChange24h: parseFloat(mainPair.priceChange.h24),
        volume24h: parseFloat(mainPair.volume.h24),
        liquidity: parseFloat(mainPair.liquidity.usd),
        pairAddress: mainPair.pairAddress
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching from Dexscreener:', error);
    return null;
  }
}

/**
 * Method 4: Get price from CoinGecko (if token is listed)
 */
export async function getPriceFromCoingecko(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd&include_24hr_change=true`
    );
    const data = await response.json();
    const tokenData = data[tokenAddress.toLowerCase()];
    
    if (tokenData) {
      return {
        priceUSD: tokenData.usd,
        priceChange24h: tokenData.usd_24h_change
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching from CoinGecko:', error);
    return null;
  }
}

/**
 * Main function: Get AfroX price with fallbacks
 */
export async function getAfroxPriceUSD(publicClient, pairAddress) {
  // Try multiple sources in order of reliability
  
  // 1. Try Dexscreener first (fastest, same as wallets show)
  const dexscreenerPrice = await getPriceFromDexscreener(AFROX_TOKEN_ADDRESS);
  if (dexscreenerPrice) {
    return dexscreenerPrice;
  }

  // 2. Try calculating from Uniswap reserves
  if (publicClient && pairAddress) {
    const uniswapPrice = await getPriceFromUniswapPair(publicClient, pairAddress);
    if (uniswapPrice) {
      return { priceUSD: uniswapPrice };
    }
  }

  // 3. Try CoinGecko
  const coingeckoPrice = await getPriceFromCoingecko(AFROX_TOKEN_ADDRESS);
  if (coingeckoPrice) {
    return coingeckoPrice;
  }

  // 4. Return null if all methods fail
  return null;
}

/**
 * Calculate USD value for a token amount
 */
export function calculateUSDValue(tokenAmount, priceUSD) {
  if (!tokenAmount || !priceUSD) return 0;
  return Number(tokenAmount) * priceUSD;
}

/**
 * Format USD value for display
 */
export function formatUSD(value, decimals = 2) {
  if (!value || value === 0) return '$0.00';
  
  const absValue = Math.abs(value);
  
  if (absValue >= 1e9) {
    return `$${(value / 1e9).toFixed(decimals)}B`;
  } else if (absValue >= 1e6) {
    return `$${(value / 1e6).toFixed(decimals)}M`;
  } else if (absValue >= 1e3) {
    return `$${(value / 1e3).toFixed(decimals)}K`;
  } else {
    return `$${value.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })}`;
  }
}

/**
 * Hook for React components to use price data
 */
export function useAfroxPrice(publicClient, pairAddress) {
  const [priceData, setPriceData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function fetchPrice() {
      setLoading(true);
      const data = await getAfroxPriceUSD(publicClient, pairAddress);
      if (mounted) {
        setPriceData(data);
        setLoading(false);
      }
    }

    fetchPrice();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPrice, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [publicClient, pairAddress]);

  return { priceData, loading };
}

/**
 * Example usage:
 * 
 * import { getAfroxPriceUSD, formatUSD, calculateUSDValue } from '@/lib/priceUtils';
 * 
 * const priceData = await getAfroxPriceUSD(publicClient, PAIR_ADDRESS);
 * console.log(`AfroX Price: ${formatUSD(priceData.priceUSD)}`);
 * 
 * const usdValue = calculateUSDValue(stakedBalance, priceData.priceUSD);
 * console.log(`Staked Value: ${formatUSD(usdValue)}`);
 */
