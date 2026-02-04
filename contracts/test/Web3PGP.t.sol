// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {IWeb3PGP} from "src/IWeb3PGP.sol";
import {IFlatFee} from "src/IFlatFee.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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
    address feeManager = vm.addr(2);
    address fundsManager = vm.addr(2); // Can be same address for testing
    address alice = vm.addr(3);
    address upgrader = vm.addr(4);
    
    // Role identifiers
    uint64 public constant FEE_MANAGER_ROLE = 1;
    uint64 public constant FUNDS_MANAGER_ROLE = 2;
    uint64 public constant UPGRADER_ROLE = 3;

    event KeyRegistered(bytes32 indexed primaryKeyFingerprint, bytes32[] subkeyFingerprints, bytes openPGPMsg);
    event SubkeyAdded(bytes32 indexed parentKeyFingerprint, bytes32 indexed subkeyFingerprint, bytes openPGPMsg);
    event KeyUpdated(bytes32 indexed fingerprint, bytes openPGPMsg);
    event KeyRevoked(bytes32 indexed fingerprint, bytes revocationCertificate);
    event OwnershipChallenged(bytes32 indexed fingerprint, bytes32 indexed challenge);
    event OwnershipProved(bytes32 indexed fingerprint, bytes32 indexed challenge, bytes signature);
    event KeyCertified(bytes32 indexed fingerprint, bytes32 indexed issuer, bytes keyCertificate);
    event KeyCertificationRevoked(bytes32 indexed fingerprint, bytes32 indexed issuer, bytes revocationSignature);

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
        
        // Grant FEE_MANAGER_ROLE to feeManager
        accessManager.grantRole(FEE_MANAGER_ROLE, feeManager, 0);
        
        // Grant FUNDS_MANAGER_ROLE to fundsManager
        accessManager.grantRole(FUNDS_MANAGER_ROLE, fundsManager, 0);
        
        // Grant UPGRADER_ROLE to upgrader
        accessManager.grantRole(UPGRADER_ROLE, upgrader, 0);
        
        // Configure function permissions for FEE_MANAGER
        bytes4[] memory feeManagerSelectors = new bytes4[](1);
        feeManagerSelectors[0] = IFlatFee.updateRequestedFee.selector;
        accessManager.setTargetFunctionRole(
            address(pgp),
            feeManagerSelectors,
            FEE_MANAGER_ROLE
        );
        
        // Configure function permissions for FUNDS_MANAGER
        bytes4[] memory fundsManagerSelectors = new bytes4[](1);
        fundsManagerSelectors[0] = IFlatFee.withdrawFees.selector;
        accessManager.setTargetFunctionRole(
            address(pgp),
            fundsManagerSelectors,
            FUNDS_MANAGER_ROLE
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
        vm.deal(feeManager, 10 ether);
        vm.deal(fundsManager, 10 ether);
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

    function testFeeManagerCanUpdateFee() public {
        assertEq(pgp.requestedFee(), 0);
        
        vm.prank(feeManager);
        pgp.updateRequestedFee(1 ether);
        
        assertEq(pgp.requestedFee(), 1 ether);
    }

    function testNonFeeManagerCannotUpdateFee() public {
        vm.prank(alice);
        vm.expectRevert();
        pgp.updateRequestedFee(1 ether);
        
        assertEq(pgp.requestedFee(), 0);
    }

    function testFundsManagerCanWithdrawFees() public {
        // Set a fee and have alice pay it
        vm.prank(feeManager);
        pgp.updateRequestedFee(1 ether);
        
        bytes32 fp = keccak256("fee-test");
        vm.prank(alice);
        pgp.register{value: 1 ether}(fp, new bytes32[](0), "key");
        
        assertEq(address(pgp).balance, 1 ether);
        
        uint256 fundsManagerBalanceBefore = fundsManager.balance;
        
        vm.prank(fundsManager);
        pgp.withdrawFees(fundsManager);
        
        assertEq(address(pgp).balance, 0);
        assertEq(fundsManager.balance, fundsManagerBalanceBefore + 1 ether);
    }

    function testNonFundsManagerCannotWithdrawFees() public {
        // Set a fee and have alice pay it
        vm.prank(feeManager);
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

    /*****************************************************************************************************************/
    /* OWNERSHIP CHALLENGE TESTS                                                                                    */
    /*****************************************************************************************************************/

    function testChallengeOwnershipEmitsEvent() public {
        bytes32 fp = keccak256("challenge-test");
        bytes32 challenge = keccak256(abi.encodePacked("nonce123"));
        
        // Register key first
        pgp.register(fp, new bytes32[](0), "challenge-key");
        
        // Expect OwnershipChallenged event
        vm.expectEmit(true, true, false, false, address(pgp));
        emit OwnershipChallenged(fp, challenge);
        
        pgp.challengeOwnership(fp, challenge);
    }

    function testChallengeOwnershipNotRegisteredReverts() public {
        bytes32 fp = keccak256("challenge-not-reg");
        bytes32 challenge = keccak256(abi.encodePacked("nonce"));
        
        vm.expectRevert();
        pgp.challengeOwnership(fp, challenge);
    }

    function testMultipleChallengesForSameKey() public {
        bytes32 fp = keccak256("multi-challenge");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Issue multiple challenges
        bytes32 challenge1 = keccak256(abi.encodePacked("nonce1"));
        bytes32 challenge2 = keccak256(abi.encodePacked("nonce2"));
        bytes32 challenge3 = keccak256(abi.encodePacked("nonce3"));
        
        vm.expectEmit(true, true, false, false, address(pgp));
        emit OwnershipChallenged(fp, challenge1);
        pgp.challengeOwnership(fp, challenge1);
        
        vm.expectEmit(true, true, false, false, address(pgp));
        emit OwnershipChallenged(fp, challenge2);
        pgp.challengeOwnership(fp, challenge2);
        
        vm.expectEmit(true, true, false, false, address(pgp));
        emit OwnershipChallenged(fp, challenge3);
        pgp.challengeOwnership(fp, challenge3);
    }

    /*****************************************************************************************************************/
    /* OWNERSHIP PROOF TESTS                                                                                        */
    /*****************************************************************************************************************/

    function testProveOwnershipEmitsEvent() public {
        bytes32 fp = keccak256("prove-test");
        bytes32 challenge = keccak256(abi.encodePacked("nonce456"));
        bytes memory signature = "signature-data";
        
        // Register key first
        pgp.register(fp, new bytes32[](0), "prove-key");
        
        // Expect OwnershipProved event
        vm.expectEmit(true, true, false, true, address(pgp));
        emit OwnershipProved(fp, challenge, signature);
        
        pgp.proveOwnership(fp, challenge, signature);
    }

    function testProveOwnershipNotRegisteredReverts() public {
        bytes32 fp = keccak256("prove-not-reg");
        bytes32 challenge = keccak256(abi.encodePacked("nonce"));
        bytes memory signature = "sig";
        
        vm.expectRevert();
        pgp.proveOwnership(fp, challenge, signature);
    }

    function testProveOwnershipAfterChallenge() public {
        bytes32 fp = keccak256("prove-after-challenge");
        bytes32 challenge = keccak256(abi.encodePacked("nonce789"));
        bytes memory signature = "openpgp-signature";
        
        pgp.register(fp, new bytes32[](0), "key");
        
        // Issue challenge first
        pgp.challengeOwnership(fp, challenge);
        
        // Then prove ownership
        vm.expectEmit(true, true, false, true, address(pgp));
        emit OwnershipProved(fp, challenge, signature);
        pgp.proveOwnership(fp, challenge, signature);
    }

    function testMultipleProofsForSameChallenge() public {
        bytes32 fp = keccak256("multi-proof");
        bytes32 challenge = keccak256(abi.encodePacked("nonce-multi"));
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.challengeOwnership(fp, challenge);
        
        // Multiple different signatures for the same challenge
        bytes memory sig1 = "sig1";
        bytes memory sig2 = "sig2";
        
        vm.expectEmit(true, true, false, true, address(pgp));
        emit OwnershipProved(fp, challenge, sig1);
        pgp.proveOwnership(fp, challenge, sig1);
        
        vm.expectEmit(true, true, false, true, address(pgp));
        emit OwnershipProved(fp, challenge, sig2);
        pgp.proveOwnership(fp, challenge, sig2);
    }

    /*****************************************************************************************************************/
    /* KEY CERTIFICATION TESTS                                                                                      */
    /*****************************************************************************************************************/

    function testCertifyKeyEmitsEvent() public {
        bytes32 fp = keccak256("key-to-certify");
        bytes32 issuer = keccak256("issuer-key");
        bytes memory cert = "certification-data";
        
        // Register both keys
        pgp.register(fp, new bytes32[](0), "key-to-certify");
        pgp.register(issuer, new bytes32[](0), "issuer-key");
        
        // Expect KeyCertified event
        vm.expectEmit(true, true, false, true, address(pgp));
        emit KeyCertified(fp, issuer, cert);
        
        pgp.certifyKey(fp, issuer, cert);
    }

    function testCertifyKeyTargetNotRegisteredReverts() public {
        bytes32 fp = keccak256("unregistered-target");
        bytes32 issuer = keccak256("issuer-reg");
        bytes memory cert = "cert";
        
        // Register issuer but not target
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        vm.expectRevert();
        pgp.certifyKey(fp, issuer, cert);
    }

    function testCertifyKeyIssuerNotRegisteredReverts() public {
        bytes32 fp = keccak256("target-reg");
        bytes32 issuer = keccak256("unregistered-issuer");
        bytes memory cert = "cert";
        
        // Register target but not issuer
        pgp.register(fp, new bytes32[](0), "target");
        
        vm.expectRevert();
        pgp.certifyKey(fp, issuer, cert);
    }

    function testSelfCertificationReverts() public {
        bytes32 fp = keccak256("self-cert");
        bytes memory cert = "self-certification";
        
        pgp.register(fp, new bytes32[](0), "key");
        
        // Self-certification should revert: issuer must be different from target
        vm.expectRevert(IWeb3PGP.SelfCertificationNotAllowed.selector);
        pgp.certifyKey(fp, fp, cert);
    }

    function testMultipleCertificationsFromDifferentIssuers() public {
        bytes32 target = keccak256("multi-cert-target");
        bytes32 issuer1 = keccak256("issuer1");
        bytes32 issuer2 = keccak256("issuer2");
        
        pgp.register(target, new bytes32[](0), "target");
        pgp.register(issuer1, new bytes32[](0), "issuer1");
        pgp.register(issuer2, new bytes32[](0), "issuer2");
        
        // Certifications from two different issuers
        vm.expectEmit(true, true, false, true, address(pgp));
        emit KeyCertified(target, issuer1, "cert1");
        pgp.certifyKey(target, issuer1, "cert1");
        
        vm.expectEmit(true, true, false, true, address(pgp));
        emit KeyCertified(target, issuer2, "cert2");
        pgp.certifyKey(target, issuer2, "cert2");
    }

    /*****************************************************************************************************************/
    /* KEY CERTIFICATION REVOCATION TESTS                                                                           */
    /*****************************************************************************************************************/

    function testRevokeCertificationEmitsEvent() public {
        bytes32 fp = keccak256("key-revoke-cert");
        bytes32 issuer = keccak256("issuer-revoke");
        bytes memory revocation = "revocation-sig";
        
        // Register both keys and certify first
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        pgp.certifyKey(fp, issuer, "cert");
        
        // Expect KeyCertificationRevoked event
        vm.expectEmit(true, true, false, true, address(pgp));
        emit KeyCertificationRevoked(fp, issuer, revocation);
        
        pgp.revokeCertification(fp, issuer, revocation);
    }

    function testRevokeCertificationTargetNotRegisteredReverts() public {
        bytes32 fp = keccak256("unregistered-rev-target");
        bytes32 issuer = keccak256("issuer-rev");
        bytes memory revocation = "rev";
        
        // Register issuer but not target
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        vm.expectRevert();
        pgp.revokeCertification(fp, issuer, revocation);
    }

    function testRevokeCertificationIssuerNotRegisteredReverts() public {
        bytes32 fp = keccak256("target-rev");
        bytes32 issuer = keccak256("unregistered-rev-issuer");
        bytes memory revocation = "rev";
        
        // Register target but not issuer
        pgp.register(fp, new bytes32[](0), "target");
        
        vm.expectRevert();
        pgp.revokeCertification(fp, issuer, revocation);
    }

    function testSelfCertificationRevocationReverts() public {
        bytes32 fp = keccak256("self-cert-revoke");
        bytes memory revocation = "self-revocation";
        
        pgp.register(fp, new bytes32[](0), "key");
        
        // Self-certification revocation should revert: issuer must be different from target
        vm.expectRevert(IWeb3PGP.SelfCertificationNotAllowed.selector);
        pgp.revokeCertification(fp, fp, revocation);
    }

    function testMultipleCertificationRevocations() public {
        bytes32 fp = keccak256("multi-cert-rev");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Certify and revoke multiple times at different blocks
        bytes32 issuer = keccak256("issuer-multi");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        vm.roll(100);
        pgp.certifyKey(fp, issuer, "cert1");
        vm.roll(101);
        pgp.revokeCertification(fp, issuer, "rev1");
        
        vm.roll(200);
        pgp.certifyKey(fp, issuer, "cert2");
        vm.roll(201);
        pgp.revokeCertification(fp, issuer, "rev2");
    }

    /*****************************************************************************************************************/
    /* LIST CERTIFICATIONS TESTS                                                                                    */
    /*****************************************************************************************************************/

    function testListCertificationsEmpty() public {
        bytes32 fp = keccak256("empty-cert-list");
        pgp.register(fp, new bytes32[](0), "key");
        
        // No certifications yet
        uint256[] memory certs = pgp.listCertifications(fp, 0, 10);
        assertEq(certs.length, 0);
    }

    function testListCertificationsBasic() public {
        bytes32 fp = keccak256("cert-list-basic");
        bytes32 issuer = keccak256("issuer-list");
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        // Create certifications at specific blocks
        vm.roll(50);
        pgp.certifyKey(fp, issuer, "cert1");
        vm.roll(100);
        pgp.certifyKey(fp, issuer, "cert2");
        vm.roll(150);
        pgp.certifyKey(fp, issuer, "cert3");
        
        // List all certifications
        uint256[] memory certs = pgp.listCertifications(fp, 0, 10);
        assertEq(certs.length, 3);
        assertEq(certs[0], 50);
        assertEq(certs[1], 100);
        assertEq(certs[2], 150);
    }

    function testListCertificationsPagination() public {
        bytes32 fp = keccak256("cert-pagination");
        bytes32 issuer = keccak256("issuer-pag");
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        // Create 5 certifications
        for (uint256 i = 0; i < 5; i++) {
            vm.roll(10 + i);
            pgp.certifyKey(fp, issuer, abi.encodePacked("cert", i));
        }
        
        // Test pagination with limit 2
        uint256[] memory page1 = pgp.listCertifications(fp, 0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], 10);
        assertEq(page1[1], 11);
        
        // Second page
        uint256[] memory page2 = pgp.listCertifications(fp, 2, 2);
        assertEq(page2.length, 2);
        assertEq(page2[0], 12);
        assertEq(page2[1], 13);
        
        // Last item
        uint256[] memory page3 = pgp.listCertifications(fp, 4, 2);
        assertEq(page3.length, 1);
        assertEq(page3[0], 14);
    }

    function testListCertificationsStartOutOfBounds() public {
        bytes32 fp = keccak256("cert-out-bounds");
        bytes32 issuer = keccak256("issuer-bounds");
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        pgp.certifyKey(fp, issuer, "cert");
        
        // Start index beyond the list
        uint256[] memory certs = pgp.listCertifications(fp, 10, 10);
        assertEq(certs.length, 0);
    }

    function testListCertificationsWithZeroLimit() public {
        bytes32 fp = keccak256("cert-zero-limit");
        bytes32 issuer = keccak256("issuer-zero");
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        pgp.certifyKey(fp, issuer, "cert");
        
        // Zero limit returns empty
        uint256[] memory certs = pgp.listCertifications(fp, 0, 0);
        assertEq(certs.length, 0);
    }

    /*****************************************************************************************************************/
    /* LIST CERTIFICATION REVOCATIONS TESTS                                                                         */
    /*****************************************************************************************************************/

    function testListCertificationRevocationsEmpty() public {
        bytes32 fp = keccak256("empty-rev-cert-list");
        pgp.register(fp, new bytes32[](0), "key");
        
        // No revocations yet
        uint256[] memory revs = pgp.listCertificationRevocations(fp, 0, 10);
        assertEq(revs.length, 0);
    }

    function testListCertificationRevocationsBasic() public {
        bytes32 fp = keccak256("rev-cert-list-basic");
        bytes32 issuer = keccak256("issuer-rev-list");
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        // Create certification revocations at specific blocks
        vm.roll(60);
        pgp.certifyKey(fp, issuer, "cert1");
        pgp.revokeCertification(fp, issuer, "rev1");
        
        vm.roll(120);
        pgp.certifyKey(fp, issuer, "cert2");
        pgp.revokeCertification(fp, issuer, "rev2");
        
        vm.roll(180);
        pgp.certifyKey(fp, issuer, "cert3");
        pgp.revokeCertification(fp, issuer, "rev3");
        
        // List all revocations
        uint256[] memory revs = pgp.listCertificationRevocations(fp, 0, 10);
        assertEq(revs.length, 3);
        assertEq(revs[0], 60);
        assertEq(revs[1], 120);
        assertEq(revs[2], 180);
    }

    function testListCertificationRevocationsPagination() public {
        bytes32 fp = keccak256("cert-rev-pagination");
        bytes32 issuer = keccak256("issuer-cert-rev-pag");
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        // Create 4 certification revocations
        for (uint256 i = 0; i < 4; i++) {
            pgp.certifyKey(fp, issuer, abi.encodePacked("cert", i));
            vm.roll(100 + i);
            pgp.revokeCertification(fp, issuer, abi.encodePacked("rev", i));
        }
        
        // Test pagination with limit 2
        uint256[] memory page1 = pgp.listCertificationRevocations(fp, 0, 2);
        assertEq(page1.length, 2);
        
        // Second page
        uint256[] memory page2 = pgp.listCertificationRevocations(fp, 2, 2);
        assertEq(page2.length, 2);
    }

    function testListCertificationRevocationsStartOutOfBounds() public {
        bytes32 fp = keccak256("cert-rev-out-bounds");
        bytes32 issuer = keccak256("issuer-cert-rev-bounds");
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        pgp.certifyKey(fp, issuer, "cert");
        pgp.revokeCertification(fp, issuer, "rev");
        
        // Start index beyond the list
        uint256[] memory revs = pgp.listCertificationRevocations(fp, 10, 10);
        assertEq(revs.length, 0);
    }

    function testListCertificationRevocationsWithZeroLimit() public {
        bytes32 fp = keccak256("cert-rev-zero-limit");
        bytes32 issuer = keccak256("issuer-cert-rev-zero");
        
        pgp.register(fp, new bytes32[](0), "key");
        pgp.register(issuer, new bytes32[](0), "issuer");
        pgp.certifyKey(fp, issuer, "cert");
        pgp.revokeCertification(fp, issuer, "rev");
        
        // Zero limit returns empty
        uint256[] memory revs = pgp.listCertificationRevocations(fp, 0, 0);
        assertEq(revs.length, 0);
    }

    /*****************************************************************************************************************/
    /* SUBKEY VALIDATION IN CERTIFICATION TESTS                                                                     */
    /*****************************************************************************************************************/

    function testCertifyKeyTargetIsSubkeyReverts() public {
        bytes32 parent = keccak256("parent-cert-subkey");
        bytes32 subkey = keccak256("subkey-cert-target");
        bytes32 issuer = keccak256("issuer-cert-subkey");
        bytes memory cert = "certification";
        
        // Register parent, subkey, and issuer
        pgp.register(parent, new bytes32[](0), "parent");
        pgp.addSubkey(parent, subkey, "subkey");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        // Attempting to certify a subkey should revert
        vm.expectRevert(abi.encodeWithSelector(IWeb3PGP.TargetIsASubkey.selector, subkey));
        pgp.certifyKey(subkey, issuer, cert);
    }

    function testCertifyKeyIssuerIsSubkeyReverts() public {
        bytes32 parent = keccak256("parent-cert-issuer-sub");
        bytes32 subkey = keccak256("subkey-cert-issuer");
        bytes32 target = keccak256("target-cert-issuer-sub");
        bytes memory cert = "certification";
        
        // Register parent, subkey (as issuer), and target
        pgp.register(parent, new bytes32[](0), "parent");
        pgp.addSubkey(parent, subkey, "subkey");
        pgp.register(target, new bytes32[](0), "target");
        
        // Attempting to certify with a subkey as issuer should revert
        vm.expectRevert(abi.encodeWithSelector(IWeb3PGP.TargetIsASubkey.selector, subkey));
        pgp.certifyKey(target, subkey, cert);
    }

    function testCertifyKeyBothAreSubkeysReverts() public {
        bytes32 parent1 = keccak256("parent1-both-sub");
        bytes32 parent2 = keccak256("parent2-both-sub");
        bytes32 subkey1 = keccak256("subkey1-both-sub");
        bytes32 subkey2 = keccak256("subkey2-both-sub");
        bytes memory cert = "certification";
        
        // Register two parent keys with their subkeys
        pgp.register(parent1, new bytes32[](0), "parent1");
        pgp.addSubkey(parent1, subkey1, "subkey1");
        pgp.register(parent2, new bytes32[](0), "parent2");
        pgp.addSubkey(parent2, subkey2, "subkey2");
        
        // Attempting to certify one subkey with another as issuer should revert
        // The check for target being a subkey happens first
        vm.expectRevert(abi.encodeWithSelector(IWeb3PGP.TargetIsASubkey.selector, subkey1));
        pgp.certifyKey(subkey1, subkey2, cert);
    }

    function testRevokeCertificationTargetIsSubkeyReverts() public {
        bytes32 parent = keccak256("parent-revoke-sub");
        bytes32 subkey = keccak256("subkey-revoke-target");
        bytes32 issuer = keccak256("issuer-revoke-sub");
        bytes memory revocation = "revocation";
        
        // Register parent, subkey, and issuer
        pgp.register(parent, new bytes32[](0), "parent");
        pgp.addSubkey(parent, subkey, "subkey");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        // Attempting to revoke certification of a subkey should revert
        vm.expectRevert(abi.encodeWithSelector(IWeb3PGP.TargetIsASubkey.selector, subkey));
        pgp.revokeCertification(subkey, issuer, revocation);
    }

    function testRevokeCertificationIssuerIsSubkeyReverts() public {
        bytes32 parent = keccak256("parent-revoke-issuer-sub");
        bytes32 subkey = keccak256("subkey-revoke-issuer");
        bytes32 target = keccak256("target-revoke-issuer-sub");
        bytes memory revocation = "revocation";
        
        // Register parent, subkey (as issuer), and target
        pgp.register(parent, new bytes32[](0), "parent");
        pgp.addSubkey(parent, subkey, "subkey");
        pgp.register(target, new bytes32[](0), "target");
        
        // Attempting to revoke certification with a subkey as issuer should revert
        vm.expectRevert(abi.encodeWithSelector(IWeb3PGP.TargetIsASubkey.selector, subkey));
        pgp.revokeCertification(target, subkey, revocation);
    }

    function testRevokeCertificationBothAreSubkeysReverts() public {
        bytes32 parent1 = keccak256("parent1-revoke-both-sub");
        bytes32 parent2 = keccak256("parent2-revoke-both-sub");
        bytes32 subkey1 = keccak256("subkey1-revoke-both-sub");
        bytes32 subkey2 = keccak256("subkey2-revoke-both-sub");
        bytes memory revocation = "revocation";
        
        // Register two parent keys with their subkeys
        pgp.register(parent1, new bytes32[](0), "parent1");
        pgp.addSubkey(parent1, subkey1, "subkey1");
        pgp.register(parent2, new bytes32[](0), "parent2");
        pgp.addSubkey(parent2, subkey2, "subkey2");
        
        // Attempting to revoke certification of one subkey with another as issuer should revert
        // The check for target being a subkey happens first
        vm.expectRevert(abi.encodeWithSelector(IWeb3PGP.TargetIsASubkey.selector, subkey1));
        pgp.revokeCertification(subkey1, subkey2, revocation);
    }

    function testCertifyKeyPrimaryKeysSucceeds() public {
        bytes32 target = keccak256("target-primary-cert");
        bytes32 issuer = keccak256("issuer-primary-cert");
        bytes memory cert = "certification";
        
        // Register both as primary keys (not subkeys)
        pgp.register(target, new bytes32[](0), "target");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        // Should succeed without reverting
        vm.expectEmit(true, true, false, true, address(pgp));
        emit KeyCertified(target, issuer, cert);
        pgp.certifyKey(target, issuer, cert);
    }

    function testRevokeCertificationPrimaryKeysSucceeds() public {
        bytes32 target = keccak256("target-primary-revoke");
        bytes32 issuer = keccak256("issuer-primary-revoke");
        bytes memory cert = "certification";
        bytes memory revocation = "revocation";
        
        // Register both as primary keys (not subkeys)
        pgp.register(target, new bytes32[](0), "target");
        pgp.register(issuer, new bytes32[](0), "issuer");
        
        // First certify
        pgp.certifyKey(target, issuer, cert);
        
        // Then revoke should succeed
        vm.expectEmit(true, true, false, true, address(pgp));
        emit KeyCertificationRevoked(target, issuer, revocation);
        pgp.revokeCertification(target, issuer, revocation);
    }

    /*****************************************************************************************************************/
    /* KEY UPDATE TESTS                                                                                              */
    /*****************************************************************************************************************/

    function testUpdateEmitsEvent() public {
        bytes32 fp = keccak256("key-to-update");
        bytes memory updatedKeyData = "updated-key-data";
        
        // Register key first
        pgp.register(fp, new bytes32[](0), "key");
        
        // Expect KeyUpdated event
        vm.expectEmit(true, false, false, true, address(pgp));
        emit KeyUpdated(fp, updatedKeyData);
        
        pgp.update(fp, updatedKeyData);
    }

    function testUpdateTargetNotRegisteredReverts() public {
        bytes32 fp = keccak256("unregistered-update");
        bytes memory updatedData = "updated";
        
        // Try to update a key that doesn't exist
        vm.expectRevert();
        pgp.update(fp, updatedData);
    }

    function testUpdateTargetIsSubkeyReverts() public {
        bytes32 parent = keccak256("parent-update");
        bytes32 subkey = keccak256("subkey-update");
        bytes memory updatedData = "updated-subkey";
        
        // Register parent and subkey
        pgp.register(parent, new bytes32[](0), "parent");
        pgp.addSubkey(parent, subkey, "subkey");
        
        // Cannot update a subkey
        vm.expectRevert(abi.encodeWithSelector(IWeb3PGP.TargetIsASubkey.selector, subkey));
        pgp.update(subkey, updatedData);
    }

    function testMultipleUpdates() public {
        bytes32 fp = keccak256("multi-update");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Perform multiple updates at different blocks
        vm.roll(10);
        pgp.update(fp, "update1");
        
        vm.roll(20);
        pgp.update(fp, "update2");
        
        vm.roll(30);
        pgp.update(fp, "update3");
        
        // Verify we can retrieve all updates
        uint256[] memory updates = pgp.listKeyUpdates(fp, 0, 10);
        assertEq(updates.length, 3);
        assertEq(updates[0], 10);
        assertEq(updates[1], 20);
        assertEq(updates[2], 30);
    }

    /*****************************************************************************************************************/
    /* LIST KEY UPDATES TESTS                                                                                        */
    /*****************************************************************************************************************/

    function testListKeyUpdatesEmpty() public {
        bytes32 fp = keccak256("empty-updates");
        pgp.register(fp, new bytes32[](0), "key");
        
        // No updates yet
        uint256[] memory updates = pgp.listKeyUpdates(fp, 0, 10);
        assertEq(updates.length, 0);
    }

    function testListKeyUpdatesBasic() public {
        bytes32 fp = keccak256("basic-updates");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Create updates at specific blocks
        vm.roll(50);
        pgp.update(fp, "update-a");
        
        vm.roll(100);
        pgp.update(fp, "update-b");
        
        vm.roll(150);
        pgp.update(fp, "update-c");
        
        // List all updates
        uint256[] memory updates = pgp.listKeyUpdates(fp, 0, 10);
        assertEq(updates.length, 3);
        assertEq(updates[0], 50);
        assertEq(updates[1], 100);
        assertEq(updates[2], 150);
    }

    function testListKeyUpdatesPagination() public {
        bytes32 fp = keccak256("paginated-updates");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Create 5 updates at specific blocks
        vm.roll(10);
        pgp.update(fp, "update-0");
        
        vm.roll(20);
        pgp.update(fp, "update-1");
        
        vm.roll(30);
        pgp.update(fp, "update-2");
        
        vm.roll(40);
        pgp.update(fp, "update-3");
        
        vm.roll(50);
        pgp.update(fp, "update-4");
        
        // Test pagination with limit 2
        uint256[] memory page1 = pgp.listKeyUpdates(fp, 0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], 10);
        assertEq(page1[1], 20);
        
        // Second page
        uint256[] memory page2 = pgp.listKeyUpdates(fp, 2, 2);
        assertEq(page2.length, 2);
        assertEq(page2[0], 30);
        assertEq(page2[1], 40);
        
        // Last item
        uint256[] memory page3 = pgp.listKeyUpdates(fp, 4, 2);
        assertEq(page3.length, 1);
        assertEq(page3[0], 50);
    }

    function testListKeyUpdatesStartOutOfBounds() public {
        bytes32 fp = keccak256("update-out-bounds");
        pgp.register(fp, new bytes32[](0), "key");
        pgp.update(fp, "update");
        
        // Start index beyond the list
        uint256[] memory updates = pgp.listKeyUpdates(fp, 10, 10);
        assertEq(updates.length, 0);
    }

    function testListKeyUpdatesWithZeroLimit() public {
        bytes32 fp = keccak256("update-zero-limit");
        pgp.register(fp, new bytes32[](0), "key");
        pgp.update(fp, "update");
        
        // Zero limit returns empty
        uint256[] memory updates = pgp.listKeyUpdates(fp, 0, 0);
        assertEq(updates.length, 0);
    }

    function testListKeyUpdatesWithLargeLimitReturnsAll() public {
        bytes32 fp = keccak256("update-large-limit");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Create three updates
        vm.roll(25);
        pgp.update(fp, "update-1");
        
        vm.roll(50);
        pgp.update(fp, "update-2");
        
        vm.roll(75);
        pgp.update(fp, "update-3");
        
        // Request with a large limit that exceeds remaining items
        uint256[] memory updates = pgp.listKeyUpdates(fp, 0, 100);
        assertEq(updates.length, 3);
        assertEq(updates[0], 25);
        assertEq(updates[1], 50);
        assertEq(updates[2], 75);
    }

    function testListKeyUpdatesPartialPage() public {
        bytes32 fp = keccak256("update-partial");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Create 5 updates at specific blocks
        vm.roll(100);
        pgp.update(fp, "update-0");
        
        vm.roll(101);
        pgp.update(fp, "update-1");
        
        vm.roll(102);
        pgp.update(fp, "update-2");
        
        vm.roll(103);
        pgp.update(fp, "update-3");
        
        vm.roll(104);
        pgp.update(fp, "update-4");
        
        // Request start 3 limit 5 -> should return only last 2 (indices 3 and 4)
        uint256[] memory updates = pgp.listKeyUpdates(fp, 3, 5);
        assertEq(updates.length, 2);
        assertEq(updates[0], 103);
        assertEq(updates[1], 104);
    }

    function testListKeyUpdatesExactBoundary() public {
        bytes32 fp = keccak256("update-boundary");
        pgp.register(fp, new bytes32[](0), "key");
        
        vm.roll(40);
        pgp.update(fp, "update-1");
        
        vm.roll(41);
        pgp.update(fp, "update-2");
        
        // Request start 1 limit 1 -> should return only second update
        uint256[] memory updates = pgp.listKeyUpdates(fp, 1, 1);
        assertEq(updates.length, 1);
        assertEq(updates[0], 41);
    }

    function testUpdateBlockNumbersCorrect() public {
        bytes32 fp = keccak256("update-block-nums");
        pgp.register(fp, new bytes32[](0), "key");
        
        // Update at specific blocks
        vm.roll(123);
        pgp.update(fp, "data1");
        
        vm.roll(456);
        pgp.update(fp, "data2");
        
        vm.roll(789);
        pgp.update(fp, "data3");
        
        // Verify correct block numbers are stored
        uint256[] memory updates = pgp.listKeyUpdates(fp, 0, 10);
        assertEq(updates.length, 3);
        assertEq(updates[0], 123);
        assertEq(updates[1], 456);
        assertEq(updates[2], 789);
    }
}