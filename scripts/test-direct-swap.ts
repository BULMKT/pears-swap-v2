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
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)'
]);

const erc20Abi = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function balanceOf(address) view returns (uint256)'
]);

async function testDirectSwap() {
  console.log('🧪 Testing direct Uniswap swap...');

  // Check balance
  const [wethBal, usdcBal] = await Promise.all([
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
  ]);

  console.log('Before: WETH', (Number(wethBal) / 1e18).toFixed(6), 'USDC', (Number(usdcBal) / 1e6).toFixed(6));

  // Approve WETH
  const amountIn = parseUnits('0.005', 18); // 0.005 WETH - smaller amount
  console.log('🔄 Approving WETH...');

  const approveTx = await walletClient.writeContract({
    address: WETH,
    abi: erc20Abi,
    functionName: 'approve',
    args: [ROUTER, amountIn]
  });
  console.log('✅ Approve tx:', approveTx);

  // Wait for approval
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Execute swap
  const deadline = BigInt(Math.floor(Date.now()/1000) + 600);

  const params = {
    tokenIn: WETH,
    tokenOut: USDC,
    fee: 3000, // 0.3%
    recipient: account.address,
    deadline: deadline,
    amountIn: amountIn,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n
  };

  console.log('🚀 Executing direct Uniswap swap...');

  try {
    const txHash = await walletClient.writeContract({
      address: ROUTER,
      abi: routerAbi,
      functionName: 'exactInputSingle',
      args: [params]
    });

    console.log('✅ Swap successful:', txHash);

    // Wait and check balances
    await new Promise(resolve => setTimeout(resolve, 8000));

    const [wethAfter, usdcAfter] = await Promise.all([
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    ]);

    console.log('After:  WETH', (Number(wethAfter) / 1e18).toFixed(6), 'USDC', (Number(usdcAfter) / 1e6).toFixed(6));

    const wethSpent = Number(wethBal - wethAfter) / 1e18;
    const usdcReceived = Number(usdcAfter - usdcBal) / 1e6;

    console.log('📊 Results:');
    console.log('   WETH spent:', wethSpent.toFixed(6));
    console.log('   USDC received:', usdcReceived.toFixed(6));
    console.log('   Price:', (usdcReceived / wethSpent).toFixed(2), 'USDC/WETH');
    console.log('🎉 Direct Uniswap swap works!');

  } catch (error) {
    console.log('❌ Direct swap failed:', error.message);
  }
}

testDirectSwap().catch(console.error);