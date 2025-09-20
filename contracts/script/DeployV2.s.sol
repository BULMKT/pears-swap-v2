// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import {PearsRouterV2} from "../src/PearsRouterV2.sol";

contract DeployV2 is Script {
  function run() external {
    address feeRecipient = vm.envAddress("FEE_RECIPIENT");

    vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
    PearsRouterV2 router = new PearsRouterV2(feeRecipient);
    console.log("PearsRouterV2 deployed to:", address(router));
    vm.stopBroadcast();
  }
}