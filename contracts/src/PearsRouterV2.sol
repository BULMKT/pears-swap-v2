// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * Simplified PearsRouter for Base mainnet
 * - Direct Uniswap v3 SwapRouter02 calls
 * - Exact 5 bps (0.05%) fee on output
 * - No SafeERC20 complexity
 */
interface ISwapRouter02 {
  struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
  }
  function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

contract PearsRouterV2 is ReentrancyGuard {
  address public immutable SWAP_ROUTER02 = 0x2626664c2603336E57B271c5C0b26F421741e481;
  address public immutable FEE_RECIPIENT;
  uint256 public constant FEE_BPS = 5;    // 0.05%
  uint256 public constant BPS = 10_000;

  constructor(address _feeRecipient) {
    FEE_RECIPIENT = _feeRecipient;
  }

  function swapExactInV3(
    address tokenIn,
    address tokenOut,
    uint24 feeTier,
    uint256 amountIn,
    uint256 amountOutMin,
    uint256 deadline
  ) external nonReentrant returns (uint256 userOut) {
    // 1) Pull tokens from user
    require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Transfer failed");

    // 2) Approve router
    require(IERC20(tokenIn).approve(SWAP_ROUTER02, amountIn), "Approve failed");

    // 3) Execute swap to THIS contract
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

    // 4) Calculate and transfer fees
    uint256 fee = (out * FEE_BPS) / BPS;
    userOut = out - fee;

    // Send fee to recipient
    require(IERC20(tokenOut).transfer(FEE_RECIPIENT, fee), "Fee transfer failed");

    // Send remainder to user
    require(IERC20(tokenOut).transfer(msg.sender, userOut), "User transfer failed");
  }
}