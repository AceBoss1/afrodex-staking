// src/lib/priceUtils.js - Test each price source individually

const AFROX_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_AFRODEX_TOKEN_ADDRESS || '0x08130635368aa28b217a4dfb68e1bf8dc525621c';
const AFROX_POOL_ADDRESS = '0xeb10676a236e97e214787e6a72af44c93639ba61';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

/**
 * Option 1: CoinGecko API
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
 * Option 2: Alchemy Price API
 */
export async function getPriceFromAlchemy(tokenAddress) {
  if (!ALCHEMY_API_KEY) {
    console.warn('Alchemy API key not configured');
    return null;
  }

  try {
    const addresses = [{ network: "eth-mainnet", address: tokenAddress }];

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
 * Option 3: CoinMarketCap DEX
 */
export async function getPriceFromCMCDex() {
  try {
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
 * Option 4: GeckoTerminal API
 */
export async function getPriceFromGeckoTerminal() {
  try {
    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/eth/pools/${AFROX_POOL_ADDRESS}`
    );
    
    const data = await response.json();
    
    if (data?.data?.attributes) {
      const attrs = data.data.attributes;
      return {
        priceUSD: parseFloat(attrs.base_token_price_usd || 0),
        priceChange24h: parseFloat(attrs.price_change_percentage?.h24 || 0),
        volume24h: parseFloat(attrs.volume_usd?.h24 || 0),
        liquidity: parseFloat(attrs.reserve_in_usd || 0),
        fdv: parseFloat(attrs.fdv_usd || 0),
        marketCap: parseFloat(attrs.market_cap_usd || 0),
        source: 'GeckoTerminal'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching from GeckoTerminal:', error);
    return null;
  }
}

/**
 * Option 5: Dexscreener
 */
export async function getPriceFromDexscreener(tokenAddress) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const mainPair = data.pairs.sort((a, b) => 
        parseFloat(b.liquidity.usd) - parseFloat(a.liquidity.usd)
      )[0];
      
      return {
        priceUSD: parseFloat(mainPair.priceUsd),
        priceChange24h: parseFloat(mainPair.priceChange.h24),
        volume24h: parseFloat(mainPair.volume.h24),
        liquidity: parseFloat(mainPair.liquidity.usd),
        pairAddress: mainPair.pairAddress,
        source: 'Dexscreener'
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching from Dexscreener:', error);
    return null;
  }
}

/**
 * Option 6: Uniswap V2 on-chain calculation
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
    const afroxReserve = isAfroXToken0 ? reserve0 / 1e4 : reserve1 / 1e4;
    const wethReserve = isAfroXToken0 ? reserve1 / 1e18 : reserve0 / 1e18;

    const ethPriceUSD = await getETHPriceUSD();
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
 * Helper: Get ETH price
 */
export async function getETHPriceUSD() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    const data = await response.json();
    return data.ethereum.usd;
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return 3000;
  }
}

/**
 * ========================================
 * CHOOSE YOUR PRICE SOURCE HERE:
 * Uncomment ONLY ONE option below
 * ========================================
 */

// OPTION 1: CoinGecko (if your token is listed)
// export async function getAfroxPriceUSD(publicClient, pairAddress) {
//  const price = await getPriceFromCoinGecko(AFROX_TOKEN_ADDRESS);
//  if (price?.priceUSD) {
//     console.log('✅ Using CoinGecko:', price.priceUSD);
//     return price;
//   }
//   console.warn('❌ CoinGecko failed');
//   return null;
// }

// OPTION 2: Alchemy (requires API key)
//  export async function getAfroxPriceUSD(publicClient, pairAddress) {
//    const price = await getPriceFromAlchemy(AFROX_TOKEN_ADDRESS);
//    if (price?.priceUSD) {
//      console.log('✅ Using Alchemy:', price.priceUSD);
//      return price;
//    }
//    console.warn('❌ Alchemy failed');
//    return null;
//  }

// OPTION 3: CoinMarketCap DEX
// export async function getAfroxPriceUSD(publicClient, pairAddress) {
//   const price = await getPriceFromCMCDex();
//   if (price?.priceUSD) {
//     console.log('✅ Using CMC DEX:', price.priceUSD);
//     return price;
//   }
//   console.warn('❌ CMC DEX failed');
//   return null;
// }

// OPTION 4: GeckoTerminal
 export async function getAfroxPriceUSD(publicClient, pairAddress) {
   const price = await getPriceFromGeckoTerminal();
   if (price?.priceUSD) {
     console.log('✅ Using GeckoTerminal:', price.priceUSD);
     return price;
   }
   console.warn('❌ GeckoTerminal failed');
   return null;
 }

// OPTION 5: Dexscreener
// export async function getAfroxPriceUSD(publicClient, pairAddress) {
//   const price = await getPriceFromDexscreener(AFROX_TOKEN_ADDRESS);
//   if (price?.priceUSD) {
//     console.log('✅ Using Dexscreener:', price.priceUSD);
//     return price;
//   }
//   console.warn('❌ Dexscreener failed');
//   return null;
// }

// OPTION 6: Uniswap on-chain (requires publicClient and pairAddress)
// export async function getAfroxPriceUSD(publicClient, pairAddress) {
//   const price = await getPriceFromUniswapPair(publicClient, pairAddress);
//   if (price?.priceUSD) {
//     console.log('✅ Using Uniswap on-chain:', price.priceUSD);
//     return price;
//   }
//   console.warn('❌ Uniswap calculation failed');
//   return null;
// }

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
 * TEST ALL SOURCES - Run this to see all prices at once
 * Call from console: window.testAllPrices()
 */
if (typeof window !== 'undefined') {
  window.testAllPrices = async function() {
    console.log('🔍 Testing all price sources...\n');
    
    const results = [];
    
    const coingecko = await getPriceFromCoinGecko(AFROX_TOKEN_ADDRESS);
    results.push({ name: 'CoinGecko', price: coingecko?.priceUSD, data: coingecko });
    
    const alchemy = await getPriceFromAlchemy(AFROX_TOKEN_ADDRESS);
    results.push({ name: 'Alchemy', price: alchemy?.priceUSD, data: alchemy });
    
    const cmcDex = await getPriceFromCMCDex();
    results.push({ name: 'CMC DEX', price: cmcDex?.priceUSD, data: cmcDex });
    
    const geckoterminal = await getPriceFromGeckoTerminal();
    results.push({ name: 'GeckoTerminal', price: geckoterminal?.priceUSD, data: geckoterminal });
    
    const dexscreener = await getPriceFromDexscreener(AFROX_TOKEN_ADDRESS);
    results.push({ name: 'Dexscreener', price: dexscreener?.priceUSD, data: dexscreener });
    
    console.table(results.map(r => ({ 
      Source: r.name, 
      Price: r.price ? `$${r.price.toFixed(10)}` : '❌ Failed' 
    })));
    
    console.log('\n📊 Detailed results:', results);
    
    return results;
  };
}
