import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cache for quotes (TTL: 10 seconds)
const quoteCache = new Map();

// Constants
const FEE_BPS = 8; // 0.08% platform fee
const ZEROX_API_KEY = process.env.ZEROX_API_KEY;
const FEE_RECIPIENT = process.env.FEE_RECIPIENT;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', feeBps: FEE_BPS });
});

// Get quote endpoint - FAST
app.post('/api/quote', async (req, res) => {
  try {
    let { sellToken, buyToken, sellAmount, taker } = req.body;

    // Convert ETH native address to WETH for 0x API
    if (sellToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      sellToken = '0x4200000000000000000000000000000000000006'; // WETH on Base
    }
    if (buyToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      buyToken = '0x4200000000000000000000000000000000000006'; // WETH on Base
    }

    // Cache key
    const cacheKey = `${sellToken}-${buyToken}-${sellAmount}-${taker}`;

    // Check cache first
    const cached = quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10000) {
      console.log('Cache hit for quote');
      return res.json(cached.data);
    }

    console.log('Fetching new quote from 0x...');
    const params = new URLSearchParams({
      chainId: '8453',
      sellToken,
      buyToken,
      sellAmount,
      taker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: FEE_BPS.toString(),
      swapFeeToken: buyToken,
      slippageBps: '200'
    });

    const response = await axios.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2'
        },
        timeout: 3000 // 3 second timeout for speed
      }
    );

    const quoteData = {
      ...response.data,
      validUntil: Date.now() + 30000, // 30 seconds validity
      feeBps: FEE_BPS,
      cachedAt: Date.now()
    };

    // Cache the quote
    quoteCache.set(cacheKey, { data: quoteData, timestamp: Date.now() });

    // Clear old cache entries
    if (quoteCache.size > 100) {
      const firstKey = quoteCache.keys().next().value;
      quoteCache.delete(firstKey);
    }

    res.json(quoteData);
  } catch (error) {
    console.error('Quote error:', error.message);
    res.status(500).json({ error: 'Failed to get quote', details: error.message });
  }
});

// Prepare swap data (no execution, just prep for wallet)
app.post('/api/prepare-swap', async (req, res) => {
  try {
    const { quote } = req.body;

    // Validate quote hasn't expired
    if (!quote.validUntil || Date.now() > quote.validUntil) {
      return res.status(400).json({ error: 'Quote expired, please refresh' });
    }

    // Return transaction data for wallet to sign
    res.json({
      success: true,
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value || '0',
      gas: quote.transaction.gas,
      gasPrice: quote.transaction.gasPrice,
      allowanceTarget: quote.allowanceTarget,
      buyAmount: quote.buyAmount,
      sellAmount: quote.sellAmount
    });
  } catch (error) {
    console.error('Swap prep error:', error.message);
    res.status(500).json({ error: 'Failed to prepare swap' });
  }
});

// ELITE ARCHITECTURE: Quote and execute in one shot - eliminates expiry issues
app.post('/api/quote-and-execute', async (req, res) => {
  try {
    let { sellToken, buyToken, sellAmount, taker } = req.body;

    console.log('🚀 Elite quote-and-execute for:', { sellToken, buyToken, sellAmount, taker });

    // Keep ETH as native for 0x API - DON'T convert to WETH
    // 0x API handles native ETH correctly with the 0xEeee... address
    // Converting to WETH makes 0x think we want WETH tokens (value=0) instead of native ETH

    // Get fresh quote with zero delay
    const params = new URLSearchParams({
      chainId: '8453',
      sellToken,
      buyToken,
      sellAmount,
      taker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: FEE_BPS.toString(),
      swapFeeToken: buyToken,
      slippageBps: '200'
    });

    // Use allowance-holder for all swaps - it handles ETH correctly too
    const response = await axios.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2'
        },
        timeout: 2000 // Fast timeout for elite speed
      }
    );

    const quote = response.data;

    console.log('✅ Fresh quote obtained, returning execution data immediately');
    console.log('🔍 API Response Debug:', {
      inputSellToken: sellToken,
      responseSellToken: quote.sellToken,
      buyAmount: quote.buyAmount,
      value: quote.transaction.value
    });

    // Return fresh transaction data with zero delay
    res.json({
      success: true,
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value || '0',
      gas: quote.transaction.gas,
      gasPrice: quote.transaction.gasPrice,
      allowanceTarget: quote.allowanceTarget,
      buyAmount: quote.buyAmount,
      sellAmount: quote.sellAmount,
      sellToken: quote.sellToken,
      freshQuote: true,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Quote-and-execute error:', error.message);
    res.status(500).json({ error: 'Failed to get fresh quote for execution', details: error.message });
  }
});

// FRESH START endpoint - direct mirror of working terminal approach
app.post('/api/fresh-swap', async (req, res) => {
  try {
    const { sellAmount, taker } = req.body;

    console.log('🍐 FRESH SWAP REQUEST:', { sellAmount, taker });

    // EXACT same parameters that work in terminal
    const params = new URLSearchParams({
      chainId: '8453',
      sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH
      buyToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      sellAmount,
      taker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: FEE_BPS.toString(),
      swapFeeToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      slippageBps: '200'
    });

    const response = await axios.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2'
        },
        timeout: 3000
      }
    );

    const quote = response.data;
    console.log('✅ FRESH QUOTE SUCCESS');
    console.log('🔧 Quote value:', quote.transaction.value);
    console.log('🔧 Quote data length:', quote.transaction.data ? quote.transaction.data.length : 'undefined');
    console.log('🔧 Quote to:', quote.transaction.to);
    console.log('🔧 Full transaction object:', JSON.stringify(quote.transaction, null, 2));

    // Return EXACT transaction data
    res.json({
      success: true,
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value,
      buyAmount: quote.buyAmount,
      sellAmount: quote.sellAmount
    });

  } catch (error) {
    console.error('❌ Fresh swap error:', error.message);
    res.status(500).json({ error: 'Fresh swap failed', details: error.message });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve new frontend
app.get('/fresh', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index-new.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
🍐 PEARS API Server Running
━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Port: ${PORT}
💰 Fee: ${FEE_BPS} bps (0.08%)
🚀 Optimized for speed
━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});