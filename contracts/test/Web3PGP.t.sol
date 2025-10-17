// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Web3PGP.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Web3PGPTest is Test {
    Web3PGP pgp;
    address deployer = address(this);

    function setUp() public {
        // Deploy implementation (it disables initializers in constructor)
        Web3PGP impl = new Web3PGP();
        // Prepare calldata for initialize(uint256)
        bytes memory data = abi.encodeWithSelector(Web3PGP.initialize.selector, uint256(0));
        // Deploy proxy pointing to implementation and calling initialize in proxy context
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
    pgp = Web3PGP(payable(address(proxy)));
    }

    function testOwnerIsDeployer() public view {
        // owner should be deployer after initialize
        assertEq(pgp.owner(), deployer);
    }
}
