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

    // Mirror event signature from IFlatFee to use in vm.expectEmit
    event FeesWithdrawn(address indexed to, uint256 amount);

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

    function testWithdrawOnlyOwner() public {
        // alice pays fee
        vm.prank(alice);
        mock.pay{value: 1 ether}();
        // non-owner cannot withdraw
        vm.prank(alice);
        vm.expectRevert();
        mock.withdrawFees();
    }

    function testWithdrawEmitsEventAndTransfersToOwner() public {
        // alice pays fee
        vm.prank(alice);
        mock.pay{value: 1 ether}();

    // expect FeesWithdrawn event emitted by the mock contract
    vm.expectEmit(true, false, false, true, address(mock));
    emit FeesWithdrawn(address(this), 1 ether);

    uint256 balBefore = address(this).balance;
        // owner (test contract) withdraws
        mock.withdrawFees();
        assertEq(address(mock).balance, 0);
        assertEq(address(this).balance, balBefore + 1 ether);
    }
}
