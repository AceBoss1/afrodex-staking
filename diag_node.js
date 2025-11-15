// diag_node.js
// Usage: ALCHEMY_URL="https://eth-mainnet.g.alchemy.com/v2/<KEY>" node diag_node.js <addressToProbe>
// If no address provided, you can paste the wallet address you tested.

import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { STAKING_ABI } from './src/lib/abis/stakingAbi.js'; // adjust path if needed

const RPC = process.env.ALCHEMY_URL || process.env.RPC_URL || '';
if (!RPC) {
  console.error('Set ALCHEMY_URL or RPC_URL env variable to an HTTP JSON-RPC endpoint');
  process.exit(1);
}

const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC),
});

const STAKING_ADDRESS = process.env.STAKING_ADDRESS || '0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c';
const probe = process.argv[2] || process.env.PROBE_ADDRESS || '0xcfbD73A1404A2CBf956e9E506ff5006601BCd2A4'; // sample you gave

async function main() {
  console.log('RPC:', RPC.split('/').slice(-1)[0]);
  console.log('Probe address:', probe);
  console.log('Staking addr:', STAKING_ADDRESS);

  try {
    const decimals = await client.readContract({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'decimals' }).catch((e) => { throw e; });
    console.log('decimals (raw):', decimals);

    const balance = await client.readContract({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'balanceOf', args: [probe] });
    console.log('balance (raw):', balance);
    console.log('balance (formatted):', Number(balance) ? Number(balance) / (10 ** Number(decimals)) : 0);

    const allowance = await client.readContract({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'allowance', args: [probe, STAKING_ADDRESS] });
    console.log('allowance (raw):', allowance);
    console.log('allowance (fmt):', Number(allowance) ? Number(allowance) / (10 ** Number(decimals)) : 0);

    const stakeInfo = await client.readContract({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'viewStakeInfoOf', args: [probe] });
    console.log('viewStakeInfoOf (raw):', stakeInfo);
    // try named fields
    const stakeBalance = stakeInfo.stakeBalance ?? stakeInfo[0];
    const rewardValue = stakeInfo.rewardValue ?? stakeInfo[1];
    const lastUnstakeTs = stakeInfo.lastUnstakeTimestamp ?? stakeInfo[2];
    const lastRewardTs = stakeInfo.lastRewardTimestamp ?? stakeInfo[3];

    console.log('stakeBalance (raw):', stakeBalance);
    console.log('stakeBalance (fmt):', Number(stakeBalance) / (10 ** Number(decimals)));
    console.log('rewardValue (raw):', rewardValue);
    console.log('rewardValue (fmt):', Number(rewardValue) / (10 ** Number(decimals)));
    console.log('lastUnstakeTimestamp:', lastUnstakeTs, '=>', new Date(Number(lastUnstakeTs) * 1000).toString());
    console.log('lastRewardTimestamp:', lastRewardTs, '=>', new Date(Number(lastRewardTs) * 1000).toString());

    // rewardRate and bonusRate (maybe present)
    const rewardRate = await client.readContract({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'rewardRate' }).catch((e) => null);
    console.log('rewardRate raw:', rewardRate);
    const bonusRate = await client.readContract({ address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'bonusRate' }).catch((e) => null);
    console.log('bonusRate raw:', bonusRate);

  } catch (err) {
    console.error('Error in diagnostics:', err);
  }
}

main();
