import 'dotenv/config';
import { createWalletClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const PEARS_V2 = getAddress('0x9453187AFc706EE0cB901DcFF17047be4ce2925F'); // New simplified contract

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });

const erc20Abi = parseAbi(['function approve(address,uint256) external returns (bool)']);
const pearsAbi = parseAbi(['function swapExactInV3(address,address,uint24,uint256,uint256,uint256) returns (uint256)']);

async function testV2() {
  console.log('🍐 Testing PearsRouterV2 (Simplified)');
  console.log('Contract:', PEARS_V2);

  try {
    // Step 1: Approve
    const amountIn = parseUnits('0.001', 18); // 0.001 WETH
    console.log('\n1️⃣ Approving 0.001 WETH...');

    const approveTx = await walletClient.writeContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'approve',
      args: [PEARS_V2, amountIn]
    });
    console.log('✅ Approve:', approveTx);

    // Wait
    console.log('⏳ Waiting 8 seconds...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Step 2: Swap with very generous slippage
    const minOut = parseUnits('2.0', 6); // 2.0 USDC minimum (50% slippage!)
    const deadline = BigInt(Math.floor(Date.now()/1000) + 1200);

    console.log('\n2️⃣ Executing swap with V2...');
    console.log('   Min out: 2.0 USDC (50% slippage tolerance)');

    const swapTx = await walletClient.writeContract({
      address: PEARS_V2,
      abi: pearsAbi,
      functionName: 'swapExactInV3',
      args: [WETH, USDC, 3000, amountIn, minOut, deadline]
    });

    console.log('🎉 V2 SWAP SUCCESS:', swapTx);
    console.log('🔗 Basescan:', `https://basescan.org/tx/${swapTx}`);

    console.log('\n✅ PEARS V2 WORKING!');
    console.log('💰 Check balances - you should see:');
    console.log('   - WETH decreased by 0.001');
    console.log('   - USDC increased by ~3.8');
    console.log('   - Fee recipient got 0.05% of output');

  } catch (error) {
    console.log('\n❌ V2 Error:', error.message);
  }
}

testV2().catch(console.error);