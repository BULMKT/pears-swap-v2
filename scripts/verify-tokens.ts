import 'dotenv/config';
import { createPublicClient, http, parseAbi, getAddress } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC!) });

const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
]);

async function verifyTokens() {
  console.log('🔍 Verifying token addresses on Base...');

  const tokens = [
    { name: 'WETH', address: '0x4200000000000000000000000000000000000006' },
    { name: 'USDC (Native)', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { name: 'USDbC (Bridged)', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' },
  ];

  for (const token of tokens) {
    try {
      console.log(`\n🔍 ${token.name} (${token.address}):`);

      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: getAddress(token.address),
          abi: erc20Abi,
          functionName: 'name'
        }),
        publicClient.readContract({
          address: getAddress(token.address),
          abi: erc20Abi,
          functionName: 'symbol'
        }),
        publicClient.readContract({
          address: getAddress(token.address),
          abi: erc20Abi,
          functionName: 'decimals'
        })
      ]);

      console.log(`✅ Name: ${name}`);
      console.log(`✅ Symbol: ${symbol}`);
      console.log(`✅ Decimals: ${decimals}`);

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n💡 If USDC Native fails, try USDbC (bridged USDC) instead');
}

verifyTokens().catch(console.error);