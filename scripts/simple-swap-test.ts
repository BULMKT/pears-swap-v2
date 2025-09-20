import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseAbi, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC = process.env.BASE_RPC!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481');

const account = privateKeyToAccount(PK);
const walletClient = createWalletClient({ chain: base, account, transport: http(RPC) });
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const erc20Abi = parseAbi([
  'function approve(address,uint256) external returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)'
]);

async function simpleTest() {
  console.log('🧪 Simple debugging test...');

  // Check balances and allowances
  const [wethBal, allowance] = await Promise.all([
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'allowance', args: [account.address, ROUTER] }),
  ]);

  console.log('WETH balance:', (Number(wethBal) / 1e18).toFixed(6));
  console.log('WETH allowance to router:', (Number(allowance) / 1e18).toFixed(6));

  if (allowance === 0n) {
    console.log('❌ No allowance set - this could be the issue');

    // Set a big allowance
    const maxAllowance = parseUnits('1000', 18);
    console.log('🔄 Setting max allowance...');

    const tx = await walletClient.writeContract({
      address: WETH,
      abi: erc20Abi,
      functionName: 'approve',
      args: [ROUTER, maxAllowance]
    });

    console.log('✅ Allowance set:', tx);
  } else {
    console.log('✅ Allowance is set');
  }

  // Let's try ETH -> WETH first (simpler operation)
  console.log('\n🔄 Testing WETH deposit (ETH -> WETH)...');

  const wethAbi = parseAbi(['function deposit() external payable']);

  try {
    const depositTx = await walletClient.writeContract({
      address: WETH,
      abi: wethAbi,
      functionName: 'deposit',
      value: parseUnits('0.001', 18) // 0.001 ETH
    });

    console.log('✅ WETH deposit successful:', depositTx);
  } catch (e) {
    console.log('❌ WETH deposit failed:', e.message);
  }
}

simpleTest().catch(console.error);