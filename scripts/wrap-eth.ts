import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseUnits, getAddress, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const WETH = getAddress('0x4200000000000000000000000000000000000006');

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const wethAbi = parseAbi([
  'function deposit() external payable',
  'function balanceOf(address) view returns (uint256)'
]);

async function wrapETH() {
  const amountToWrap = parseUnits('0.02', 18); // Wrap 0.02 ETH to WETH

  console.log('🔄 Wrapping', '0.02', 'ETH to WETH...');

  const txHash = await walletClient.writeContract({
    address: WETH,
    abi: wethAbi,
    functionName: 'deposit',
    value: amountToWrap
  });

  console.log('✅ Wrap transaction:', txHash);
  console.log('⏳ Waiting for confirmation...');

  // Wait for transaction to be mined
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check new WETH balance
  const wethBalance = await publicClient.readContract({
    address: WETH,
    abi: wethAbi,
    functionName: 'balanceOf',
    args: [account.address]
  });

  console.log('🎉 New WETH balance:', (Number(wethBalance) / 1e18).toFixed(6));
}

wrapETH().catch(console.error);