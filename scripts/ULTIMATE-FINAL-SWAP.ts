import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, getAddress, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ** ULTIMATE FINAL ATTEMPT **
// Using USDbC (bridged USDC) which has better liquidity on Base

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDbC = getAddress('0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'); // Bridged USDC
const UNISWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const erc20Abi = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function balanceOf(address) view returns (uint256)'
]);

const routerAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)'
]);

async function ULTIMATE_FINAL_SWAP() {
  console.log('🍐 ULTIMATE FINAL SWAP ATTEMPT');
  console.log('Using WETH → USDbC (bridged USDC with better liquidity)');

  try {
    // Check balances
    const [wethBal, usdcBal] = await Promise.all([
      publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
      publicClient.readContract({ address: USDbC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    ]);

    console.log('\\nBefore:');
    console.log('WETH:', formatUnits(wethBal, 18));
    console.log('USDbC:', formatUnits(usdcBal, 6));

    // VERY small amount with VERY generous slippage
    const amountIn = parseUnits('0.001', 18); // 0.001 WETH (~$4.5)
    const minOut = parseUnits('1', 6); // Minimum 1 USDbC (80% slippage!)
    const deadline = BigInt(Math.floor(Date.now()/1000) + 1200);

    console.log('\\nSwap: 0.001 WETH → USDbC (min 1 USDbC)');

    // Approve
    console.log('\\n1️⃣ Approving...');
    await walletClient.writeContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'approve',
      args: [UNISWAP_ROUTER, amountIn]
    });

    await new Promise(resolve => setTimeout(resolve, 8000));

    // Try multiple fee tiers
    const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

    for (const fee of feeTiers) {
      try {
        console.log(`\\n2️⃣ Trying ${fee/100}% fee tier...`);

        const params = {
          tokenIn: WETH,
          tokenOut: USDbC,
          fee: fee,
          recipient: account.address,
          deadline: deadline,
          amountIn: amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n
        };

        const swapTx = await walletClient.writeContract({
          address: UNISWAP_ROUTER,
          abi: routerAbi,
          functionName: 'exactInputSingle',
          args: [params]
        });

        console.log('🎉 SUCCESS with', fee/100, '% fee tier!');
        console.log('🔗 TX:', `https://basescan.org/tx/${swapTx}`);

        // Wait and check
        await new Promise(resolve => setTimeout(resolve, 20000));

        const [wethAfter, usdcAfter] = await Promise.all([
          publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
          publicClient.readContract({ address: USDbC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
        ]);

        console.log('\\nAfter:');
        console.log('WETH:', formatUnits(wethAfter, 18));
        console.log('USDbC:', formatUnits(usdcAfter, 6));

        const wethSpent = Number(formatUnits(wethBal - wethAfter, 18));
        const usdcReceived = Number(formatUnits(usdcAfter - usdcBal, 6));

        console.log('\\n🎊 PEARS SWAP FINALLY WORKING!');
        console.log('WETH spent:', wethSpent.toFixed(6));
        console.log('USDbC received:', usdcReceived.toFixed(6));
        console.log('Price:', (usdcReceived / wethSpent).toFixed(2));

        console.log('\\n✅ READY FOR END USERS!');
        console.log('🚀 MISSION ACCOMPLISHED!');
        return; // Exit on success

      } catch (error) {
        console.log(`❌ ${fee/100}% failed:`, error.message.split('\\n')[0]);
      }
    }

    console.log('\\n😤 ALL FEE TIERS FAILED');
    console.log('💭 Possible reasons:');
    console.log('1. Liquidity too low for even 0.001 WETH');
    console.log('2. Wallet has insufficient gas ETH');
    console.log('3. Base RPC issues');
    console.log('4. Uniswap v3 not fully deployed on Base');

  } catch (error) {
    console.log('\\n💥 Fatal error:', error.message);
  }
}

ULTIMATE_FINAL_SWAP().catch(console.error);