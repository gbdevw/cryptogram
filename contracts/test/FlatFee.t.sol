// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FlatFee.sol";

contract FlatFeeImpl is FlatFee {
    uint256 public counter;

    function initialize(uint256 fee) external initializer {
        __FlatFee_initialize(fee);
    }

    function pay() external payable collectFee {
        counter += 1;
    }
}

// Helper contract that reverts on receive to simulate owner receiving failures
contract FailReceiver {
    receive() external payable {
        revert();
    }
}

// Helper contract that forwards payment to impl and reverts on refund
contract RefundFailer {
    FlatFeeImpl impl;
    constructor(address _impl) payable {
        impl = FlatFeeImpl(payable(_impl));
    }
    function doPay() external payable {
        impl.pay{value: msg.value}();
    }
    receive() external payable {
        revert();
    }
}

contract FlatFeeTest is Test {
    FlatFeeImpl impl;
    address alice = vm.addr(1);

    // Mirror event signature from IFlatFee to use in vm.expectEmit
    event FeesWithdrawn(address indexed to, uint256 amount);

    function setUp() public {
        impl = new FlatFeeImpl();
        impl.initialize(1 ether);
        vm.deal(alice, 10 ether);
    }

    // Allow the test contract to receive ETH when impl.withdrawFees() sends funds
    receive() external payable {}

    function testRevertsWhenInsufficientFee() public {
        vm.prank(alice);
        vm.expectRevert();
        impl.pay{value: 0}();
    }

    function testAcceptsExactFee() public {
        vm.prank(alice);
        impl.pay{value: 1 ether}();
        assertEq(impl.counter(), 1);
        assertEq(address(impl).balance, 1 ether);
    }

    function testAcceptsExcessAndKeepsFee() public {
        vm.prank(alice);
        impl.pay{value: 2 ether}();
        // contract should retain only the requested fee
        assertEq(address(impl).balance, 1 ether);
        assertEq(impl.counter(), 1);
    }

    function testWithdrawOnlyOwner() public {
        // alice pays fee
        vm.prank(alice);
        impl.pay{value: 1 ether}();
        // non-owner cannot withdraw
        vm.prank(alice);
        vm.expectRevert();
        impl.withdrawFees();
    }

    function testWithdrawEmitsEventAndTransfersToOwner() public {
        // alice pays fee
        vm.prank(alice);
        impl.pay{value: 1 ether}();

    // expect FeesWithdrawn event emitted by the impl contract: check only indexed recipient topic
    vm.expectEmit(true, false, false, false, address(impl));
    emit FeesWithdrawn(address(this), 0);

        uint256 balBefore = address(this).balance;
        // owner (test contract) withdraws
        impl.withdrawFees();
        assertEq(address(impl).balance, 0);
        assertEq(address(this).balance, balBefore + 1 ether);
    }

    

    function testNoDirectPaymentsAllowed() public {
        // Attempt to send ETH directly should fail because receive() reverts
        (bool ok, ) = address(impl).call{value: 1 ether}("");
        assertFalse(ok);
    }

    function testWithdrawWhenNoFeesReverts() public {
        // contract has zero balance
        vm.expectRevert();
        impl.withdrawFees();
    }

    function testWithdrawFailsWhenOwnerCannotReceive() public {
        // alice pays fee
        vm.prank(alice);
        impl.pay{value: 1 ether}();

        // deploy FailReceiver and transfer ownership to it
        FailReceiver r = new FailReceiver();
        impl.transferOwnership(address(r));

        // withdraw should revert because transfer to owner fails
        vm.expectRevert();
        impl.withdrawFees();
    }

    function testRefundFailsWhenRecipientCannotReceive() public {
        // deploy a RefundFailer
        RefundFailer rf = new RefundFailer(address(impl));
        // call doPay and expect revert because refund to rf will fail
        vm.expectRevert();
        rf.doPay{value: 2 ether}();
    }

    function testUpdateRequestedFeeOnlyOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        impl.updateRequestedFee(0);
    }
}
