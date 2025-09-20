// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * Minimal exactInputSingle via Uniswap v3 SwapRouter02 on Base,
 * then skim 5 bps from output to feeRecipient, send remainder to user.
 * - No custody: pulls tokenIn from msg.sender only for this call.
 * - No unwrap: tokenOut is ERC20 (e.g., USDC or WETH).
 */
interface ISwapRouter02 {
  struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;            // 500, 3000, 10000
    address recipient;     // this contract (so we can skim)
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
  }
  function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

contract PearsRouterV1 is ReentrancyGuard {
  using SafeERC20 for IERC20;

  address public immutable SWAP_ROUTER02; // Uniswap v3 SwapRouter02
  address public immutable feeRecipient;
  uint256 public constant FEE_BPS = 5;    // 0.05%
  uint256 public constant BPS = 10_000;

  constructor(address _router02, address _feeRecipient) {
    SWAP_ROUTER02 = _router02;
    feeRecipient  = _feeRecipient;
  }

  function swapExactInV3(
    address tokenIn,
    address tokenOut,
    uint24 feeTier,               // try 500 first; fallback 3000 if needed
    uint256 amountIn,
    uint256 amountOutMin,
    uint256 deadline
  ) external nonReentrant returns (uint256 userOut) {
    // 1) Pull tokens from user
    IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
    IERC20(tokenIn).forceApprove(SWAP_ROUTER02, amountIn);

    // 2) Execute swap to THIS contract (so we can skim)
    uint256 out = ISwapRouter02(SWAP_ROUTER02).exactInputSingle(
      ISwapRouter02.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: feeTier,
        recipient: address(this),
        deadline: deadline,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0
      })
    );

    // 3) Skim 5 bps to feeRecipient; send remainder to user
    uint256 fee = (out * FEE_BPS) / BPS;         // rounds down
    userOut = out - fee;
    IERC20(tokenOut).safeTransfer(feeRecipient, fee);
    IERC20(tokenOut).safeTransfer(msg.sender, userOut);
  }
}