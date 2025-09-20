import 'dotenv/config';
import { createPublicClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC!) });
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

// Uniswap V3 QuoterV2 on Base
const QUOTER = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');

const quoterAbi = parseAbi([
  'function quoteExactInputSingle(address,address,uint24,uint256,uint160) external view returns (uint256,uint160,uint32,uint256)'
]);

async function checkPools() {
  console.log('🔍 Checking available pools for WETH/USDC...');

  const amountIn = parseUnits('0.01', 18); // 0.01 WETH
  const feeTiers = [500, 3000, 10000];

  for (const feeTier of feeTiers) {
    try {
      console.log(`\n📊 Testing ${feeTier/100}% fee tier...`);

      const result = await publicClient.readContract({
        address: QUOTER,
        abi: quoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [WETH, USDC, feeTier, amountIn, 0n]
      });

      const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

      console.log(`✅ Pool exists! Quote results:`);
      console.log(`   Input: 0.01 WETH`);
      console.log(`   Output: ${(Number(amountOut) / 1e6).toFixed(6)} USDC`);
      console.log(`   Price: ${((Number(amountOut) / 1e6) / 0.01).toFixed(2)} USDC/WETH`);
      console.log(`   Gas estimate: ${gasEstimate.toString()}`);

    } catch (error) {
      console.log(`❌ Fee tier ${feeTier} not available:`, error.message);
    }
  }
}

checkPools().catch(console.error);