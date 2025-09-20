import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'); // Uniswap SwapRouter02

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const routerAbi = parseAbi([
  'function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160)) external payable returns (uint256)'
]);

const erc20Abi = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function balanceOf(address) view returns (uint256)'
]);

async function testUniswapDirect() {
  console.log('🧪 Testing direct Uniswap call...');

  // Check existing allowance
  const allowance = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address]
  });

  console.log('WETH balance:', (Number(allowance) / 1e18).toFixed(6));

  // Try different fee tiers
  const feeTiers = [500, 3000, 10000];

  for (const feeTier of feeTiers) {
    try {
      console.log(`\n🔍 Testing fee tier ${feeTier} (${feeTier/100}%)...`);

      // Prepare parameters
      const amountIn = parseUnits('0.005', 18); // 0.005 WETH - smaller amount
      const deadline = BigInt(Math.floor(Date.now()/1000) + 600);

      // Approve first
      const approveTx = await walletClient.writeContract({
        address: WETH,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ROUTER, amountIn]
      });
      console.log('✅ Approved WETH:', approveTx);

      // Simulate the swap
      const params = {
        tokenIn: WETH,
        tokenOut: USDC,
        fee: feeTier,
        recipient: account.address,
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n
      };

      const result = await walletClient.simulateContract({
        address: ROUTER,
        abi: routerAbi,
        functionName: 'exactInputSingle',
        args: [params]
      });

      console.log(`✅ Fee tier ${feeTier} works! Simulated output:`, result.result.toString());

      // If simulation works, execute it
      const txHash = await walletClient.writeContract({
        address: ROUTER,
        abi: routerAbi,
        functionName: 'exactInputSingle',
        args: [params]
      });

      console.log(`🎉 Executed swap with fee tier ${feeTier}:`, txHash);
      break; // Success, exit loop

    } catch (error) {
      console.log(`❌ Fee tier ${feeTier} failed:`, error.message);
    }
  }
}

testUniswapDirect().catch(console.error);