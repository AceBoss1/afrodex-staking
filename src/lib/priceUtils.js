// src/lib/priceUtils.js - Price fetching with your preferred priority order

const AFROX_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS || '0x08130635368aa28b217a4dfb68e1bf8dc525621c';
const AFROX_POOL_ADDRESS = '0xeb10676a236e97e214787e6a72af44c93639ba61';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

/**
 * Method 1: CoinGecko API (Your preferred primary source)
 */
export async function getPriceFromCoinGecko(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`
    );
    const data = await response.json();
    const tokenData = data[tokenAddress.toLowerCase()];
    
    if (tokenData && tokenData.usd) {
      return {
        priceUSD: tokenData.usd,
        priceChange24h: tokenData.usd_24h_change || 0,
        volume24h: tokenData.usd_24h_vol || 0,
        marketCap: tokenData.usd_market_cap || 0,
        source: 'CoinGecko'
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching from CoinGecko:', error);
    return null;
  }
}

/**
 * Method 2: Alchemy Price API (Second priority - your API key)
 */
export async function getPriceFromAlchemy(tokenAddress) {
  if (!ALCHEMY_API_KEY) {
    console.warn('Alchemy API key not configured');
    return null;
  }

  try {
    const addresses = [
      {
        network: "eth-mainnet",
        address: tokenAddress
      }
    ];

    const response = await fetch('https://api.g.alchemy.com/prices/v1/tokens/by-address', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ALCHEMY_API_KEY}`
      },
      body: JSON.stringify({ addresses })
    });

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const tokenData = data.data[0];
      const priceUSD = parseFloat(tokenData.prices[0]?.value || 0);
      
      if (priceUSD > 0) {
        return {
          priceUSD,
          currency: tokenData.prices[0]?.currency || 'usd',
          lastUpdated: tokenData.prices[0]?.lastUpdatedAt,
          source: 'Alchemy'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching from Alchemy:', error);
    return null;
  }
}

/**
 * Method 3: CoinMarketCap DEX API (Third priority - backup)
 * https://dex.coinmarketcap.com/token/Ethereum/0x08130635368aa28b217a4dfb68e1bf8dc525621c
 */
export async function getPriceFromCMCDex() {
  try {
    // Try the public API endpoint
    const response = await fetch(
      `https://api.coinmarketcap.com/dexer/v3/dexer/pair-info?address=${AFROX_POOL_ADDRESS}&platform=ethereum`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    const data = await response.json();
    
    if (data?.data && data.data.price) {
      return {
        priceUSD: parseFloat(data.data.price || 0),
        priceChange24h: parseFloat(data.data.priceChange24h || 0),
        volume24h: parseFloat(data.data.volume24h || 0),
        liquidity: parseFloat(data.data.liquidity || 0),
        source: 'CoinMarketCap DEX'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching from CMC DEX:', error);
    return null;
  }
}

/**
 * Method 4: Calculate from Uniswap V2 pair reserves (Fourth priority - on-chain backup)
 */
export async function getPriceFromUniswapPair(publicClient, pairAddress) {
  if (!publicClient || !pairAddress) return null;

  try {
    const PAIR_ABI = [
      { inputs: [], name: 'getReserves', outputs: [{ type: 'uint112' }, { type: 'uint112' }, { type: 'uint32' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
      { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' }
    ];

    const [token0, token1, reserves] = await Promise.all([
      publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'token0' }),
      publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'token1' }),
      publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'getReserves' })
    ]);

    const reserve0 = Number(reserves[0]);
    const reserve1 = Number(reserves[1]);

    const isAfroXToken0 = token0.toLowerCase() === AFROX_TOKEN_ADDRESS.toLowerCase();
    const afroxReserve = isAfroXToken0 ? reserve0 / 1e4 : reserve1 / 1e4; // AfroX has 4 decimals
    const wethReserve = isAfroXToken0 ? reserve1 / 1e18 : reserve0 / 1e18; // WETH has 18 decimals

    // Get ETH price
    const ethPriceUSD = await getETHPriceUSD();

    // Calculate AfroX price: (WETH Reserve / AfroX Reserve) * ETH Price
    const afroxPriceInETH = wethReserve / afroxReserve;
    const afroxPriceUSD = afroxPriceInETH * ethPriceUSD;

    if (afroxPriceUSD > 0) {
      return {
        priceUSD: afroxPriceUSD,
        priceInETH: afroxPriceInETH,
        reserves: { afrox: afroxReserve, weth: wethReserve },
        source: 'Uniswap V2 (on-chain)'
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting price from Uniswap pair:', error);
    return null;
  }
}

/**
 * Helper: Get ETH price from multiple sources
 */
export async function getETHPriceUSD() {
  // Try Alchemy first if API key available
  if (ALCHEMY_API_KEY) {
    try {
      const addresses = [{ network: "eth-mainnet", address: WETH_ADDRESS }];
      const response = await fetch('https://api.g.alchemy.com/prices/v1/tokens/by-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ALCHEMY_API_KEY}`
        },
        body: JSON.stringify({ addresses })
      });
      const data = await response.json();
      if (data.data?.[0]?.prices?.[0]?.value) {
        return parseFloat(data.data[0].prices[0].value);
      }
    } catch (error) {
      console.error('Alchemy ETH price fetch failed:', error);
    }
  }

  // Fallback to CoinGecko for ETH price
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    const data = await response.json();
    return data.ethereum.usd;
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return 3000; // Fallback default
  }
}

