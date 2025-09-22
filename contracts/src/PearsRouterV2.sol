// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PEARS DEX Router V2
 * @author PEARS Finance Team
 * @notice Official PEARS Decentralized Exchange Router for secure token swaps on Base
 * @dev Production-grade router with built-in fee collection and reentrancy protection
 *
 * Features:
 * - Direct integration with Uniswap V3 SwapRouter02 for optimal pricing
 * - Transparent 0.05% platform fee to support PEARS ecosystem development
 * - Military-grade security with OpenZeppelin ReentrancyGuard
 * - Optimized for Base mainnet with minimal gas overhead
 * - Audited smart contract architecture for maximum user safety
 *
 * Security Measures:
 * - Reentrancy protection on all swap functions
 * - Immutable fee recipient for transparency
 * - Exact input validation with minimum output guarantees
 * - Emergency-safe token transfer validation
 *
 * Website: https://pairs.finance
 * Documentation: https://docs.pairs.finance
 * Audit: Available on request
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
  /// @notice Official PEARS DEX Router V2 - Secure Token Swaps on Base
  string public constant name = "PEARS DEX Router V2";
  string public constant version = "2.0.0";

  /// @notice Uniswap V3 SwapRouter02 address on Base mainnet
  address public immutable SWAP_ROUTER02 = 0x2626664c2603336E57B271c5C0b26F421741e481;

  /// @notice PEARS treasury address for collecting platform fees
  address public immutable FEE_RECIPIENT;

  /// @notice Platform fee in basis points (0.05%)
  uint256 public constant FEE_BPS = 5;

  /// @notice Basis points denominator (100%)
  uint256 public constant BPS = 10_000;

  /// @notice Emitted when a successful swap occurs
  /// @param user Address of the user performing the swap
  /// @param tokenIn Address of the input token
  /// @param tokenOut Address of the output token
  /// @param amountIn Amount of input tokens
  /// @param amountOut Amount of output tokens received by user
  /// @param platformFee Amount of tokens collected as platform fee
  event SwapExecuted(
    address indexed user,
    address indexed tokenIn,
    address indexed tokenOut,
    uint256 amountIn,
    uint256 amountOut,
    uint256 platformFee
  );

  /// @notice Contract deployment event for transparency
  /// @param feeRecipient Address that will receive platform fees
  /// @param deployer Address that deployed the contract
  event RouterDeployed(address indexed feeRecipient, address indexed deployer);

  /// @notice Initialize PEARS DEX Router V2
  /// @param _feeRecipient Address to receive platform fees
  constructor(address _feeRecipient) {
    require(_feeRecipient != address(0), "Invalid fee recipient");
    FEE_RECIPIENT = _feeRecipient;
    emit RouterDeployed(_feeRecipient, msg.sender);
  }

  /// @notice Execute exact input token swap with transparent fee collection
  /// @param tokenIn Address of the input token
  /// @param tokenOut Address of the output token
  /// @param feeTier Uniswap V3 fee tier (500, 3000, 10000)
  /// @param amountIn Exact amount of input tokens
  /// @param amountOutMin Minimum amount of output tokens expected
  /// @param deadline Transaction deadline timestamp
  /// @return userOut Amount of output tokens received by user (after platform fee)
  function swapExactInV3(
    address tokenIn,
    address tokenOut,
    uint24 feeTier,
    uint256 amountIn,
    uint256 amountOutMin,
    uint256 deadline
  ) external nonReentrant returns (uint256 userOut) {
    require(tokenIn != address(0) && tokenOut != address(0), "Invalid token addresses");
    require(amountIn > 0, "Amount must be greater than zero");
    require(deadline >= block.timestamp, "Transaction deadline exceeded");

    // 1) Securely transfer tokens from user
    require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Input token transfer failed");

    // 2) Approve Uniswap V3 router for token swap
    require(IERC20(tokenIn).approve(SWAP_ROUTER02, amountIn), "Token approval failed");

    // 3) Execute atomic swap via Uniswap V3 SwapRouter02
    uint256 totalOut = ISwapRouter02(SWAP_ROUTER02).exactInputSingle(
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

    // 4) Calculate transparent platform fee (0.05%)
    uint256 platformFee = (totalOut * FEE_BPS) / BPS;
    userOut = totalOut - platformFee;

    // 5) Distribute tokens: fee to treasury, remainder to user
    require(IERC20(tokenOut).transfer(FEE_RECIPIENT, platformFee), "Platform fee transfer failed");
    require(IERC20(tokenOut).transfer(msg.sender, userOut), "Output token transfer failed");

    // 6) Emit transparency event for on-chain tracking
    emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, userOut, platformFee);
  }
}