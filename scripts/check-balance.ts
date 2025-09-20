import 'dotenv/config';
import { createPublicClient, http, formatEther, getAddress } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC!) });
const wallet = getAddress('0x2c88Ac69801b46E62542cBe933694BbcD686C436');
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

async function checkBalances() {
  const [ethBal, wethBal, usdcBal] = await Promise.all([
    client.getBalance({ address: wallet }),
    client.readContract({
      address: WETH,
      abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [wallet]
    }),
    client.readContract({
      address: USDC,
      abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [wallet]
    })
  ]);

  console.log('🚀 Wallet Balance Check:');
  console.log('ETH Balance:', formatEther(ethBal));
  console.log('WETH Balance:', formatEther(wethBal));
  console.log('USDC Balance:', (Number(usdcBal) / 1e6).toFixed(6)); // USDC has 6 decimals

  if (ethBal < 1000000000000000n) { // Less than 0.001 ETH
    console.log('⚠️  Low ETH balance - may need more for gas');
  }

  if (wethBal === 0n) {
    console.log('⚠️  No WETH balance - need to wrap some ETH first');
  }
}

checkBalances().catch(console.error);