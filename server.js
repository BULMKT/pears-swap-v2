import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

// OPTIMIZATION: HTTP Keep-Alive Agent for connection reuse
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10
});

// Create optimized axios instance with keep-alive
const axiosOptimized = axios.create({
  httpsAgent: keepAliveAgent,
  timeout: 2000, // Faster timeout for optimized endpoint
  headers: {
    'Connection': 'keep-alive'
  }
});

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

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', feeBps: FEE_BPS });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', feeBps: FEE_BPS, optimized: true });
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

    const response = await axiosOptimized.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2'
        }
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
    const response = await axiosOptimized.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2'
        }
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

    const response = await axiosOptimized.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2'
        }
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

// Serve test-design as the main page (user's preferred UI)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve V3 Multi-token frontend (main interface)
app.get('/v3', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index-v3.html'));
});

// Serve test design
app.get('/test-design', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-design.html'));
});

// Serve roadmap page
app.get('/roadmap', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'roadmap.html'));
});

// Serve v3.5 (new main interface)
app.get('/v3-5', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'v3-5.html'));
});

// Serve terms page
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

// Serve technology page
app.get('/technology', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'technology.html'));
});

// Serve privacy policy page
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// OPTIMIZED endpoint with keep-alive and performance improvements
app.post('/api/fresh-swap-optimized', async (req, res) => {
  const startTime = Date.now();
  try {
    const { sellAmount, taker } = req.body;

    console.log('⚡ OPTIMIZED SWAP REQUEST:', { sellAmount, taker });

    // Use optimized parameters
    const params = new URLSearchParams({
      chainId: '8453',
      sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH
      buyToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      sellAmount,
      taker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: FEE_BPS.toString(),
      swapFeeToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      slippageBps: '200',
      skipValidation: 'false' // Ensure proper validation
    });

    // Use optimized axios with keep-alive
    const response = await axiosOptimized.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2',
          'Accept-Encoding': 'gzip, deflate' // Enable compression
        }
      }
    );

    const quote = response.data;
    const responseTime = Date.now() - startTime;

    console.log(`✅ OPTIMIZED QUOTE in ${responseTime}ms`);
    console.log('🔧 Buy amount:', quote.buyAmount);

    // Return with performance metrics
    res.json({
      success: true,
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value,
      buyAmount: quote.buyAmount,
      sellAmount: quote.sellAmount,
      responseTime // Include timing for client metrics
    });

  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`❌ Optimized swap error after ${errorTime}ms:`, error.message);
    res.status(500).json({
      error: 'Optimized swap failed',
      details: error.message,
      responseTime: errorTime
    });
  }
});

// V3: Multi-token dynamic quote endpoint
app.post('/api/v3-quote', async (req, res) => {
  const startTime = Date.now();
  try {
    const { sellToken, buyToken, sellAmount, taker } = req.body;

    console.log('🎯 V3 MULTI-TOKEN QUOTE:', { sellToken, buyToken, sellAmount, taker });

    // Use fallback taker if zero address provided
    const validTaker = taker && taker !== '0x0000000000000000000000000000000000000000'
      ? taker
      : '0xe24366fc2F73287bd94434E30C54fC228FD731c9'; // Fallback address

    // Parameters for any-token swap
    const params = new URLSearchParams({
      chainId: '8453',
      sellToken,
      buyToken,
      sellAmount,
      taker: validTaker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: FEE_BPS.toString(),
      swapFeeToken: buyToken,
      slippageBps: '150', // Tighter slippage for speed
      enableSlippageProtection: 'true'
    });

    // Use optimized axios with keep-alive
    const response = await axiosOptimized.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        },
        timeout: 1200 // Fast timeout for V3
      }
    );

    const quote = response.data;
    const responseTime = Date.now() - startTime;

    console.log(`✅ V3 QUOTE in ${responseTime}ms`);
    console.log('💱 Swap:', `${quote.sellAmount} ${sellToken.slice(0, 6)}... → ${quote.buyAmount} ${buyToken.slice(0, 6)}...`);

    res.json({
      success: true,
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value,
      buyAmount: quote.buyAmount,
      sellAmount: quote.sellAmount,
      sellToken: quote.sellToken,
      buyToken: quote.buyToken,
      responseTime,
      v3: true,
      multiToken: true
    });

  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`❌ V3 quote error after ${errorTime}ms:`, error.message);
    res.status(500).json({
      error: 'V3 multi-token quote failed',
      details: error.message,
      responseTime: errorTime,
      v3: true
    });
  }
});

