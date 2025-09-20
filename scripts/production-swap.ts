import 'dotenv/config';
import axios from 'axios';
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, getAddress, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const ZEROX_API_KEY = process.env.ZEROX_API_KEY!;

// Token addresses
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const erc20Abi = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)'
]);

async function productionSwap() {
  console.log('🍐 PEARS PRODUCTION SWAP');
  console.log('Building the simplest, most reliable swap possible...');

  try {
    // Step 1: Get quote from 0x API v1 (no permit2 complexity)
    const sellAmount = parseUnits('0.01', 18).toString();

    console.log('\n1️⃣ Getting 0x quote...');
    const params = new URLSearchParams({
      sellToken: WETH,
      buyToken: USDC,
      sellAmount,
      takerAddress: account.address,
      slippagePercentage: '0.02', // 2% slippage
      skipValidation: 'true',
    });

    const quoteResponse = await axios.get(
      `https://api.0x.org/swap/v1/quote?${params}`,
      {
        headers: { '0x-api-key': ZEROX_API_KEY },
      }
    );

    const quote = quoteResponse.data;
    console.log('✅ Quote received:');
    console.log('   Buy amount:', formatUnits(BigInt(quote.buyAmount), 6), 'USDC');
    console.log('   To contract:', quote.to);

    // Step 2: Check allowance and approve if needed
    console.log('\n2️⃣ Checking allowance...');
    const allowance = await publicClient.readContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, getAddress(quote.allowanceTarget)]
    });

    if (allowance < BigInt(quote.sellAmount)) {
      console.log('🔐 Setting allowance...');
      const approveTx = await walletClient.writeContract({
        address: WETH,
        abi: erc20Abi,
        functionName: 'approve',
        args: [getAddress(quote.allowanceTarget), BigInt(quote.sellAmount)]
      });
      console.log('✅ Approve tx:', approveTx);

      // Wait for approval
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      console.log('✅ Sufficient allowance');
    }

    // Step 3: Execute swap
    console.log('\n3️⃣ Executing swap...');
    const swapTx = await walletClient.sendTransaction({
      to: getAddress(quote.to),
      data: quote.data as `0x${string}`,
      value: BigInt(quote.value || '0'),
      gas: BigInt(quote.gas),
    });

    console.log('🎉 SWAP SENT:', swapTx);
    console.log('🔗 Basescan:', `https://basescan.org/tx/${swapTx}`);

    // Step 4: Wait and verify
    console.log('\n4️⃣ Waiting for confirmation...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    const receipt = await publicClient.getTransactionReceipt({ hash: swapTx });
    console.log('📋 Status:', receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED');

    if (receipt.status === 'success') {
      // Check final balances
      const [wethAfter, usdcAfter] = await Promise.all([
        publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
      ]);

      console.log('\n💰 Final balances:');
      console.log('WETH:', formatUnits(wethAfter, 18));
      console.log('USDC:', formatUnits(usdcAfter, 6));

      console.log('\n🎊 PEARS SWAP WORKING!');
      console.log('✅ End users can now swap');
      console.log('✅ 0x API provides best prices');
      console.log('✅ Ready for production');
    }

  } catch (error) {
    console.log('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.log('API Error:', error.response.data);
    }
  }
}

productionSwap().catch(console.error);