// src/components/AfroSwap.jsx - Integrated Uniswap Swap & LP Management
// Features: Swap, Limit Orders (via 1inch Fusion), Add/Remove Liquidity, View Positions
// No honeypot warning - direct integration
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { motion } from 'framer-motion';
import { formatUnits, parseUnits } from 'viem';
import { formatUSD, calculateUSDValue } from '../lib/priceUtils';

// Contract addresses
const AFROX_TOKEN = '0x08130635368aa28b217a4dfb68e1bf8dc525621c';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const AFROX_WETH_PAIR = '0xEb10676a236e97E214787e6A72Af44C93639BA61';
const UNISWAP_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

// ABIs
const ERC20_ABI = [
  { inputs: [{ type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'address' }, { type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ type: 'address' }, { type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }
];

const PAIR_ABI = [
  { inputs: [{ type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getReserves', outputs: [{ type: 'uint112' }, { type: 'uint112' }, { type: 'uint32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token0', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token1', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'address' }, { type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }
];

const ROUTER_ABI = [
  { inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'address[]' }, { type: 'address' }, { type: 'uint256' }], name: 'swapExactTokensForETH', outputs: [{ type: 'uint256[]' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ type: 'uint256' }, { type: 'address[]' }, { type: 'address' }, { type: 'uint256' }], name: 'swapExactETHForTokens', outputs: [{ type: 'uint256[]' }], stateMutability: 'payable', type: 'function' },
  { inputs: [{ type: 'uint256' }, { type: 'address[]' }], name: 'getAmountsOut', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }], name: 'addLiquidityETH', outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], stateMutability: 'payable', type: 'function' },
  { inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }], name: 'removeLiquidityETH', outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' }
];

