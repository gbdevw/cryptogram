// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FlatFee} from "src/FlatFee.sol";
import {IFlatFee} from "src/IFlatFee.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract FlatFeeImpl is FlatFee, UUPSUpgradeable {
    uint256 public counter;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 fee, address manager) external initializer {
        __FlatFee_init(fee, manager);
        __UUPSUpgradeable_init();
    }

    function pay() external payable collectFee {
        counter += 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override restricted {
        require(newImplementation != address(0), "Invalid implementation");
    }

    function version() external pure virtual returns (string memory) {
        return "v1";
    }
}

contract FlatFeeImplV2 is FlatFeeImpl {
    function version() external pure override returns (string memory) {
        return "v2";
    }

    function newFunction() external pure returns (uint256) {
        return 42;
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
    AccessManager accessManager;
    FlatFeeImpl implementation;
    ERC1967Proxy proxy;
    FlatFeeImpl impl;
    
    address admin = vm.addr(1);
    address treasurer = vm.addr(2);
    address alice = vm.addr(3);
    address upgrader = vm.addr(4);
    
    // Role identifiers
    uint64 public constant TREASURER_ROLE = 1;
    uint64 public constant UPGRADER_ROLE = 2;

    // Mirror event signature from IFlatFee to use in vm.expectEmit
    event FeesWithdrawn(address indexed to, uint256 amount);
    event RequestedFeeUpdated(uint256 oldFee, uint256 newFee);

    function setUp() public {
        // Deploy AccessManager with admin as initial admin
        vm.prank(admin);
        accessManager = new AccessManager(admin);
        
        // Deploy implementation
        implementation = new FlatFeeImpl();
        
        // Deploy proxy
        bytes memory initData = abi.encodeCall(FlatFeeImpl.initialize, (1 ether, address(accessManager)));
        proxy = new ERC1967Proxy(address(implementation), initData);
        impl = FlatFeeImpl(payable(address(proxy)));
        
        // Setup roles as admin
        vm.startPrank(admin);
        
        // Grant TREASURER_ROLE to treasurer
        accessManager.grantRole(TREASURER_ROLE, treasurer, 0); // 0 = no expiration
        
        // Grant UPGRADER_ROLE to upgrader
        accessManager.grantRole(UPGRADER_ROLE, upgrader, 0);
        
        // Configure function permissions
        // TREASURER can call updateRequestedFee and withdrawFees
        bytes4[] memory treasurerSelectors = new bytes4[](2);
        treasurerSelectors[0] = IFlatFee.updateRequestedFee.selector;
        treasurerSelectors[1] = IFlatFee.withdrawFees.selector;
        
        for (uint256 i = 0; i < treasurerSelectors.length; ++i) {
            accessManager.setTargetFunctionRole(
                address(impl),
                treasurerSelectors,
                TREASURER_ROLE
            );
        }
        
        // UPGRADER can call upgradeToAndCall
        bytes4[] memory upgraderSelectors = new bytes4[](1);
        upgraderSelectors[0] = UUPSUpgradeable.upgradeToAndCall.selector;
        accessManager.setTargetFunctionRole(
            address(impl),
            upgraderSelectors,
            UPGRADER_ROLE
        );
        
        vm.stopPrank();
        
        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(treasurer, 10 ether);
    }

    // Allow the test contract to receive ETH when impl.withdrawFees() sends funds
    receive() external payable {}

    /*****************************************************************************************************************/
    /* BASIC FEE COLLECTION TESTS                                                                                    */
    /*****************************************************************************************************************/

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

    function testAcceptsExcessAndRefundsCorrectly() public {
        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        impl.pay{value: 2 ether}();
        
        // Contract should retain only the requested fee
        assertEq(address(impl).balance, 1 ether);
        assertEq(impl.counter(), 1);
        
        // Alice should have been refunded the excess (2 ether - 1 ether = 1 ether)
        // Account for gas costs by checking she has at least the refund
        assertGe(alice.balance, aliceBalanceBefore - 1 ether - 0.01 ether); // Allow for gas
    }

    function testNoDirectPaymentsAllowed() public {
        // Attempt to send ETH directly should fail because receive() reverts
        (bool ok,) = address(impl).call{value: 1 ether}("");
        assertFalse(ok);
    }

    function testRefundFailsWhenRecipientCannotReceive() public {
        // deploy a RefundFailer
        RefundFailer rf = new RefundFailer(address(impl));
        vm.deal(address(rf), 10 ether);
        
        // call doPay and expect revert because refund to rf will fail
        vm.expectRevert();
        rf.doPay{value: 2 ether}();
    }

    /*****************************************************************************************************************/
    /* RBAC - TREASURER ROLE TESTS                                                                                   */
    /*****************************************************************************************************************/

    function testTreasurerCanWithdrawFees() public {
        // alice pays fee
        vm.prank(alice);
        impl.pay{value: 1 ether}();

        // expect FeesWithdrawn event
        vm.expectEmit(true, false, false, true, address(impl));
        emit FeesWithdrawn(treasurer, 1 ether);

        uint256 treasurerBalanceBefore = treasurer.balance;
        
        // treasurer withdraws fees
        vm.prank(treasurer);
        impl.withdrawFees(treasurer);
        
        assertEq(address(impl).balance, 0);
        assertEq(treasurer.balance, treasurerBalanceBefore + 1 ether);
    }

    function testNonTreasurerCannotWithdrawFees() public {
        // alice pays fee
        vm.prank(alice);
        impl.pay{value: 1 ether}();
        
        // alice (non-treasurer) cannot withdraw
        vm.prank(alice);
        vm.expectRevert();
        impl.withdrawFees(alice);
        
        // Balance should remain unchanged
        assertEq(address(impl).balance, 1 ether);
    }

    function testWithdrawWhenNoFeesReverts() public {
        // contract has zero balance
        vm.prank(treasurer);
        vm.expectRevert();
        impl.withdrawFees(treasurer);
    }

    function testWithdrawFailsWhenRecipientCannotReceive() public {
        // alice pays fee
        vm.prank(alice);
        impl.pay{value: 1 ether}();

        // deploy FailReceiver
        FailReceiver r = new FailReceiver();

        // treasurer tries to withdraw to FailReceiver, should revert
        vm.prank(treasurer);
        vm.expectRevert();
        impl.withdrawFees(address(r));
    }

    function testTreasurerCanUpdateFee() public {
        // Check initial fee
        assertEq(impl.requestedFee(), 1 ether);
        
        // Expect RequestedFeeUpdated event
        vm.expectEmit(true, true, false, true, address(impl));
        emit RequestedFeeUpdated(1 ether, 2 ether);
        
        // Treasurer updates fee
        vm.prank(treasurer);
        impl.updateRequestedFee(2 ether);
        
        assertEq(impl.requestedFee(), 2 ether);
    }

    function testNonTreasurerCannotUpdateFee() public {
        vm.prank(alice);
        vm.expectRevert();
        impl.updateRequestedFee(2 ether);
        
        // Fee should remain unchanged
        assertEq(impl.requestedFee(), 1 ether);
    }

    /*****************************************************************************************************************/
    /* RBAC - UPGRADE TESTS                                                                                          */
    /*****************************************************************************************************************/

    function testUpgraderCanUpgradeContract() public {
        // Deploy new implementation
        FlatFeeImplV2 newImplementation = new FlatFeeImplV2();
        
        // Check current version
        assertEq(impl.version(), "v1");
        
        // Upgrader upgrades the contract
        vm.prank(upgrader);
        impl.upgradeToAndCall(address(newImplementation), "");
        
        // Cast to V2 and check new version
        FlatFeeImplV2 implV2 = FlatFeeImplV2(payable(address(impl)));
        assertEq(implV2.version(), "v2");
        assertEq(implV2.newFunction(), 42);
        
        // State should be preserved
        assertEq(implV2.requestedFee(), 1 ether);
    }

    function testNonUpgraderCannotUpgrade() public {
        FlatFeeImplV2 newImplementation = new FlatFeeImplV2();
        
        // Alice (non-upgrader) cannot upgrade
        vm.prank(alice);
        vm.expectRevert();
        impl.upgradeToAndCall(address(newImplementation), "");
        
        // Version should remain unchanged
        assertEq(impl.version(), "v1");
    }

    function testUpgradeToZeroAddressReverts() public {
        vm.prank(upgrader);
        vm.expectRevert("Invalid implementation");
        impl.upgradeToAndCall(address(0), "");
    }

    function testUpgradePreservesState() public {
        // Alice pays some fees
        vm.prank(alice);
        impl.pay{value: 1 ether}();
        
        // Treasurer updates fee
        vm.prank(treasurer);
        impl.updateRequestedFee(2 ether);
        
        assertEq(impl.counter(), 1);
        assertEq(address(impl).balance, 1 ether);
        assertEq(impl.requestedFee(), 2 ether);
        
        // Deploy and upgrade to V2
        FlatFeeImplV2 newImplementation = new FlatFeeImplV2();
        vm.prank(upgrader);
        impl.upgradeToAndCall(address(newImplementation), "");
        
        // All state should be preserved
        FlatFeeImplV2 implV2 = FlatFeeImplV2(payable(address(impl)));
        assertEq(implV2.counter(), 1);
        assertEq(address(implV2).balance, 1 ether);
        assertEq(implV2.requestedFee(), 2 ether);
        
        // New functionality should work
        assertEq(implV2.newFunction(), 42);
        
        // Old functionality should still work
        vm.prank(alice);
        implV2.pay{value: 2 ether}();
        assertEq(implV2.counter(), 2);
    }

    /*****************************************************************************************************************/
    /* RBAC - ROLE MANAGEMENT TESTS                                                                                  */
    /*****************************************************************************************************************/

    function testAdminCanGrantRoles() public {
        address newTreasurer = vm.addr(5);
        
        vm.prank(admin);
        accessManager.grantRole(TREASURER_ROLE, newTreasurer, 0);
        
        // New treasurer should be able to withdraw fees
        vm.prank(alice);
        impl.pay{value: 1 ether}();
        
        vm.prank(newTreasurer);
        impl.withdrawFees(newTreasurer);
        
        assertEq(address(impl).balance, 0);
    }

    function testAdminCanRevokeRoles() public {
        vm.prank(admin);
        accessManager.revokeRole(TREASURER_ROLE, treasurer);
        
        // Treasurer should no longer be able to update fee
        vm.prank(treasurer);
        vm.expectRevert();
        impl.updateRequestedFee(2 ether);
    }

    function testNonAdminCannotGrantRoles() public {
        address newTreasurer = vm.addr(5);
        
        vm.prank(alice);
        vm.expectRevert();
        accessManager.grantRole(TREASURER_ROLE, newTreasurer, 0);
    }
}
