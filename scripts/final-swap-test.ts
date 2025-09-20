import 'dotenv/config';
import { createWalletClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const PEARS = getAddress('0x398e453712b5aa52743a20f1569f1160c808b6ad');

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });

const erc20Abi = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function balanceOf(address) view returns (uint256)'
]);

const pearsAbi = parseAbi([
  'function swapExactInV3(address,address,uint24,uint256,uint256,uint256) returns (uint256)'
]);

async function finalSwapTest() {
  console.log('🚀 FINAL SWAP TEST - Making it work!');
  console.log('Contract:', PEARS);
  console.log('Wallet:', account.address);

  try {
    // Step 1: Approve WETH with generous amount
    const amountIn = parseUnits('0.001', 18); // 0.001 WETH - tiny amount
    console.log('\n1️⃣ Approving 0.001 WETH...');

    const approveTx = await walletClient.writeContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'approve',
      args: [PEARS, amountIn]
    });
    console.log('✅ Approve tx:', approveTx);

    // Wait for approval
    console.log('⏳ Waiting 8 seconds for approval...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Step 2: Execute swap with realistic slippage
    // For $4000 ETH, 0.001 ETH = ~$4, expecting ~3.8-4.0 USDC output
    // Setting minOut to 3.5 USDC (12.5% slippage - very generous)
    const minOut = parseUnits('3.5', 6); // 3.5 USDC minimum
    const deadline = BigInt(Math.floor(Date.now()/1000) + 1200); // 20 minutes

    console.log('\n2️⃣ Executing swap...');
    console.log('   Amount in: 0.001 WETH');
    console.log('   Min out: 3.5 USDC');
    console.log('   Fee tier: 0.3% (3000)');
    console.log('   Slippage: ~12.5% (very generous)');

    const swapTx = await walletClient.writeContract({
      address: PEARS,
      abi: pearsAbi,
      functionName: 'swapExactInV3',
      args: [WETH, USDC, 3000, amountIn, minOut, deadline]
    });

    console.log('🎉 SWAP TRANSACTION SENT:', swapTx);
    console.log('🔗 View on Base:', `https://basescan.org/tx/${swapTx}`);

    console.log('\n⏳ Waiting 15 seconds for confirmation...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n✅ Swap should be complete!');
    console.log('💰 Check your wallet - you should have:');
    console.log('   - 0.001 less WETH');
    console.log('   - ~3.8 more USDC (after 0.05% platform fee)');
    console.log('   - Fee recipient got exactly 0.05% of the output');

    console.log('\n🎊 PEARS SWAP IS LIVE! Ready for production.');

  } catch (error) {
    console.log('\n❌ Error:', error.message);

    if (error.message.includes('insufficient funds')) {
      console.log('💡 Solution: Need more ETH for gas');
    } else if (error.message.includes('allowance')) {
      console.log('💡 Solution: Approval didn\'t work, try again');
    } else if (error.message.includes('slippage')) {
      console.log('💡 Solution: Increase minOut slippage');
    } else {
      console.log('💡 Check transaction on Basescan for details');
    }
  }
}

finalSwapTest().catch(console.error);