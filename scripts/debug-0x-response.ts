import 'dotenv/config';
import axios from 'axios';
import { getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ZEROX_API_KEY = process.env.ZEROX_API_KEY!;
const PK = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
const FEE_RECIPIENT = getAddress(process.env.FEE_RECIPIENT!);

const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const account = privateKeyToAccount(PK);

async function debug0xResponse() {
  console.log('🔍 Debugging 0x API response structure...');

  const params = new URLSearchParams({
    chainId: '8453',
    sellToken: WETH,
    buyToken: USDC,
    sellAmount: '10000000000000000', // 0.01 WETH in wei
    taker: account.address,
    feeRecipient: FEE_RECIPIENT,
    buyTokenPercentageFee: '0.0005',
    slippagePercentage: '0.01',
  });

  try {
    const response = await axios.get(
      `https://api.0x.org/swap/permit2/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2',
        },
      }
    );

    console.log('\n📋 Full 0x API Response:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n🔍 Key fields:');
    console.log('transaction.to:', response.data.transaction?.to);
    console.log('transaction.data:', response.data.transaction?.data ? 'Present' : 'Missing');
    console.log('transaction.value:', response.data.transaction?.value);
    console.log('transaction.gas:', response.data.transaction?.gas);

  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response?.data) {
      console.log('Response data:', error.response.data);
    }
  }
}

debug0xResponse().catch(console.error);