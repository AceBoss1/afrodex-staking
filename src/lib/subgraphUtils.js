// src/lib/subgraphUtils.js

/**
 * The Graph Subgraph Integration Utilities
 * 
 * These functions query The Graph's free API to fetch LP token data
 * from various DEXs (Uniswap, SushiSwap, etc.)
 */

// Subgraph endpoints (all FREE to use!)
export const SUBGRAPH_ENDPOINTS = {
  // Ethereum Mainnet
  uniswapV2: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  uniswapV3: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  sushiswap: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
  
  // BSC (if you deploy there)
  pancakeswap: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange',
  
  // Polygon (if you deploy there)
  quickswap: 'https://api.thegraph.com/subgraphs/name/sameepsi/quickswap06',
};

/**
 * Fetch all LP positions for a user containing a specific token (AfroX)
 * 
 * @param {string} userAddress - User's wallet address
 * @param {string} tokenAddress - AfroX token address
 * @param {string} subgraphUrl - The Graph subgraph URL
 * @returns {Promise<Array>} Array of LP positions
 */
export async function fetchLPPositionsFromSubgraph(
  userAddress,
  tokenAddress,
  subgraphUrl
) {
  const query = `
    query GetUserLPPositions($user: String!, $token: String!) {
      liquidityPositions(
        where: { 
          user: $user
          liquidityTokenBalance_gt: "0"
        }
        first: 100
        orderBy: liquidityTokenBalance
        orderDirection: desc
      ) {
        id
        liquidityTokenBalance
        pair {
          id
          token0 {
            id
            symbol
            name
            decimals
          }
          token1 {
            id
            symbol
            name
            decimals
          }
          reserve0
          reserve1
          totalSupply
          reserveUSD
        }
      }
    }
  `;

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          user: userAddress.toLowerCase(),
          token: tokenAddress.toLowerCase()
        }
      })
    });

    const { data, errors } = await response.json();

    if (errors) {
      console.error('Subgraph query errors:', errors);
      return [];
    }

    // Filter for pairs containing the specified token (AfroX)
    const filteredPositions = data?.liquidityPositions?.filter(pos => 
      pos.pair.token0.id.toLowerCase() === tokenAddress.toLowerCase() ||
      pos.pair.token1.id.toLowerCase() === tokenAddress.toLowerCase()
    ) || [];

    return filteredPositions;
  } catch (error) {
    console.error('Error fetching from subgraph:', error);
    return [];
  }
}

/**
 * Fetch all AfroX LP pairs across multiple DEXs
 * 
 * @param {string} userAddress - User's wallet address
 * @param {string} afroxAddress - AfroX token address
 * @returns {Promise<Array>} Combined array of LP positions from all DEXs
 */
export async function fetchAllAfroXLPPositions(userAddress, afroxAddress) {
  const results = [];
  
  // Query all subgraphs in parallel
  const queries = Object.entries(SUBGRAPH_ENDPOINTS).map(async ([dexName, url]) => {
    try {
      const positions = await fetchLPPositionsFromSubgraph(
        userAddress,
        afroxAddress,
        url
      );
      
      return positions.map(pos => ({
        ...pos,
        dex: dexName,
        pairAddress: pos.pair.id,
        pairName: `${pos.pair.token0.symbol}-${pos.pair.token1.symbol}`,
        balance: pos.liquidityTokenBalance,
        reserveUSD: pos.pair.reserveUSD
      }));
    } catch (error) {
      console.error(`Error fetching from ${dexName}:`, error);
      return [];
    }
  });

  const allResults = await Promise.all(queries);
  
  // Flatten and return
  return allResults.flat();
}

/**
 * Get specific pair information
 * 
 * @param {string} pairAddress - LP pair contract address
 * @param {string} subgraphUrl - The Graph subgraph URL
 * @returns {Promise<Object>} Pair data
 */
