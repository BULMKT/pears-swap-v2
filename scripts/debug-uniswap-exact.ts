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

async function debugUniswapExact() {
  console.log('🔍 Testing EXACT same parameters with Uniswap directly...');

  try {
    // Exact same parameters as our failed Pears call
    const amountIn = parseUnits('0.001', 18); // 1000000000000000
    const minOut = parseUnits('2.0', 6);      // 2000000
    const deadline = BigInt(Math.floor(Date.now()/1000) + 1200);

    console.log('Parameters:');
    console.log('  tokenIn:', WETH);
    console.log('  tokenOut:', USDC);
    console.log('  fee:', 3000);
    console.log('  amountIn:', amountIn.toString());
    console.log('  amountOutMinimum:', minOut.toString());
    console.log('  deadline:', deadline.toString());

    // 1. Approve Uniswap router
    console.log('\n1️⃣ Approving Uniswap router...');
    const erc20Abi = parseAbi(['function approve(address,uint256) external returns (bool)']);

    const approveTx = await walletClient.writeContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'approve',
      args: [UNISWAP_ROUTER, amountIn]
    });
    console.log('✅ Approve:', approveTx);

    await new Promise(resolve => setTimeout(resolve, 8000));

    // 2. Call Uniswap directly with exact same params
    console.log('\n2️⃣ Calling Uniswap directly...');

    const routerAbi = parseAbi([
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)'
    ]);

    const params = {
      tokenIn: WETH,
      tokenOut: USDC,
      fee: 3000,
      recipient: account.address, // Direct to user (not via our contract)
      deadline: deadline,
      amountIn: amountIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0n
    };

    const uniTx = await walletClient.writeContract({
      address: UNISWAP_ROUTER,
      abi: routerAbi,
      functionName: 'exactInputSingle',
      args: [params]
    });

    console.log('🎉 UNISWAP SUCCESS:', uniTx);
    console.log('🔗 Basescan:', `https://basescan.org/tx/${uniTx}`);
    console.log('\n✅ Uniswap works with these exact parameters!');
    console.log('❌ So the issue is in our PearsRouter contract logic');

  } catch (error) {
    console.log('\n❌ Even Uniswap failed:', error.message);
    console.log('🤔 This suggests the parameters themselves are wrong');
  }
}

debugUniswapExact().catch(console.error);