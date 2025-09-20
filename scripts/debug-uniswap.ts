import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC!) });

// Uniswap V3 addresses on Base
const FACTORY = getAddress('0x33128a8fC17869897dcE68Ed026d694621f6FDfD');
const QUOTER = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');
const ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');

const factoryAbi = parseAbi([
  'function getPool(address,address,uint24) external view returns (address)'
]);

const erc20Abi = parseAbi([
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)'
]);

// Common Base tokens
const tokens = {
  WETH: getAddress('0x4200000000000000000000000000000000000006'),
  USDC: getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  USDbC: getAddress('0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'),
};

async function debugUniswap() {
  console.log('🐛 Debugging Uniswap deployment on Base...');

  // 1. Verify contract addresses exist
  console.log('\n📍 Checking contract addresses...');

  try {
    const factoryCode = await publicClient.getBytecode({ address: FACTORY });
    console.log('✅ Factory has bytecode:', factoryCode ? 'Yes' : 'No');
  } catch (e) {
    console.log('❌ Factory error:', e.message);
  }

  try {
    const quoterCode = await publicClient.getBytecode({ address: QUOTER });
    console.log('✅ Quoter has bytecode:', quoterCode ? 'Yes' : 'No');
  } catch (e) {
    console.log('❌ Quoter error:', e.message);
  }

  // 2. Check token contracts
  console.log('\n📍 Checking token contracts...');

  for (const [name, address] of Object.entries(tokens)) {
    try {
      const symbol = await publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: 'symbol'
      });
      console.log(`✅ ${name} (${symbol}): ${address}`);
    } catch (e) {
      console.log(`❌ ${name} error: ${e.message}`);
    }
  }

  // 3. Check for existing pools
  console.log('\n📍 Checking for pools...');

  const pairs = [
    { name: 'WETH/USDC', token0: tokens.WETH, token1: tokens.USDC },
    { name: 'WETH/USDbC', token0: tokens.WETH, token1: tokens.USDbC },
  ];

  const feeTiers = [500, 3000, 10000];

  for (const pair of pairs) {
    console.log(`\n🔍 ${pair.name}:`);

    for (const fee of feeTiers) {
      try {
        const poolAddress = await publicClient.readContract({
          address: FACTORY,
          abi: factoryAbi,
          functionName: 'getPool',
          args: [pair.token0, pair.token1, fee]
        });

        if (poolAddress !== '0x0000000000000000000000000000000000000000') {
          console.log(`  ✅ ${fee/100}% pool: ${poolAddress}`);
        } else {
          console.log(`  ❌ ${fee/100}% pool: Not deployed`);
        }
      } catch (e) {
        console.log(`  ❌ ${fee/100}% pool error:`, e.message);
      }
    }
  }
}

debugUniswap().catch(console.error);