// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import {PearsRouterV1} from "../src/PearsRouterV1.sol";

contract Deploy is Script {
  function run() external {
    address router02 = 0x2626664c2603336E57B271c5C0b26F421741e481; // Base mainnet Uniswap v3 SwapRouter02
    address feeRecipient = vm.envAddress("FEE_RECIPIENT");

    vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
    new PearsRouterV1(router02, feeRecipient);
    vm.stopBroadcast();
  }
}