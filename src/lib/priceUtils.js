/ src/lib/priceUtils.js - Test each price source individually

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
