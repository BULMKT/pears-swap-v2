import 'dotenv/config';
import { createWalletClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const UNISWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });

async function microSwapTest() {
  console.log('🧪 MICRO SWAP TEST - Smallest possible amount');

  try {
    // Try progressively smaller amounts
    const amounts = [
      { label: '0.1 WETH', amount: parseUnits('0.1', 18), minOut: parseUnits('300', 6) },
      { label: '0.01 WETH', amount: parseUnits('0.01', 18), minOut: parseUnits('30', 6) },
      { label: '0.001 WETH', amount: parseUnits('0.001', 18), minOut: parseUnits('1', 6) },
      { label: '0.0001 WETH', amount: parseUnits('0.0001', 18), minOut: parseUnits('0.1', 6) },
    ];

    for (const test of amounts) {
      console.log(`\n🔍 Testing ${test.label}...`);

      const deadline = BigInt(Math.floor(Date.now()/1000) + 1200);

      // Approve
      const erc20Abi = parseAbi(['function approve(address,uint256) external returns (bool)']);
      await walletClient.writeContract({
        address: WETH,
        abi: erc20Abi,
        functionName: 'approve',
        args: [UNISWAP_ROUTER, test.amount]
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try swap
      const routerAbi = parseAbi([
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)'
      ]);

      const params = {
        tokenIn: WETH,
        tokenOut: USDC,
        fee: 3000,
        recipient: account.address,
        deadline: deadline,
        amountIn: test.amount,
        amountOutMinimum: test.minOut,
        sqrtPriceLimitX96: 0n
      };

      try {
        const tx = await walletClient.writeContract({
          address: UNISWAP_ROUTER,
          abi: routerAbi,
          functionName: 'exactInputSingle',
          args: [params]
        });

        console.log(`✅ SUCCESS with ${test.label}:`, tx);
        console.log('🎉 Found working amount!');
        return; // Exit on first success

      } catch (error) {
        console.log(`❌ Failed with ${test.label}:`, error.message.split('\n')[0]);
      }
    }

    console.log('\n🤔 All amounts failed. Possible issues:');
    console.log('1. Pool might have insufficient liquidity');
    console.log('2. Token addresses might be wrong for Base');
    console.log('3. Fee tier 3000 might not exist for this pair');
    console.log('4. Our slippage calculations are off');

  } catch (error) {
    console.log('💥 Test failed:', error.message);
  }
}

microSwapTest().catch(console.error);