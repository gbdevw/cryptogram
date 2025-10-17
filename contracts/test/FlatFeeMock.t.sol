// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FlatFee.sol";

contract FlatFeeMock is FlatFee {
    uint256 public counter;

    function initialize(uint256 fee) external initializer {
        __FlatFee_initialize(fee);
    }

    function pay() external payable collectFee {
        counter += 1;
    }
}

contract FlatFeeMockTest is Test {
    FlatFeeMock mock;
    address alice = vm.addr(1);

    function setUp() public {
        mock = new FlatFeeMock();
        mock.initialize(1 ether);
        vm.deal(alice, 10 ether);
    }

    function testRevertsWhenInsufficientFee() public {
        vm.prank(alice);
        vm.expectRevert();
        mock.pay{value: 0}();
    }

    function testAcceptsExactFee() public {
        vm.prank(alice);
        mock.pay{value: 1 ether}();
        assertEq(mock.counter(), 1);
        assertEq(address(mock).balance, 1 ether);
    }

    function testAcceptsExcessAndKeepsFee() public {
        vm.prank(alice);
        mock.pay{value: 2 ether}();
        // contract should retain only the requested fee
        assertEq(address(mock).balance, 1 ether);
        assertEq(mock.counter(), 1);
    }
}
