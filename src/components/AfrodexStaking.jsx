'use client';


import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';


import { STAKING_ABI, AFROX_TOKEN_ABI } from '../lib/abis';
import { STAKING_ADDRESS, TOKEN_ADDRESS, readContractSafe, writeContractSafe } from '../lib/contracts';


const DEFAULT_DECIMALS = 4;
const PRICE_USD_STATIC = 0.000001;
const TOKEN_LABEL = 'AfroX';
const TOKEN_LOGO = '/afrodex_token.png';


export default function AfrodexStaking() {
const { address, isConnected } = useAccount();
const publicClient = usePublicClient();
const walletClient = useWalletClient();


const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);
const [walletBalance, setWalletBalance] = useState('0');
const [stakedBalance, setStakedBalance] = useState('0');
const [rewards, setRewards] = useState('0');
const [allowance, setAllowance] = useState('0');


const [amount, setAmount] = useState('');
const [unstakeAmount, setUnstakeAmount] = useState('');


const [rewardRate, setRewardRate] = useState(0);
const [bonusRate, setBonusRate] = useState(0);
const [lastUnstakeTs, setLastUnstakeTs] = useState(0);
const [lastRewardTs, setLastRewardTs] = useState(0);


const [loading, setLoading] = useState(false);
setRe
