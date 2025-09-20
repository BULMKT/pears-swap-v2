import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK  = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const FEE_RECIPIENT = getAddress(process.env.FEE_RECIPIENT!);

// Deployed PearsRouterV1 contract address:
const PEARS = getAddress('0x398e453712b5aa52743a20f1569f1160c808b6ad');
const WETH  = getAddress(process.env.WETH!);
const USDC  = getAddress(process.env.USDC!);

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const erc20 = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

const pearsAbi = parseAbi([
  'function swapExactInV3(address,address,uint24,uint256,uint256,uint256) returns (uint256)'
]);

async function main() {
  // 0) show balances
  const [wBal, uBal] = await Promise.all([
    publicClient.readContract({ address: WETH, abi: erc20, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: USDC, abi: erc20, functionName: 'balanceOf', args: [account.address] }),
  ]);
  console.log('Before: WETH', (Number(wBal) / 1e18).toFixed(6), 'USDC', (Number(uBal) / 1e6).toFixed(6));

  // 1) approve PearsRouterV1 to spend WETH
  const amountIn = parseUnits('0.01', 18); // 0.01 WETH
  console.log('🔄 Approving WETH spend...');
  const approveTx = await walletClient.writeContract({
    address: WETH, abi: erc20, functionName: 'approve',
    args: [PEARS, amountIn]
  });
  console.log('✅ Approve tx:', approveTx);

  // 2) set minOut conservative (e.g., 0.5% slippage). For now we pass 0 and let Uniswap handle.
  //    (We'll tighten later using Quoter or 0x quote.)
  const minOut = 0n;

  // 3) call swap: feeTier 3000 (0.3% pool) - most common for WETH/USDC
  const feeTier = 3000; // 0.3%
  const deadline = BigInt(Math.floor(Date.now()/1000) + 600);

  console.log('🚀 Executing swap: 0.01 WETH → USDC (0.3% fee tier)...');
  const txHash = await walletClient.writeContract({
    address: PEARS, abi: pearsAbi, functionName: 'swapExactInV3',
    args: [WETH, USDC, feeTier, amountIn, minOut, deadline]
  });
  console.log('✅ Swap tx:', txHash);
  console.log('⏳ Waiting for confirmation...');

  // Wait for transaction
  await new Promise(resolve => setTimeout(resolve, 8000));

  // 4) balances after
  const [wAfter, uAfter] = await Promise.all([
    publicClient.readContract({ address: WETH, abi: erc20, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: USDC, abi: erc20, functionName: 'balanceOf', args: [account.address] }),
  ]);
  console.log('After:  WETH', (Number(wAfter) / 1e18).toFixed(6), 'USDC', (Number(uAfter) / 1e6).toFixed(6));

  // Calculate results
  const wethSpent = Number(wBal - wAfter) / 1e18;
  const usdcReceived = Number(uAfter - uBal) / 1e6;
  const effectivePrice = usdcReceived / wethSpent;

  console.log('📊 Swap Results:');
  console.log('   WETH spent:', wethSpent.toFixed(6));
  console.log('   USDC received:', usdcReceived.toFixed(6));
  console.log('   Effective price:', effectivePrice.toFixed(2), 'USDC/WETH');
  console.log('   Platform fee: 0.05% automatically deducted');
  console.log('🎉 Swap completed successfully!');
}

main().catch(e => (console.error(e), process.exit(1)));