export async function fetchPairInfo(pairAddress, subgraphUrl) {
  const query = `
    query GetPair($pairAddress: String!) {
      pair(id: $pairAddress) {
        id
        token0 {
          id
          symbol
          name
          decimals
        }
        token1 {
          id
          symbol
          name
          decimals
        }
        reserve0
        reserve1
        totalSupply
        reserveUSD
        volumeUSD
        txCount
      }
    }
  `;

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { pairAddress: pairAddress.toLowerCase() }
      })
    });

    const { data } = await response.json();
    return data?.pair || null;
  } catch (error) {
    console.error('Error fetching pair info:', error);
    return null;
  }
}

/**
 * Get top AfroX LP holders (for leaderboard)
 * 
 * @param {string} afroxAddress - AfroX token address
 * @param {string} subgraphUrl - The Graph subgraph URL
 * @param {number} limit - Number of top holders to fetch
 * @returns {Promise<Array>} Top LP holders
 */
export async function fetchTopLPHolders(afroxAddress, subgraphUrl, limit = 100) {
  const query = `
    query GetTopHolders($token: String!, $limit: Int!) {
      liquidityPositions(
        where: { 
          liquidityTokenBalance_gt: "0"
        }
        first: $limit
        orderBy: liquidityTokenBalance
        orderDirection: desc
      ) {
        id
        user {
          id
        }
        liquidityTokenBalance
        pair {
          id
          token0 {
            id
            symbol
          }
          token1 {
            id
            symbol
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          token: afroxAddress.toLowerCase(),
          limit
        }
      })
    });

    const { data } = await response.json();
    
    // Filter for AfroX pairs only
    const afroxHolders = data?.liquidityPositions?.filter(pos =>
      pos.pair.token0.id.toLowerCase() === afroxAddress.toLowerCase() ||
      pos.pair.token1.id.toLowerCase() === afroxAddress.toLowerCase()
    ) || [];

    // Aggregate by user
    const userTotals = {};
    afroxHolders.forEach(pos => {
      const userId = pos.user.id;
      if (!userTotals[userId]) {
        userTotals[userId] = 0;
      }
      userTotals[userId] += parseFloat(pos.liquidityTokenBalance);
    });

    // Convert to array and sort
    const leaderboard = Object.entries(userTotals)
      .map(([address, balance]) => ({ address, balance }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);

    return leaderboard;
  } catch (error) {
    console.error('Error fetching top holders:', error);
    return [];
  }
}

/**
 * Calculate LP token value in USD
 * 
 * @param {Object} pairData - Pair data from subgraph
 * @param {string} lpBalance - User's LP token balance
 * @returns {number} USD value
 */
export function calculateLPValueUSD(pairData, lpBalance) {
  if (!pairData || !lpBalance) return 0;

  const userShare = parseFloat(lpBalance) / parseFloat(pairData.totalSupply);
  const totalValueUSD = parseFloat(pairData.reserveUSD);
  
  return userShare * totalValueUSD;
}

/**
 * Get historical LP data (for charts)
 * 
 * @param {string} pairAddress - LP pair address
 * @param {string} subgraphUrl - Subgraph URL
 * @returns {Promise<Array>} Historical data points
 */
export async function fetchPairDayData(pairAddress, subgraphUrl) {
  const query = `
    query GetPairDayData($pairAddress: String!) {
      pairDayDatas(
        where: { pairAddress: $pairAddress }
        first: 30
        orderBy: date
        orderDirection: desc
      ) {
        date
        reserveUSD
        dailyVolumeUSD
        totalSupply
      }
    }
  `;

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { pairAddress: pairAddress.toLowerCase() }
      })
    });

    const { data } = await response.json();
    return data?.pairDayDatas || [];
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }
}

/**
 * Example usage in your component:
 * 
 * import { fetchAllAfroXLPPositions } from '@/lib/subgraphUtils';
 * 
 * const lpPositions = await fetchAllAfroXLPPositions(
 *   userAddress,
 *   '0x...' // Your AfroX token address
 * );
 */