/**
 * MAIN FUNCTION: Get AfroX price with your preferred priority order
 * Priority: CoinGecko → Alchemy → CMC DEX → Uniswap on-chain
 */
export async function getAfroxPriceUSD(publicClient, pairAddress) {
  // 1. ✅ Try CoinGecko first (most reliable price)
  const coingeckoPrice = await getPriceFromCoinGecko(AFROX_TOKEN_ADDRESS);
  if (coingeckoPrice?.priceUSD && coingeckoPrice.priceUSD > 0) {
    console.log('✅ Using CoinGecko price:', coingeckoPrice.priceUSD);
    return coingeckoPrice;
  }

  // 2. ✅ Try Alchemy (most reliable, your API key)
  const alchemyPrice = await getPriceFromAlchemy(AFROX_TOKEN_ADDRESS);
  if (alchemyPrice?.priceUSD && alchemyPrice.priceUSD > 0) {
    console.log('✅ Using Alchemy price:', alchemyPrice.priceUSD);
    return alchemyPrice;
  }

  // 3. ✅ Try CoinMarketCap DEX (backup)
  const cmcPrice = await getPriceFromCMCDex();
  if (cmcPrice?.priceUSD && cmcPrice.priceUSD > 0) {
    console.log('✅ Using CoinMarketCap DEX price:', cmcPrice.priceUSD);
    return cmcPrice;
  }

  // 4. ✅ Try Uniswap calculation (backup)
  const uniswapPrice = await getPriceFromUniswapPair(publicClient, pairAddress);
  if (uniswapPrice?.priceUSD && uniswapPrice.priceUSD > 0) {
    console.log('✅ Using Uniswap calculated price:', uniswapPrice.priceUSD);
    return uniswapPrice;
  }

  console.warn('⚠️ All price sources failed');
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
  } else if (absValue < 0.01) {
    return `$${value.toExponential(decimals)}`;
  } else {
    return `$${value.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })}`;
  }
}

/**
 * React Hook for price data with auto-refresh
 */
export function useAfroxPrice(publicClient, pairAddress) {
  if (typeof React === 'undefined') {
    console.warn('React not available for useAfroxPrice hook');
    return { priceData: null, loading: true };
  }

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
    const interval = setInterval(fetchPrice, 30000); // Refresh every 30 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [publicClient, pairAddress]);

  return { priceData, loading };
}

/**
 * Example usage in components:
 * 
 * import { getAfroxPriceUSD, formatUSD, calculateUSDValue } from '@/lib/priceUtils';
 * 
 * // Fetch price with fallbacks
 * const priceData = await getAfroxPriceUSD(publicClient, PAIR_ADDRESS);
 * console.log('AfroX Price:', formatUSD(priceData.priceUSD));
 * console.log('Source:', priceData.source);
 * console.log('24h Change:', priceData.priceChange24h + '%');
 * 
 * // Calculate USD value
 * const usdValue = calculateUSDValue(stakedBalance, priceData.priceUSD);
 * console.log('Staked Value:', formatUSD(usdValue));
 */
