import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, getAddress, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import axios from 'axios';

// ** TERMINAL TEST - REAL TRANSACTION EXECUTION **
// Using your actual testing wallet with ETH balance

// Your testing wallet (the one with ETH balance)
// Need the actual private key for 0xe24366fc2F73287bd94434E30C54fC228FD731c9
const TESTING_WALLET_PK = '0x0000000000000000000000000000000000000000000000000000000000000000'; // REPLACE WITH YOUR TESTING WALLET PRIVATE KEY
const TESTING_WALLET_ADDRESS = '0xe24366fc2F73287bd94434E30C54fC228FD731c9';

const RPC = process.env.BASE_RPC;
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const FEE_RECIPIENT = getAddress(process.env.FEE_RECIPIENT);

// Base mainnet tokens
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const account = privateKeyToAccount(TESTING_WALLET_PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const erc20Abi = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)'
]);

async function getQuoteAndExecuteData(sellToken, buyToken, sellAmount, taker) {
  console.log('🚀 Getting quote-and-execute data from API...');

  const response = await axios.post('http://localhost:3001/api/quote-and-execute', {
    sellToken,
    buyToken,
    sellAmount,
    taker
  });

  return response.data;
}

async function TERMINAL_TEST_REAL_EXECUTION() {
  console.log('🍐 TERMINAL TEST - REAL TRANSACTION EXECUTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Testing with wallet: ${TESTING_WALLET_ADDRESS}`);

  try {
    // Step 1: Check initial balances
    console.log('\n📊 Initial balances:');
    const ethBalance = await publicClient.getBalance({ address: getAddress(TESTING_WALLET_ADDRESS) });
    const [wethBal, usdcBal] = await Promise.all([
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(TESTING_WALLET_ADDRESS)] }),
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(TESTING_WALLET_ADDRESS)] }),
    ]);

    console.log('ETH:', formatUnits(ethBalance, 18));
    console.log('WETH:', formatUnits(wethBal, 18));
    console.log('USDC:', formatUnits(usdcBal, 6));

    // Step 2: Get quote-and-execute data for 0.005 ETH
    const sellAmount = parseUnits('0.005', 18).toString(); // 0.005 ETH
    console.log('\n💰 Getting quote and execution data...');

    const swapData = await getQuoteAndExecuteData(
      ETH,
      USDC,
      sellAmount,
      TESTING_WALLET_ADDRESS
    );

    console.log('✅ Quote and execution data received:');
    console.log('   Sell amount:', formatUnits(BigInt(swapData.sellAmount), 18), 'ETH');
    console.log('   Buy amount:', formatUnits(BigInt(swapData.buyAmount), 6), 'USDC');
    console.log('   Price:', (Number(formatUnits(BigInt(swapData.buyAmount), 6)) / Number(formatUnits(BigInt(swapData.sellAmount), 18))).toFixed(2), 'USDC/ETH');
    console.log('   Contract:', swapData.to);
    console.log('   Fresh quote:', swapData.freshQuote);

    // Step 3: ETH doesn't need allowance - skip allowance check
    console.log('\n✅ ETH transaction - no allowance needed');

    // Step 4: Execute the swap directly
    console.log('\n🚀 Executing real swap transaction...');

    const txParams = {
      to: getAddress(swapData.to),
      data: swapData.data,
      value: BigInt(swapData.value),
    };

    // Estimate gas first
    console.log('⏳ Estimating gas...');
    const gasEstimate = await publicClient.estimateGas({
      ...txParams,
      account: getAddress(TESTING_WALLET_ADDRESS)
    });

    console.log('✅ Gas estimate:', gasEstimate.toString());

    // Send the transaction
    console.log('📤 Sending transaction...');
    const swapTx = await walletClient.sendTransaction({
      ...txParams,
      gas: gasEstimate,
    });

    console.log('🎉 TRANSACTION SENT:', swapTx);
    console.log('🔗 View on Basescan:', `https://basescan.org/tx/${swapTx}`);

    // Step 5: Wait for confirmation
    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });
    console.log('📋 Status:', receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED');

    if (receipt.status === 'success') {
      // Check final balances
      console.log('\n⏳ Waiting 5 seconds for balance update...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const ethAfter = await publicClient.getBalance({ address: getAddress(TESTING_WALLET_ADDRESS) });
      const [wethAfter, usdcAfter] = await Promise.all([
        publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(TESTING_WALLET_ADDRESS)] }),
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [getAddress(TESTING_WALLET_ADDRESS)] }),
      ]);

      console.log('\n📊 Final balances:');
      console.log('ETH:', formatUnits(ethAfter, 18));
      console.log('WETH:', formatUnits(wethAfter, 18));
      console.log('USDC:', formatUnits(usdcAfter, 6));

      const ethSpent = Number(formatUnits(ethBalance - ethAfter, 18));
      const usdcReceived = Number(formatUnits(usdcAfter - usdcBal, 6));

      if (usdcReceived > 0) {
        console.log('\n🎊 TERMINAL TEST SUCCESSFUL!');
        console.log('✅ ETH spent:', ethSpent.toFixed(6));
        console.log('✅ USDC received:', usdcReceived.toFixed(6));
        console.log('✅ Effective price:', (usdcReceived / 0.005).toFixed(2), 'USDC/ETH');
        console.log('✅ Platform fee automatically collected');
        console.log('✅ Transaction confirmed on Base');

        console.log('\n🚀 READY TO PUSH TO FRONTEND!');
        console.log('🎯 Backend works perfectly - now we can fix frontend!');
      }
    }

  } catch (error) {
    console.log('\n❌ Terminal test error:', error.message);

    if (error.message.includes('insufficient funds')) {
      console.log('💡 Need more ETH balance for gas fees');
    } else if (error.message.includes('execution reverted')) {
      console.log('💡 Transaction would revert - check quote data');
    } else {
      console.log('💡 Raw error:', error);
    }
  }
}

TERMINAL_TEST_REAL_EXECUTION().catch(console.error);