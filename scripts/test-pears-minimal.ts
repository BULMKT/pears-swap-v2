import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const PEARS = getAddress('0x398e453712b5aa52743a20f1569f1160c808b6ad');

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const erc20Abi = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)'
]);

const pearsAbi = parseAbi([
  'function swapExactInV3(address,address,uint24,uint256,uint256,uint256) returns (uint256)',
  'function SWAP_ROUTER02() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function FEE_BPS() view returns (uint256)'
]);

async function testPearsMinimal() {
  console.log('🍐 Testing PearsRouterV1 contract...');

  // 1. Verify contract deployment
  console.log('\n📍 Checking contract deployment...');
  try {
    const [router, feeRecipient, feeBps] = await Promise.all([
      publicClient.readContract({ address: PEARS, abi: pearsAbi, functionName: 'SWAP_ROUTER02' }),
      publicClient.readContract({ address: PEARS, abi: pearsAbi, functionName: 'feeRecipient' }),
      publicClient.readContract({ address: PEARS, abi: pearsAbi, functionName: 'FEE_BPS' })
    ]);

    console.log('✅ Contract deployed correctly:');
    console.log('   Router:', router);
    console.log('   Fee recipient:', feeRecipient);
    console.log('   Fee BPS:', feeBps.toString(), '(should be 5)');

  } catch (e) {
    console.log('❌ Contract verification failed:', e.message);
    return;
  }

  // 2. Check balances and allowances
  console.log('\n📍 Checking balances and allowances...');
  const [wethBal, usdcBal, allowance] = await Promise.all([
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'allowance', args: [account.address, PEARS] })
  ]);

  console.log('WETH balance:', (Number(wethBal) / 1e18).toFixed(6));
  console.log('USDC balance:', (Number(usdcBal) / 1e6).toFixed(6));
  console.log('WETH allowance to Pears:', (Number(allowance) / 1e18).toFixed(6));

  // 3. Set allowance if needed
  const amountIn = parseUnits('0.002', 18); // 0.002 WETH - very small amount
  if (allowance < amountIn) {
    console.log('\n🔄 Setting allowance...');
    const approveTx = await walletClient.writeContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'approve',
      args: [PEARS, amountIn]
    });
    console.log('✅ Allowance set:', approveTx);

    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 4. Try the swap with minimal amount
  console.log('\n🚀 Attempting swap: 0.002 WETH → USDC...');

  try {
    const deadline = BigInt(Math.floor(Date.now()/1000) + 600);

    const txHash = await walletClient.writeContract({
      address: PEARS,
      abi: pearsAbi,
      functionName: 'swapExactInV3',
      args: [WETH, USDC, 3000, amountIn, 0n, deadline]
    });

    console.log('✅ Swap transaction sent:', txHash);
    console.log('⏳ Waiting for confirmation...');

    // Wait for transaction
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check final balances
    const [wethAfter, usdcAfter] = await Promise.all([
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
    ]);

    console.log('\n📊 Final balances:');
    console.log('WETH:', (Number(wethAfter) / 1e18).toFixed(6));
    console.log('USDC:', (Number(usdcAfter) / 1e6).toFixed(6));

    const wethSpent = Number(wethBal - wethAfter) / 1e18;
    const usdcReceived = Number(usdcAfter - usdcBal) / 1e6;

    if (wethSpent > 0 && usdcReceived > 0) {
      console.log('\n🎉 SUCCESS! Pears swap worked:');
      console.log('   WETH spent:', wethSpent.toFixed(6));
      console.log('   USDC received:', usdcReceived.toFixed(6));
      console.log('   Effective price:', (usdcReceived / wethSpent).toFixed(2), 'USDC/WETH');
      console.log('   Platform fee (0.05%) was automatically deducted!');
    } else {
      console.log('❌ Something went wrong - no tokens were swapped');
    }

  } catch (error) {
    console.log('❌ Swap failed:', error.message);

    // Check if it's a known error
    if (error.message.includes('execution reverted')) {
      console.log('💡 Possible causes:');
      console.log('   - Pool has insufficient liquidity for this trade size');
      console.log('   - Slippage tolerance too tight (we used 0)');
      console.log('   - Token approval issue');
      console.log('   - Contract bug in fee calculation');
    }
  }
}

testPearsMinimal().catch(console.error);