// V3: Token price endpoint (for live pricing)
app.get('/api/v3-price/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const baseToken = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC

    console.log('💰 V3 PRICE REQUEST:', tokenAddress);

    const params = new URLSearchParams({
      chainId: '8453',
      sellToken: tokenAddress,
      buyToken: baseToken,
      sellAmount: '1000000000000000000', // 1 token in wei
    });

    const response = await axiosOptimized.get(
      `https://api.0x.org/swap/allowance-holder/price?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2'
        },
        timeout: 1000
      }
    );

    const priceData = response.data;
    console.log('✅ Price fetched:', priceData.buyAmount);

    res.json({
      price: priceData.buyAmount,
      sellToken: tokenAddress,
      buyToken: baseToken,
      timestamp: Date.now(),
      v3: true
    });

  } catch (error) {
    console.error('❌ V3 price error:', error.message);
    res.status(500).json({
      error: 'Failed to get token price',
      details: error.message,
      v3: true
    });
  }
});

// V3: Token metadata validation endpoint
app.get('/api/v3-token/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // Validate it's a proper contract address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid token address format' });
    }

    console.log('🔍 V3 TOKEN VALIDATION:', address);

    // Try to get token info from 0x price endpoint (validates it's tradeable)
    const params = new URLSearchParams({
      chainId: '8453',
      sellToken: address,
      buyToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      sellAmount: '1000000000000000000', // 1 token
    });

    try {
      const response = await axiosOptimized.get(
        `https://api.0x.org/swap/allowance-holder/price?${params}`,
        {
          headers: {
            '0x-api-key': ZEROX_API_KEY,
            '0x-version': 'v2'
          },
          timeout: 1000
        }
      );

      console.log('✅ Token validated - tradeable on 0x');

      res.json({
        valid: true,
        address: address,
        tradeable: true,
        price: response.data.buyAmount,
        timestamp: Date.now(),
        v3: true
      });

    } catch (priceError) {
      // Token exists but may not be tradeable
      console.log('⚠️ Token not tradeable on 0x');
      res.status(400).json({
        valid: false,
        address: address,
        tradeable: false,
        error: 'Token not supported for trading',
        v3: true
      });
    }

  } catch (error) {
    console.error('❌ V3 token validation error:', error.message);
    res.status(500).json({
      error: 'Token validation failed',
      details: error.message,
      v3: true
    });
  }
});

// PHASE 2: FLASHBLOCKS ENDPOINT - Optimized for Speed + Robustness
app.post('/api/fresh-swap-phase2', async (req, res) => {
  const startTime = Date.now();
  try {
    const { sellAmount, taker } = req.body;

    console.log('⚡ PHASE 2 FLASHBLOCKS REQUEST:', { sellAmount, taker });

    // Optimized parameters: Balance of speed + robustness
    const params = new URLSearchParams({
      chainId: '8453',
      sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      buyToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      sellAmount,
      taker,
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: FEE_BPS.toString(),
      swapFeeToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      slippageBps: '150', // Tighter slippage for protection
      enableSlippageProtection: 'true' // Keep protection
      // Removed: skipValidation for speed optimization
    });

    // Streamlined request - keep essential enhancements only
    const response = await axiosOptimized.get(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          '0x-api-key': ZEROX_API_KEY,
          '0x-version': 'v2',
          'Accept-Encoding': 'gzip, deflate', // Simplified compression
          'Connection': 'keep-alive'
          // Removed: Custom User-Agent for speed
        },
        timeout: 1200 // Aggressive but safe timeout
      }
    );

    const quote = response.data;
    const responseTime = Date.now() - startTime;

    console.log(`✅ PHASE 2 OPTIMIZED in ${responseTime}ms`);
    console.log('⚡ Buy amount:', quote.buyAmount);

    // Minimal but essential metadata
    res.json({
      success: true,
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value,
      buyAmount: quote.buyAmount,
      sellAmount: quote.sellAmount,
      responseTime,
      flashblocksReady: true,
      phase: 2
    });

  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`❌ Phase 2 error after ${errorTime}ms:`, error.message);
    res.status(500).json({
      error: 'Phase 2 swap failed',
      details: error.message,
      responseTime: errorTime,
      phase: 2
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
🍐 PEARS API Server Running
━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Port: ${PORT}
💰 Fee: ${FEE_BPS} bps (0.08%)
🚀 Phase 1: Optimized for speed
⚡ Phase 2: Flashblocks enabled (200ms)
💸 Production: Cost optimized (zero auto-requests)
🎯 V3: Multi-token swap with balance detection
━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Endpoints:
   /fresh      - Working version
   /optimized  - Phase 1 optimizations
   /phase2     - Phase 2 Flashblocks (DEV)
   /production - Cost optimized (RECOMMENDED)
   /v3         - Multi-token swap (NEW)
━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});