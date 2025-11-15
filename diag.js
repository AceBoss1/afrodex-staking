import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY")
});

const ABI = [{
  inputs:[{ internalType:"address", name:"account", type:"address" }],
  name:"viewStakeInfoOf",
  outputs:[
    { internalType:"uint256", name:"stakeBalance", type:"uint256" },
    { internalType:"uint256", name:"rewardValue", type:"uint256" },
    { internalType:"uint256", name:"lastUnstakeTimestamp", type:"uint256" },
    { internalType:"uint256", name:"lastRewardTimestamp", type:"uint256" }
  ],
  stateMutability:"view",
  type:"function"
}];

const addr = process.argv[2];

const result = await client.readContract({
  address: "0x30715f7679b3e5574fb2cc9cb4c9e5994109ed8c",
  abi: ABI,
  functionName: "viewStakeInfoOf",
  args: [addr]
});

console.log(result);
