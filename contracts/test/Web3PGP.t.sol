// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Web3PGP.sol";
import "@openzeppelin/contracts/access/manager/AccessManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ReentrancyAttacker {
    Web3PGP public pgp;
    bytes32 public fp;
    bool public innerSucceeded;

    constructor(address _pgp, bytes32 _fp) payable {
        pgp = Web3PGP(payable(_pgp));
        fp = _fp;
        innerSucceeded = false;
    }

    // fallback called when refund happens; try to reenter
    fallback() external payable {
        // try to reenter; if it succeeds we'll set innerSucceeded true
        bytes32[] memory empty = new bytes32[](0);
        try pgp.register{value: 0}(fp, empty, "att") {
            innerSucceeded = true;
        } catch {
            innerSucceeded = false;
        }
    }

    receive() external payable {}

    function attack() external payable {
        // call register with some value > 0 so collectFee will attempt to refund and call fallback
        bytes32[] memory empty = new bytes32[](0);
        pgp.register{value: msg.value}(fp, empty, "orig");
    }
}

contract Web3PGPTest is Test {
    AccessManager accessManager;
    Web3PGP implementation;
    ERC1967Proxy proxy;
    Web3PGP pgp;
    
    address admin = vm.addr(1);
    address treasurer = vm.addr(2);
    address alice = vm.addr(3);
    address upgrader = vm.addr(4);
    
    // Role identifiers
    uint64 public constant TREASURER_ROLE = 1;
    uint64 public constant UPGRADER_ROLE = 2;

    event KeyRegistered(bytes32 indexed primaryKeyFingerprint, bytes32[] subkeyFingerprints, bytes openPGPMsg);
    event SubkeyAdded(bytes32 indexed parentKeyFingerprint, bytes32 indexed subkeyFingerprint, bytes openPGPMsg);
    event KeyRevoked(bytes32 indexed fingerprint, bytes revocationCertificate);

    function setUp() public {
        // Deploy AccessManager with admin as initial admin
        vm.prank(admin);
        accessManager = new AccessManager(admin);
        
        // Deploy implementation
        implementation = new Web3PGP();
        
        // Deploy proxy
        bytes memory initData = abi.encodeCall(Web3PGP.initialize, (0, address(accessManager)));
        proxy = new ERC1967Proxy(address(implementation), initData);
        pgp = Web3PGP(payable(address(proxy)));
        
        // Setup roles as admin
        vm.startPrank(admin);
        
        // Grant TREASURER_ROLE to treasurer
        accessManager.grantRole(TREASURER_ROLE, treasurer, 0);
        
        // Grant UPGRADER_ROLE to upgrader
        accessManager.grantRole(UPGRADER_ROLE, upgrader, 0);
        
        // Configure function permissions for TREASURER
        bytes4[] memory treasurerSelectors = new bytes4[](2);
        treasurerSelectors[0] = IFlatFee.updateRequestedFee.selector;
        treasurerSelectors[1] = IFlatFee.withdrawFees.selector;
        
        accessManager.setTargetFunctionRole(
            address(pgp),
            treasurerSelectors,
            TREASURER_ROLE
        );
        
        // Configure function permissions for UPGRADER
        bytes4[] memory upgraderSelectors = new bytes4[](1);
        upgraderSelectors[0] = bytes4(keccak256("upgradeToAndCall(address,bytes)"));
        
        accessManager.setTargetFunctionRole(
            address(pgp),
            upgraderSelectors,
            UPGRADER_ROLE
        );
        
        vm.stopPrank();
        
        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(treasurer, 10 ether);
    }

    function testRegisterAndEmitEventsAndExistence() public {
        bytes32 fp = keccak256(abi.encodePacked("k1"));
        bytes memory msgData = "pubkey-1";
        bytes32[] memory empty = new bytes32[](0);

        vm.expectEmit(true, false, false, true, address(pgp));
        emit KeyRegistered(fp, empty, msgData);
        pgp.register(fp, empty, msgData);
        assertTrue(pgp.exists(fp));

        // register subkey
        bytes32 sub = keccak256(abi.encodePacked("sub1"));
        vm.expectEmit(true, true, false, true, address(pgp));
        emit SubkeyAdded(fp, sub, "subkey-1");
        pgp.addSubkey(fp, sub, "subkey-1");

        // revoke
        vm.expectEmit(true, false, false, true, address(pgp));
        emit KeyRevoked(fp, "rev");
        pgp.revoke(fp, "rev");
    }

    function testSubkeyParentNotRegisteredReverts() public {
        bytes32 parent = keccak256(abi.encodePacked("missing"));
        bytes32 sub = keccak256(abi.encodePacked("sub2"));
        vm.expectRevert();
        pgp.addSubkey(parent, sub, "x");
    }

    function testParentIsASubkeyReverts() public {
        // Register a parent key and a subkey under it
        bytes32 parent = keccak256(abi.encodePacked("parent1"));
        bytes32 sub = keccak256(abi.encodePacked("sub1"));
        bytes32 sub2 = keccak256(abi.encodePacked("sub2"));
        pgp.register(parent, new bytes32[](0), "p");
        pgp.addSubkey(parent, sub, "s1");

        // Now parent becomes the parent of sub; attempting to register subkey with parent=sub should revert
        vm.expectRevert();
        pgp.addSubkey(sub, sub2, "s2");
    }

    function testListRevocationsPaginationEdgeCases() public {
        bytes32 fp = keccak256(abi.encodePacked("r1"));
        pgp.register(fp, new bytes32[](0), "k");
        // no revocations yet
        uint256[] memory empty = pgp.listRevocations(fp, 0, 10);
        assertEq(empty.length, 0);

        // create revocations in blocks
        vm.roll(10);
        pgp.revoke(fp, "rev1");
        vm.roll(11);
        pgp.revoke(fp, "rev2");
        vm.roll(12);
        pgp.revoke(fp, "rev3");

        // start >= length -> empty
        uint256[] memory e2 = pgp.listRevocations(fp, 5, 10);
        assertEq(e2.length, 0);

        // limit == 0 -> empty
        uint256[] memory e3 = pgp.listRevocations(fp, 0, 0);
        assertEq(e3.length, 0);

        // normal pagination: start 0 limit 2 -> first two
        uint256[] memory p = pgp.listRevocations(fp, 0, 2);
        assertEq(p.length, 2);
    }

    function testListSubkeysPaginationEdgeCases() public {
        bytes32 parent = keccak256(abi.encodePacked("par2"));
        pgp.register(parent, new bytes32[](0), "kp");
        // add three subkeys
        bytes32 s1 = keccak256(abi.encodePacked("s1"));
        bytes32 s2 = keccak256(abi.encodePacked("s2"));
        bytes32 s3 = keccak256(abi.encodePacked("s3"));
        pgp.addSubkey(parent, s1, "a");
        pgp.addSubkey(parent, s2, "b");
        pgp.addSubkey(parent, s3, "c");

        // start >= length -> empty
        bytes32[] memory r1 = pgp.listSubkeys(parent, 5, 10);
        assertEq(r1.length, 0);

        // limit == 0 -> empty
        bytes32[] memory r2 = pgp.listSubkeys(parent, 0, 0);
        assertEq(r2.length, 0);

        // pagination start 1 limit 2 -> should return 2 elements (s2, s3)
        bytes32[] memory p = pgp.listSubkeys(parent, 1, 2);
        assertEq(p.length, 2);
        assertEq(p[0], s2);
        assertEq(p[1], s3);
    }

    function testRegisterAlreadyRegisteredReverts() public {
        bytes32 fp = keccak256(abi.encodePacked("dup"));
        pgp.register(fp, new bytes32[](0), "k");
        vm.expectRevert();
        pgp.register(fp, new bytes32[](0), "k-again");
    }

    function testRevokeNotRegisteredReverts() public {
        bytes32 fp = keccak256(abi.encodePacked("noreg"));
        vm.expectRevert();
        pgp.revoke(fp, "rev");
    }

    function testIsSubKeyAndParentOfViews() public {
        bytes32 parent = keccak256(abi.encodePacked("pv1"));
        bytes32 sub = keccak256(abi.encodePacked("sv1"));
        pgp.register(parent, new bytes32[](0), "parent-pk");
        assertTrue(!pgp.isSubKey(parent));

        pgp.addSubkey(parent, sub, "sub-pk");
        assertTrue(pgp.isSubKey(sub));
        assertEq(pgp.parentOf(sub), parent);
        // parentOf for a non-subkey returns zero
        assertEq(pgp.parentOf(parent), bytes32(0));
    }

    function testGetKeyPublicationBatchMixed() public {
        bytes32 a = keccak256(abi.encodePacked("a"));
        bytes32 b = keccak256(abi.encodePacked("b"));
        bytes32 c = keccak256(abi.encodePacked("c"));
        pgp.register(a, new bytes32[](0), "A");
        // b remains unregistered
        pgp.register(c, new bytes32[](0), "C");

        bytes32[] memory ids = new bytes32[](3);
        ids[0] = a;
        ids[1] = b;
        ids[2] = c;
        uint256[] memory pubs = pgp.getKeyPublicationBlock(ids);
        assertEq(pubs.length, 3);
        assertTrue(pubs[0] != 0);
        assertEq(pubs[1], 0);
        assertTrue(pubs[2] != 0);
    }

    function testRegisterSubkeyAlreadyRegisteredReverts() public {
        bytes32 parent = keccak256(abi.encodePacked("px"));
        bytes32 sub = keccak256(abi.encodePacked("sx"));
        pgp.register(parent, new bytes32[](0), "P");
        pgp.addSubkey(parent, sub, "S");
        // attempting to register same subkey again should revert
        vm.expectRevert();
        pgp.addSubkey(parent, sub, "S2");
    }

    function testRevokeAndListExactBoundary() public {
        bytes32 fp = keccak256(abi.encodePacked("rb1"));
        pgp.register(fp, new bytes32[](0), "rbk");
        vm.roll(50);
        pgp.revoke(fp, "r1");
        vm.roll(51);
        pgp.revoke(fp, "r2");

        // request start 1 limit 1 -> should return only second revocation
        uint256[] memory out = pgp.listRevocations(fp, 1, 1);
        assertEq(out.length, 1);
    }

    function testListSubkeysWhenNoneReturnsEmpty() public {
        bytes32 parent = keccak256(abi.encodePacked("px-none"));
        pgp.register(parent, new bytes32[](0), "pk");
        bytes32[] memory r = pgp.listSubkeys(parent, 0, 10);
        assertEq(r.length, 0);
    }

    function testListRevocationsWithLargeLimitReturnsAll() public {
        bytes32 fp = keccak256(abi.encodePacked("r-large"));
        pgp.register(fp, new bytes32[](0), "k");

        // create two revocations
        vm.roll(20);
        pgp.revoke(fp, "rev-a");
        vm.roll(21);
        pgp.revoke(fp, "rev-b");

        // request with a large limit that exceeds remaining items -> should return both revocations
        uint256[] memory out = pgp.listRevocations(fp, 0, 10);
        assertEq(out.length, 2);
    }

    function testListSubkeysWithLargeLimitReturnsAll() public {
        bytes32 parent = keccak256(abi.encodePacked("par-large"));
        pgp.register(parent, new bytes32[](0), "kp");
        bytes32 s1 = keccak256(abi.encodePacked("sl1"));
        bytes32 s2 = keccak256(abi.encodePacked("sl2"));
        pgp.addSubkey(parent, s1, "a");
        pgp.addSubkey(parent, s2, "b");

        // request with a large limit -> should return both subkeys
        bytes32[] memory out = pgp.listSubkeys(parent, 0, 10);
        assertEq(out.length, 2);
    }

    // Reentrancy attacker will be declared at top-level

    function testNonReentrantProtectionAgainstRefundReentry() public {
        // set up small pgp instance for this specific test
        Web3PGP localImpl = new Web3PGP();
        
        // Create a local access manager for this test
        vm.prank(admin);
        AccessManager localManager = new AccessManager(admin);
        
        bytes memory data = abi.encodeCall(Web3PGP.initialize, (uint256(0), address(localManager)));
        ERC1967Proxy localProxy = new ERC1967Proxy(address(localImpl), data);
        Web3PGP local = Web3PGP(payable(address(localProxy)));

        // choose fingerprint and attacker
        bytes32 f = keccak256(abi.encodePacked("reent"));
        // deploy attacker
        ReentrancyAttacker attacker = (new ReentrancyAttacker){value: 0}(address(local), f);

        // call attacker.attack sending 1 wei so collectFee will refund (fee is 0) and trigger fallback
        attacker.attack{value: 1}();

        // registration should have succeeded for the outer call
        assertTrue(local.exists(f));
        // innerSucceeded should be false because nonReentrant prevented reentry
        assertTrue(!attacker.innerSucceeded());
    }

    /*****************************************************************************************************************/
    /* UUPS UPGRADE TESTS                                                                                            */
    /*****************************************************************************************************************/

    function testUpgraderCanUpgrade() public {
        // Deploy new implementation (using same contract for simplicity)
        Web3PGP newImplementation = new Web3PGP();
        
        // Register a key to track state
        bytes32 fp = keccak256("upgrade-test");
        pgp.register(fp, new bytes32[](0), "key");
        assertTrue(pgp.exists(fp));
        
        // Upgrader upgrades the contract
        vm.prank(upgrader);
        pgp.upgradeToAndCall(address(newImplementation), "");
        
        // State should be preserved
        assertTrue(pgp.exists(fp));
    }

    function testNonUpgraderCannotUpgrade() public {
        Web3PGP newImplementation = new Web3PGP();
        
        // Alice (non-upgrader) cannot upgrade
        vm.prank(alice);
        vm.expectRevert();
        pgp.upgradeToAndCall(address(newImplementation), "");
    }

    function testUpgradePreservesAllState() public {
        // Register keys with subkeys
        bytes32 parent = keccak256("parent-upgrade");
        bytes32 sub1 = keccak256("sub1-upgrade");
        pgp.register(parent, new bytes32[](0), "parent-key");
        pgp.addSubkey(parent, sub1, "sub1-key");
        
        // Revoke the parent
        vm.roll(100);
        pgp.revoke(parent, "revocation");
        
        // Deploy and upgrade
        Web3PGP newImplementation = new Web3PGP();
        vm.prank(upgrader);
        pgp.upgradeToAndCall(address(newImplementation), "");
        
        // Verify all state preserved
        assertTrue(pgp.exists(parent));
        assertTrue(pgp.isSubKey(sub1));
        assertEq(pgp.parentOf(sub1), parent);
        
        // Verify revocations preserved
        uint256[] memory revs = pgp.listRevocations(parent, 0, 10);
        assertEq(revs.length, 1);
        assertEq(revs[0], 100);
        
        // Verify subkeys preserved
        bytes32[] memory subs = pgp.listSubkeys(parent, 0, 10);
        assertEq(subs.length, 1);
        assertEq(subs[0], sub1);
        
        // Verify can still use functions after upgrade
        bytes32 newKey = keccak256("post-upgrade");
        pgp.register(newKey, new bytes32[](0), "new-key");
        assertTrue(pgp.exists(newKey));
    }

    /*****************************************************************************************************************/
    /* FLATFEE RBAC TESTS                                                                                            */
    /*****************************************************************************************************************/

    function testTreasurerCanUpdateFee() public {
        assertEq(pgp.requestedFee(), 0);
        
        vm.prank(treasurer);
        pgp.updateRequestedFee(1 ether);
        
        assertEq(pgp.requestedFee(), 1 ether);
    }

    function testNonTreasurerCannotUpdateFee() public {
        vm.prank(alice);
        vm.expectRevert();
        pgp.updateRequestedFee(1 ether);
        
        assertEq(pgp.requestedFee(), 0);
    }

    function testTreasurerCanWithdrawFees() public {
        // Set a fee and have alice pay it
        vm.prank(treasurer);
        pgp.updateRequestedFee(1 ether);
        
        bytes32 fp = keccak256("fee-test");
        vm.prank(alice);
        pgp.register{value: 1 ether}(fp, new bytes32[](0), "key");
        
        assertEq(address(pgp).balance, 1 ether);
        
        uint256 treasurerBalanceBefore = treasurer.balance;
        
        vm.prank(treasurer);
        pgp.withdrawFees(treasurer);
        
        assertEq(address(pgp).balance, 0);
        assertEq(treasurer.balance, treasurerBalanceBefore + 1 ether);
    }

    function testNonTreasurerCannotWithdrawFees() public {
        // Set a fee and have alice pay it
        vm.prank(treasurer);
        pgp.updateRequestedFee(1 ether);
        
        bytes32 fp = keccak256("fee-test2");
        vm.prank(alice);
        pgp.register{value: 1 ether}(fp, new bytes32[](0), "key");
        
        assertEq(address(pgp).balance, 1 ether);
        
        vm.prank(alice);
        vm.expectRevert();
        pgp.withdrawFees(alice);
        
        assertEq(address(pgp).balance, 1 ether);
    }

    /*****************************************************************************************************************/
    /* REGISTER WITH SUBKEYS TESTS                                                                                   */
    /*****************************************************************************************************************/

    function testRegisterWithInitialSubkeys() public {
        bytes32 parent = keccak256("parent-init");
        bytes32 sub1 = keccak256("sub1-init");
        bytes32 sub2 = keccak256("sub2-init");
        
        bytes32[] memory subkeys = new bytes32[](2);
        subkeys[0] = sub1;
        subkeys[1] = sub2;
        
        // Expect KeyRegistered event with subkeys
        vm.expectEmit(true, false, false, true, address(pgp));
        emit KeyRegistered(parent, subkeys, "parent-with-subs");
        
        pgp.register(parent, subkeys, "parent-with-subs");
        
        // Verify parent exists
        assertTrue(pgp.exists(parent));
        
        // Verify subkeys are registered
        assertTrue(pgp.isSubKey(sub1));
        assertTrue(pgp.isSubKey(sub2));
        assertEq(pgp.parentOf(sub1), parent);
        assertEq(pgp.parentOf(sub2), parent);
        
        // Verify listSubkeys returns them
        bytes32[] memory listed = pgp.listSubkeys(parent, 0, 10);
        assertEq(listed.length, 2);
        assertEq(listed[0], sub1);
        assertEq(listed[1], sub2);
    }

    function testAddSubkeyEmitsEvent() public {
        bytes32 parent = keccak256("parent-event");
        bytes32 sub = keccak256("sub-event");
        
        pgp.register(parent, new bytes32[](0), "parent");
        
        // Expect SubkeyAdded event
        vm.expectEmit(true, true, false, true, address(pgp));
        emit SubkeyAdded(parent, sub, "subkey-data");
        
        pgp.addSubkey(parent, sub, "subkey-data");
        
        assertTrue(pgp.isSubKey(sub));
        assertEq(pgp.parentOf(sub), parent);
    }

    function testMultipleRevocationsOfSameKey() public {
        bytes32 fp = keccak256("multi-rev");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Issue multiple revocations at different blocks
        vm.roll(100);
        pgp.revoke(fp, "rev1");
        vm.roll(200);
        pgp.revoke(fp, "rev2");
        vm.roll(300);
        pgp.revoke(fp, "rev3");
        
        // Verify all revocations are recorded
        uint256[] memory revs = pgp.listRevocations(fp, 0, 10);
        assertEq(revs.length, 3);
        assertEq(revs[0], 100);
        assertEq(revs[1], 200);
        assertEq(revs[2], 300);
    }
}