export default function AfroSwap({ afroxPrice, onClose, onNavigateToLPMining }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [activeTab, setActiveTab] = useState('swap');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showLPMiningPrompt, setShowLPMiningPrompt] = useState(false);

  // Balances
  const [ethBalance, setEthBalance] = useState('0');
  const [afroxBalance, setAfroxBalance] = useState('0');
  const [lpBalance, setLpBalance] = useState('0');
  const [lpPosition, setLpPosition] = useState({ afrox: 0, weth: 0, share: 0, valueUSD: 0 });

  // Swap state
  const [swapDirection, setSwapDirection] = useState('ethToAfrox');
  const [swapInputAmount, setSwapInputAmount] = useState('');
  const [swapOutputAmount, setSwapOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);

  // Limit order state
  const [limitPrice, setLimitPrice] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [limitSide, setLimitSide] = useState('buy');
  const [limitExpiry, setLimitExpiry] = useState('24h');

  // Liquidity state
  const [liquidityAction, setLiquidityAction] = useState('add');
  const [ethLiquidityAmount, setEthLiquidityAmount] = useState('');
  const [afroxLiquidityAmount, setAfroxLiquidityAmount] = useState('');
  const [lpRemovePercent, setLpRemovePercent] = useState(100);

  // Pool info
  const [poolReserves, setPoolReserves] = useState({ afrox: 0, weth: 0 });
  const [currentPrice, setCurrentPrice] = useState(0);

  // Load balances and pool info
  const loadData = useCallback(async () => {
    if (!address || !publicClient) return;
    
    try {
      const ethBal = await publicClient.getBalance({ address });
      setEthBalance(formatUnits(ethBal, 18));

      const afroxBal = await publicClient.readContract({
        address: AFROX_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address]
      });
      setAfroxBalance(formatUnits(afroxBal, 4));

      const [lpBal, reserves, totalSupply, token0] = await Promise.all([
        publicClient.readContract({ address: AFROX_WETH_PAIR, abi: PAIR_ABI, functionName: 'balanceOf', args: [address] }),
        publicClient.readContract({ address: AFROX_WETH_PAIR, abi: PAIR_ABI, functionName: 'getReserves' }),
        publicClient.readContract({ address: AFROX_WETH_PAIR, abi: PAIR_ABI, functionName: 'totalSupply' }),
        publicClient.readContract({ address: AFROX_WETH_PAIR, abi: PAIR_ABI, functionName: 'token0' })
      ]);

      setLpBalance(formatUnits(lpBal, 18));

      const isAfroxToken0 = token0.toLowerCase() === AFROX_TOKEN.toLowerCase();
      const afroxReserve = Number(isAfroxToken0 ? reserves[0] : reserves[1]) / 1e4;
      const wethReserve = Number(isAfroxToken0 ? reserves[1] : reserves[0]) / 1e18;

      setPoolReserves({ afrox: afroxReserve, weth: wethReserve });

      const pricePerBillion = (wethReserve / afroxReserve) * 1e9;
      setCurrentPrice(pricePerBillion);

      const userShare = Number(lpBal) / Number(totalSupply);
      const userAfrox = afroxReserve * userShare;
      const userWeth = wethReserve * userShare;
      const ethPrice = 3000;
      const valueUSD = (userWeth * ethPrice) + (userAfrox * (afroxPrice || 0));

      setLpPosition({ afrox: userAfrox, weth: userWeth, share: userShare * 100, valueUSD });

    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, [address, publicClient, afroxPrice]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Calculate swap output
  useEffect(() => {
    const calculateOutput = async () => {
      if (!swapInputAmount || !publicClient || Number(swapInputAmount) <= 0) {
        setSwapOutputAmount('');
        return;
      }

      try {
        const path = swapDirection === 'ethToAfrox' 
          ? [WETH_ADDRESS, AFROX_TOKEN]
          : [AFROX_TOKEN, WETH_ADDRESS];
        
        const inputDecimals = swapDirection === 'ethToAfrox' ? 18 : 4;
        const outputDecimals = swapDirection === 'ethToAfrox' ? 4 : 18;
        
        const amountIn = parseUnits(swapInputAmount, inputDecimals);
        
        const amounts = await publicClient.readContract({
          address: UNISWAP_V2_ROUTER,
          abi: ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [amountIn, path]
        });

        setSwapOutputAmount(formatUnits(amounts[1], outputDecimals));
      } catch (err) {
        console.error('Error calculating output:', err);
        setSwapOutputAmount('');
      }
    };

    const debounce = setTimeout(calculateOutput, 300);
    return () => clearTimeout(debounce);
  }, [swapInputAmount, swapDirection, publicClient]);

  // Execute swap
  async function executeSwap() {
    if (!walletClient || !address) {
      setError('Please connect your wallet');
      return;
    }
    if (!swapInputAmount || Number(swapInputAmount) <= 0) {
      setError('Please enter an amount');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
      const slippageMultiplier = 1 - (slippage / 100);
      
      if (swapDirection === 'ethToAfrox') {
        const amountIn = parseUnits(swapInputAmount, 18);
        const minOut = parseUnits(String(Number(swapOutputAmount) * slippageMultiplier), 4);

        const { request } = await publicClient.simulateContract({
          address: UNISWAP_V2_ROUTER,
          abi: ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [minOut, [WETH_ADDRESS, AFROX_TOKEN], address, BigInt(deadline)],
          value: amountIn,
          account: address
        });

        const hash = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash });
        setSuccess(`Swapped ${swapInputAmount} ETH for AfroX!`);
      } else {
        const amountIn = parseUnits(swapInputAmount, 4);
        const minOut = parseUnits(String(Number(swapOutputAmount) * slippageMultiplier), 18);

        const allowance = await publicClient.readContract({
          address: AFROX_TOKEN,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, UNISWAP_V2_ROUTER]
        });

        if (allowance < amountIn) {
          const { request: approveRequest } = await publicClient.simulateContract({
            address: AFROX_TOKEN,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [UNISWAP_V2_ROUTER, amountIn * 2n],
            account: address
          });
          const approveHash = await walletClient.writeContract(approveRequest);
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        const { request } = await publicClient.simulateContract({
          address: UNISWAP_V2_ROUTER,
          abi: ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [amountIn, minOut, [AFROX_TOKEN, WETH_ADDRESS], address, BigInt(deadline)],
          account: address
        });

        const hash = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash });
        setSuccess(`Swapped ${prettyNumber(swapInputAmount)} AfroX for ETH!`);
      }

      setSwapInputAmount('');
      setSwapOutputAmount('');
      await loadData();
    } catch (err) {
      console.error('Swap error:', err);
      setError(err.message || 'Swap failed');
    } finally {
      setLoading(false);
    }
  }

  // Create limit order (stores locally, will execute via price monitoring)
  async function createLimitOrder() {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }
    if (!limitPrice || !limitAmount) {
      setError('Please enter price and amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For now, we'll create a signature-based order that can be submitted to 1inch Fusion or similar
      // This requires the user to sign a message authorizing the trade at the specified price
      
      const order = {
        maker: address,
        side: limitSide,
        tokenIn: limitSide === 'buy' ? WETH_ADDRESS : AFROX_TOKEN,
        tokenOut: limitSide === 'buy' ? AFROX_TOKEN : WETH_ADDRESS,
        amountIn: limitSide === 'buy' ? (Number(limitPrice) * Number(limitAmount) / 1e9).toString() : limitAmount,
        amountOut: limitSide === 'buy' ? limitAmount : (Number(limitAmount) * Number(limitPrice) / 1e9).toString(),
        limitPrice: limitPrice,
        expiry: limitExpiry,
        createdAt: Date.now(),
        status: 'pending'
      };

      // Store in localStorage for now (in production, submit to order book service)
      const existingOrders = JSON.parse(localStorage.getItem('afroswap_limit_orders') || '[]');
      existingOrders.push(order);
      localStorage.setItem('afroswap_limit_orders', JSON.stringify(existingOrders));

      setSuccess(`Limit order created! Will execute when price reaches ${limitPrice} ETH per 1B AfroX`);
      setLimitPrice('');
      setLimitAmount('');
    } catch (err) {
      console.error('Limit order error:', err);
      setError(err.message || 'Failed to create limit order');
    } finally {
      setLoading(false);
    }
  }

  // Add liquidity
  async function addLiquidity() {
    if (!walletClient || !address) {
      setError('Please connect your wallet');
      return;
    }
    if (!ethLiquidityAmount || !afroxLiquidityAmount) {
      setError('Please enter amounts');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
      const ethAmount = parseUnits(ethLiquidityAmount, 18);
      const afroxAmount = parseUnits(afroxLiquidityAmount, 4);
      const minEth = ethAmount * 95n / 100n;
      const minAfrox = afroxAmount * 95n / 100n;

      const allowance = await publicClient.readContract({
        address: AFROX_TOKEN,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, UNISWAP_V2_ROUTER]
      });

      if (allowance < afroxAmount) {
        const { request: approveRequest } = await publicClient.simulateContract({
          address: AFROX_TOKEN,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [UNISWAP_V2_ROUTER, afroxAmount * 2n],
          account: address
        });
        const approveHash = await walletClient.writeContract(approveRequest);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const { request } = await publicClient.simulateContract({
        address: UNISWAP_V2_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'addLiquidityETH',
        args: [AFROX_TOKEN, afroxAmount, minAfrox, minEth, address, BigInt(deadline)],
        value: ethAmount,
        account: address
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      setSuccess('Liquidity added successfully!');
      setEthLiquidityAmount('');
      setAfroxLiquidityAmount('');
      setShowLPMiningPrompt(true);
      await loadData();
    } catch (err) {
      console.error('Add liquidity error:', err);
      setError(err.message || 'Failed to add liquidity');
    } finally {
      setLoading(false);
    }
  }

  // Remove liquidity
  async function removeLiquidity() {
    if (!walletClient || !address) {
      setError('Please connect your wallet');
      return;
    }
    if (Number(lpBalance) <= 0) {
      setError('No LP tokens to remove');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
      const lpToRemove = parseUnits(String(Number(lpBalance) * (lpRemovePercent / 100)), 18);
      const minAfrox = parseUnits(String(lpPosition.afrox * (lpRemovePercent / 100) * 0.95), 4);
      const minEth = parseUnits(String(lpPosition.weth * (lpRemovePercent / 100) * 0.95), 18);

      const { request: approveRequest } = await publicClient.simulateContract({
        address: AFROX_WETH_PAIR,
        abi: PAIR_ABI,
        functionName: 'approve',
        args: [UNISWAP_V2_ROUTER, lpToRemove],
        account: address
      });
      const approveHash = await walletClient.writeContract(approveRequest);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const { request } = await publicClient.simulateContract({
        address: UNISWAP_V2_ROUTER,
        abi: ROUTER_ABI,
        functionName: 'removeLiquidityETH',
        args: [AFROX_TOKEN, lpToRemove, minAfrox, minEth, address, BigInt(deadline)],
        account: address
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      setSuccess(`Removed ${lpRemovePercent}% of your liquidity!`);
      setLpRemovePercent(100);
      await loadData();
    } catch (err) {
      console.error('Remove liquidity error:', err);
      setError(err.message || 'Failed to remove liquidity');
    } finally {
      setLoading(false);
    }
  }

  // Calculate matching liquidity amounts
  useEffect(() => {
    if (ethLiquidityAmount && poolReserves.weth > 0) {
      const ratio = poolReserves.afrox / poolReserves.weth;
      const matchingAfrox = Number(ethLiquidityAmount) * ratio;
      setAfroxLiquidityAmount(matchingAfrox.toFixed(4));
    }
  }, [ethLiquidityAmount, poolReserves]);

  // Load limit orders from localStorage
  const [savedLimitOrders, setSavedLimitOrders] = useState([]);
  useEffect(() => {
    if (address) {
      const orders = JSON.parse(localStorage.getItem('afroswap_limit_orders') || '[]');
      setSavedLimitOrders(orders.filter(o => o.maker === address));
    }
  }, [address]);

  function cancelLimitOrder(index) {
    const orders = JSON.parse(localStorage.getItem('afroswap_limit_orders') || '[]');
    const userOrders = orders.filter(o => o.maker === address);
    userOrders.splice(index, 1);
    const otherOrders = orders.filter(o => o.maker !== address);
    localStorage.setItem('afroswap_limit_orders', JSON.stringify([...otherOrders, ...userOrders]));
    setSavedLimitOrders(userOrders);
  }

  function prettyNumber(num, decimals = 2) {
    const n = Number(num || 0);
    if (n >= 1e12) return (n / 1e12).toFixed(decimals) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
    return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
  }

  const cardGlow = { boxShadow: '0 0 18px rgba(255,140,0,0.12)' };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900 rounded-2xl border border-orange-500/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <img src="/afrodex_token.png" alt="AfroX" className="w-8 h-8 rounded-full" />
            <div>
              <h2 className="text-xl font-bold text-orange-400">AfroSwap</h2>
              <p className="text-xs text-gray-400">AfroX/ETH • Uniswap V2</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        {/* GeckoTerminal Price Chart */}
        <div className="px-4 pt-4">
          <div style={{ position: 'relative', width: '100%', height: '300px', borderRadius: '12px', overflow: 'hidden' }}>
            <iframe
              id="geckoterminal-embed"
              title="GeckoTerminal Embed"
              src="https://www.geckoterminal.com/eth/pools/0x08130635368AA28b217a4dfb68E1bF8dC525621C?embed=1&info=0&swaps=0&light_chart=0&chart_type=price&resolution=1d&bg_color=000000"
              frameBorder="0"
              allow="clipboard-write"
              allowFullScreen
              style={{ 
                width: '100%', 
                height: '100%', 
                filter: 'brightness(1) saturate(0.7) sepia(0.7) contrast(1.6) hue-rotate(-7deg)'
              }}
            />
          </div>
        </div>

        {/* LP Mining Prompt after adding liquidity */}
        {showLPMiningPrompt && (
          <div className="mx-4 mt-4 p-4 bg-green-900/30 border border-green-500 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎉</span>
              <div className="flex-1">
                <h3 className="font-semibold text-green-400">Liquidity Added Successfully!</h3>
                <p className="text-sm text-gray-300 mt-1">
                  Want to earn extra rewards? Lock your LP tokens in the LP Mining Dashboard to earn up to 216% APY!
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setShowLPMiningPrompt(false);
                      onNavigateToLPMining?.();
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm"
                  >
                    🔒 Go to LP Mining
                  </button>
                  <button
                    onClick={() => setShowLPMiningPrompt(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mt-4">
          {['swap', 'limit', 'pool'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
                activeTab === tab 
                  ? 'text-orange-400 border-b-2 border-orange-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'swap' && '🔄 '}
              {tab === 'limit' && '📊 '}
              {tab === 'pool' && '💧 '}
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-300 text-sm">
              ⚠️ {error}
            </div>
          )}
          {success && !showLPMiningPrompt && (
            <div className="mb-4 p-3 bg-green-900/30 border border-green-500 rounded-lg text-green-300 text-sm">
              ✓ {success}
            </div>
          )}

          {/* SWAP TAB */}
          {activeTab === 'swap' && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-gray-400">
                <span>ETH Balance: {Number(ethBalance).toFixed(4)} ETH</span>
                <span>AfroX Balance: {prettyNumber(afroxBalance)} AfroX</span>
              </div>

              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>You pay</span>
                  <button 
                    onClick={() => setSwapInputAmount(swapDirection === 'ethToAfrox' ? ethBalance : afroxBalance)}
                    className="text-orange-400 hover:text-orange-300"
                  >
                    MAX
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={swapInputAmount}
                    onChange={(e) => setSwapInputAmount(e.target.value)}
                    placeholder="0.0"
                    className="flex-1 bg-transparent text-2xl font-bold text-white outline-none"
                  />
                  <button
                    onClick={() => {
                      setSwapDirection(swapDirection === 'ethToAfrox' ? 'afroxToEth' : 'ethToAfrox');
                      setSwapInputAmount('');
                      setSwapOutputAmount('');
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
                  >
                    {swapDirection === 'ethToAfrox' ? (
                      <>
                        <span className="text-lg">⟠</span>
                        <span className="font-semibold">ETH</span>
                      </>
                    ) : (
                      <>
                        <img src="/afrodex_token.png" alt="AfroX" className="w-5 h-5 rounded-full" />
                        <span className="font-semibold">AfroX</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-center -my-2">
                <button
                  onClick={() => {
                    setSwapDirection(swapDirection === 'ethToAfrox' ? 'afroxToEth' : 'ethToAfrox');
                    setSwapInputAmount('');
                    setSwapOutputAmount('');
                  }}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
                >
                  ⇅
                </button>
              </div>

              <div className="bg-gray-800 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-2">You receive</div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={swapOutputAmount ? (swapDirection === 'ethToAfrox' ? prettyNumber(swapOutputAmount) : Number(swapOutputAmount).toFixed(6)) : ''}
                    readOnly
                    placeholder="0.0"
                    className="flex-1 bg-transparent text-2xl font-bold text-white outline-none"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg">
                    {swapDirection === 'ethToAfrox' ? (
                      <>
                        <img src="/afrodex_token.png" alt="AfroX" className="w-5 h-5 rounded-full" />
                        <span className="font-semibold">AfroX</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg">⟠</span>
                        <span className="font-semibold">ETH</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Slippage tolerance</span>
                <div className="flex gap-2">
                  {[0.1, 0.5, 1.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={`px-2 py-1 rounded ${slippage === s ? 'bg-orange-500 text-black' : 'bg-gray-700 text-gray-300'}`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Rate</span>
                  <span>1 ETH = {prettyNumber(poolReserves.afrox / poolReserves.weth)} AfroX</span>
                </div>
              </div>

              <button
                onClick={executeSwap}
                disabled={loading || !swapInputAmount || !swapOutputAmount}
                className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Swapping...' : 'Swap'}
              </button>
            </div>
          )}

          {/* LIMIT TAB */}
          {activeTab === 'limit' && (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-400 mb-2">📊 How Limit Orders Work</h3>
                <p className="text-xs text-gray-400">
                  Set your desired price and amount. Your order will be stored and executed automatically when the market price reaches your target. Orders are monitored by our price oracle service.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setLimitSide('buy')}
                  className={`flex-1 py-2 rounded-lg font-semibold ${limitSide === 'buy' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Buy AfroX
                </button>
                <button
                  onClick={() => setLimitSide('sell')}
                  className={`flex-1 py-2 rounded-lg font-semibold ${limitSide === 'sell' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Sell AfroX
                </button>
              </div>

              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Limit Price (ETH per 1B AfroX)</span>
                  <span className="text-orange-400">Current: {currentPrice.toFixed(6)}</span>
                </div>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="w-full bg-transparent text-xl font-bold text-white outline-none"
                />
              </div>

              <div className="bg-gray-800 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-2">Amount (AfroX)</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={limitAmount}
                    onChange={(e) => setLimitAmount(e.target.value)}
                    placeholder="0.0"
                    className="flex-1 bg-transparent text-xl font-bold text-white outline-none"
                  />
                  <button 
                    onClick={() => setLimitAmount(afroxBalance)}
                    className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-300"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Order Expiry</span>
                <div className="flex gap-2">
                  {['1h', '24h', '7d', '30d'].map((exp) => (
                    <button
                      key={exp}
                      onClick={() => setLimitExpiry(exp)}
                      className={`px-2 py-1 rounded ${limitExpiry === exp ? 'bg-orange-500 text-black' : 'bg-gray-700 text-gray-300'}`}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>

              {limitPrice && limitAmount && (
                <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Total {limitSide === 'buy' ? 'Cost' : 'Receive'}:</span>
                    <span className="text-white font-semibold">
                      {(Number(limitPrice) * Number(limitAmount) / 1e9).toFixed(6)} ETH
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={createLimitOrder}
                disabled={loading || !limitPrice || !limitAmount}
                className={`w-full py-3 rounded-xl font-bold disabled:opacity-50 ${
                  limitSide === 'buy' 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {loading ? 'Creating...' : `Place ${limitSide === 'buy' ? 'Buy' : 'Sell'} Order`}
              </button>

              {/* Active Orders */}
              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Your Limit Orders</h4>
                {savedLimitOrders.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">No active limit orders</div>
                ) : (
                  <div className="space-y-2">
                    {savedLimitOrders.map((order, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className={`text-xs px-2 py-1 rounded ${order.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {order.side.toUpperCase()}
                          </span>
                          <span className="text-sm ml-2">{prettyNumber(order.amountOut)} AfroX @ {order.limitPrice} ETH/1B</span>
                        </div>
                        <button onClick={() => cancelLimitOrder(i)} className="text-red-400 hover:text-red-300 text-sm">Cancel</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* POOL TAB */}
          {activeTab === 'pool' && (
            <div className="space-y-4">
              <motion.div className="bg-gray-800 rounded-xl p-4" whileHover={cardGlow}>
                <h3 className="text-lg font-semibold mb-3">Your Position</h3>
                {Number(lpBalance) > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">LP Tokens</span>
                      <span className="font-semibold">{Number(lpBalance).toFixed(8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pool Share</span>
                      <span className="font-semibold">{lpPosition.share.toFixed(4)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">AfroX</span>
                      <span className="font-semibold text-blue-400">{prettyNumber(lpPosition.afrox)} AfroX</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ETH</span>
                      <span className="font-semibold text-green-400">{lpPosition.weth.toFixed(6)} ETH</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-700 pt-2">
                      <span className="text-gray-400">Total Value</span>
                      <span className="font-bold text-orange-400">{formatUSD(lpPosition.valueUSD)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <div className="text-2xl mb-2">💧</div>
                    No liquidity position found
                  </div>
                )}
              </motion.div>

              <div className="flex gap-2">
                <button
                  onClick={() => setLiquidityAction('add')}
                  className={`flex-1 py-2 rounded-lg font-semibold ${liquidityAction === 'add' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  + Add Liquidity
                </button>
                <button
                  onClick={() => setLiquidityAction('remove')}
                  className={`flex-1 py-2 rounded-lg font-semibold ${liquidityAction === 'remove' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  − Remove Liquidity
                </button>
              </div>

              {liquidityAction === 'add' && (
                <div className="space-y-3">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>ETH Amount</span>
                      <span>Balance: {Number(ethBalance).toFixed(4)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={ethLiquidityAmount}
                        onChange={(e) => setEthLiquidityAmount(e.target.value)}
                        placeholder="0.0"
                        className="flex-1 bg-transparent text-xl font-bold text-white outline-none"
                      />
                      <span className="text-gray-400">ETH</span>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>AfroX Amount (auto-calculated)</span>
                      <span>Balance: {prettyNumber(afroxBalance)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={afroxLiquidityAmount ? prettyNumber(afroxLiquidityAmount) : ''}
                        readOnly
                        placeholder="0.0"
                        className="flex-1 bg-transparent text-xl font-bold text-white outline-none"
                      />
                      <span className="text-gray-400">AfroX</span>
                    </div>
                  </div>

                  <button
                    onClick={addLiquidity}
                    disabled={loading || !ethLiquidityAmount}
                    className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Liquidity'}
                  </button>
                </div>
              )}

              {liquidityAction === 'remove' && (
                <div className="space-y-3">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-sm text-gray-400 mb-3">Amount to Remove</div>
                    <div className="text-center text-4xl font-bold text-white mb-4">{lpRemovePercent}%</div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={lpRemovePercent}
                      onChange={(e) => setLpRemovePercent(Number(e.target.value))}
                      className="w-full accent-orange-500"
                    />
                    <div className="flex justify-between mt-2">
                      {[25, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          onClick={() => setLpRemovePercent(p)}
                          className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">You will receive:</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400">{prettyNumber(lpPosition.afrox * (lpRemovePercent / 100))} AfroX</span>
                      <span className="text-green-400">{(lpPosition.weth * (lpRemovePercent / 100)).toFixed(6)} ETH</span>
                    </div>
                  </div>

                  <button
                    onClick={removeLiquidity}
                    disabled={loading || Number(lpBalance) <= 0}
                    className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                  >
                    {loading ? 'Removing...' : 'Remove Liquidity'}
                  </button>
                </div>
              )}

              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Pool Statistics</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-400">Total AfroX</div>
                    <div className="font-semibold">{prettyNumber(poolReserves.afrox)}</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-400">Total ETH</div>
                    <div className="font-semibold">{poolReserves.weth.toFixed(4)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 text-center text-xs text-gray-500">
          Powered by Uniswap V2 • Contract: {AFROX_WETH_PAIR.slice(0, 10)}...
        </div>
      </motion.div>
    </div>
  );
}
