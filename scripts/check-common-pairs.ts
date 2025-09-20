import 'dotenv/config';
import { createPublicClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC!) });

// Common Base tokens
const tokens = {
  WETH: getAddress('0x4200000000000000000000000000000000000006'),
  USDbC: getAddress('0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'), // USD Base Coin (bridged USDC)
  USDC: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'), // Native USDC
  DAI: getAddress('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'), // DAI
  CBETH: getAddress('0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22'), // Coinbase Wrapped Staked ETH
};

// Uniswap V3 QuoterV2 on Base
const QUOTER = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');

const quoterAbi = parseAbi([
  'function quoteExactInputSingle(address,address,uint24,uint256,uint160) external view returns (uint256,uint160,uint32,uint256)'
]);

async function checkCommonPairs() {
  console.log('🔍 Checking common trading pairs on Base...');

  const amountIn = parseUnits('0.01', 18); // 0.01 WETH
  const feeTiers = [500, 3000, 10000];

  // Test pairs
  const pairs = [
    { name: 'WETH/USDbC', tokenIn: tokens.WETH, tokenOut: tokens.USDbC },
    { name: 'WETH/USDC', tokenIn: tokens.WETH, tokenOut: tokens.USDC },
    { name: 'WETH/DAI', tokenIn: tokens.WETH, tokenOut: tokens.DAI },
    { name: 'WETH/CBETH', tokenIn: tokens.WETH, tokenOut: tokens.CBETH },
  ];

  for (const pair of pairs) {
    console.log(`\n🔍 Testing ${pair.name}...`);

    for (const feeTier of feeTiers) {
      try {
        console.log(`  📊 Fee tier ${feeTier/100}%...`);

        const result = await publicClient.readContract({
          address: QUOTER,
          abi: quoterAbi,
          functionName: 'quoteExactInputSingle',
          args: [pair.tokenIn, pair.tokenOut, feeTier, amountIn, 0n]
        });

        const [amountOut] = result;
        const decimals = pair.tokenOut === tokens.WETH || pair.tokenOut === tokens.CBETH ? 18 :
                        pair.tokenOut === tokens.USDC || pair.tokenOut === tokens.USDbC ? 6 : 18;

        console.log(`    ✅ Pool exists! Output: ${(Number(amountOut) / (10 ** decimals)).toFixed(6)}`);

      } catch (error) {
        console.log(`    ❌ Not available`);
      }
    }
  }
}

checkCommonPairs().catch(console.error);