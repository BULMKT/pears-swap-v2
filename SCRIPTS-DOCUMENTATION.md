# 📋 SCRIPTS DOCUMENTATION

## Script Overview

This document provides detailed information about all TypeScript scripts in the `scripts/` directory and their specific purposes in the PEARS Swap development journey.

## 🎯 PRODUCTION SCRIPT (WORKING)

### `PEARS-PRODUCTION-READY.ts` ⭐

**Status**: ✅ **WORKING PRODUCTION SOLUTION**

**Purpose**: Final production-ready swap implementation using 0x API v2 Allowance Holder

**Key Features**:
- Uses 0x API v2 `/swap/allowance-holder/quote` endpoint
- Automatic 0.5% fee collection via `swapFeeRecipient`
- No permit2 signature complexity
- MEV protection built-in
- Best price aggregation across all Base DEXs

**How to Run**:
```bash
npx tsx scripts/PEARS-PRODUCTION-READY.ts
```

**Last Test Result**: ✅ SUCCESS
- TX: [0xa92c354ab217b2545c0d0e7123618b5b225480ca50de93bb0acd3bdc7c97cac4](https://basescan.org/tx/0xa92c354ab217b2545c0d0e7123618b5b225480ca50de93bb0acd3bdc7c97cac4)
- Swapped: 0.01 WETH → 44.61 USDC
- Price: 4,461.26 USDC/WETH

---

## 🔧 DEVELOPMENT SCRIPTS (TESTING/DEBUGGING)

### `production-swap.ts`

**Status**: ⚠️ Partial (0x API v1)

**Purpose**: Initial attempt using 0x API v1

**Issues**:
- No built-in fee collection mechanism
- Limited to basic swap functionality
- Required manual fee implementation

**Key Learning**: Led us to discover 0x API v2 was needed for fee collection

---

### `FINAL-PRODUCTION-SWAP.ts`

**Status**: ❌ Failed (Direct Uniswap)

**Purpose**: Direct Uniswap v3 SwapRouter02 integration attempt

**Issues**:
- All swaps failed with "execution reverted"
- Tried multiple fee tiers (500, 3000, 10000 bps)
- Pool liquidity/parameter issues on Base

**Key Learning**: Direct Uniswap approach too complex for production

---

### `ULTIMATE-FINAL-SWAP.ts`

**Status**: ❌ Failed (USDbC Alternative)

**Purpose**: Fallback attempt using USDbC (bridged USDC) instead of native USDC

**Issues**:
- Still failed with direct Uniswap calls
- Tried very small amounts (0.001 WETH) with 80% slippage tolerance
- Confirmed issue was not token-specific

**Key Learning**: Problem was with direct Uniswap integration, not token choice

---

## 🔍 UTILITY SCRIPTS

### `verify-tokens.ts`

**Status**: ✅ Working

**Purpose**: Verify token contract addresses and metadata on Base

**Output**:
- Token name, symbol, and decimals
- Confirms contracts are valid and accessible
- Useful for debugging token-related issues

**How to Run**:
```bash
npx tsx scripts/verify-tokens.ts
```

---

## 📊 SCRIPT EVOLUTION TIMELINE

1. **`verify-tokens.ts`** - First script to verify Base token contracts exist
2. **`FINAL-PRODUCTION-SWAP.ts`** - Direct Uniswap approach (failed)
3. **`ULTIMATE-FINAL-SWAP.ts`** - USDbC alternative attempt (failed)
4. **`production-swap.ts`** - 0x API v1 approach (partial success)
5. **`PEARS-PRODUCTION-READY.ts`** - 0x API v2 Allowance Holder (SUCCESS!)

## 🎯 KEY INSIGHTS FROM DEVELOPMENT

### What Didn't Work

1. **Direct Uniswap v3 Calls**: Despite correct contract addresses and parameters, all direct Uniswap calls failed
2. **Multiple Token Attempts**: Tried both native USDC and bridged USDbC
3. **Conservative Parameters**: Even with 80% slippage tolerance and tiny amounts
4. **Multiple Fee Tiers**: Tested 0.05%, 0.3%, and 1% fee pools

### What Worked

1. **0x API v2 Allowance Holder**: Professional-grade aggregation with built-in fee collection
2. **Simple Approve/Execute Pattern**: No complex permit2 signatures required
3. **Automatic Routing**: 0x handles all the complex DEX interactions
4. **Production Reliability**: 99.9% uptime and MEV protection

## 🚀 PRODUCTION DEPLOYMENT

For production deployment, **ONLY** use `PEARS-PRODUCTION-READY.ts` as the base implementation.

### Required Environment Variables

```bash
BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
ZEROX_API_KEY=748fba8c-0b12-4d87-9b3c-471d989012c1
PRIVATE_KEY=362db9ce0cc241489eab3d53832e5f426588b0681e38941aa386427019799f5c
FEE_RECIPIENT=0x2c88Ac69801b46E62542cBe933694BbcD686C436
```

### Frontend Integration

Convert `PEARS-PRODUCTION-READY.ts` into an API endpoint that accepts:
- `sellToken` address
- `buyToken` address
- `sellAmount` in wei
- `userAddress` for the swap

The script already handles all the complex parts:
- Quote fetching
- Allowance checking/setting
- Transaction execution
- Status verification

---

*This documentation tracks our complete development journey to production-ready swaps* 🍐