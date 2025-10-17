// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Web3PGP.sol";
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
        try pgp.registerPublicKey(fp, "att") {
            innerSucceeded = true;
        } catch {
            innerSucceeded = false;
        }
    }

    receive() external payable {}

    function attack() external payable {
        // call registerPublicKey with some value > 0 so collectFee will attempt to refund and call fallback
        pgp.registerPublicKey{value: msg.value}(fp, "orig");
    }
}

contract Web3PGPTest is Test {
    Web3PGP pgp;

    event NewPublicKey(bytes32 indexed fingerprint, bytes openPGPMsg);
    event NewPublicSubkey(bytes32 indexed parentKeyFingerprint, bytes32 indexed subkeyFingerprint, bytes openPGPMsg);
    event NewRevocationCertificate(bytes32 indexed fingerprint, bytes revocationCertificate);

    function setUp() public {
        Web3PGP impl = new Web3PGP();
        bytes memory data = abi.encodeWithSelector(Web3PGP.initialize.selector, uint256(0));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        pgp = Web3PGP(payable(address(proxy)));
    }

    function testRegisterAndEmitEventsAndExistence() public {
        bytes32 fp = keccak256(abi.encodePacked("k1"));
        bytes memory msgData = "pubkey-1";

        vm.expectEmit(true, false, false, true, address(pgp));
        emit NewPublicKey(fp, msgData);
        pgp.registerPublicKey(fp, msgData);
        assertTrue(pgp.exist(fp));

        // register subkey
        bytes32 sub = keccak256(abi.encodePacked("sub1"));
        vm.expectEmit(true, true, false, true, address(pgp));
        emit NewPublicSubkey(fp, sub, "subkey-1");
        pgp.registerPublicSubkey(fp, sub, "subkey-1");

        // revoke
        vm.expectEmit(true, false, false, true, address(pgp));
        emit NewRevocationCertificate(fp, "rev");
        pgp.revokeKey(fp, "rev");
    }

    function testSubkeyParentNotRegisteredReverts() public {
        bytes32 parent = keccak256(abi.encodePacked("missing"));
        bytes32 sub = keccak256(abi.encodePacked("sub2"));
        vm.expectRevert();
        pgp.registerPublicSubkey(parent, sub, "x");
    }

    function testParentIsASubkeyReverts() public {
        // Register a parent key and a subkey under it
        bytes32 parent = keccak256(abi.encodePacked("parent1"));
        bytes32 sub = keccak256(abi.encodePacked("sub1"));
        bytes32 sub2 = keccak256(abi.encodePacked("sub2"));
        pgp.registerPublicKey(parent, "p");
        pgp.registerPublicSubkey(parent, sub, "s1");

        // Now parent becomes the parent of sub; attempting to register subkey with parent=sub should revert
        vm.expectRevert();
        pgp.registerPublicSubkey(sub, sub2, "s2");
    }

    function testListRevocationsPaginationEdgeCases() public {
        bytes32 fp = keccak256(abi.encodePacked("r1"));
        pgp.registerPublicKey(fp, "k");
        // no revocations yet
        uint256[] memory empty = pgp.listRevocations(fp, 0, 10);
        assertEq(empty.length, 0);

        // create revocations in blocks
        vm.roll(10);
        pgp.revokeKey(fp, "rev1");
        vm.roll(11);
        pgp.revokeKey(fp, "rev2");
        vm.roll(12);
        pgp.revokeKey(fp, "rev3");

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
        pgp.registerPublicKey(parent, "kp");
        // add three subkeys
        bytes32 s1 = keccak256(abi.encodePacked("s1"));
        bytes32 s2 = keccak256(abi.encodePacked("s2"));
        bytes32 s3 = keccak256(abi.encodePacked("s3"));
        pgp.registerPublicSubkey(parent, s1, "a");
        pgp.registerPublicSubkey(parent, s2, "b");
        pgp.registerPublicSubkey(parent, s3, "c");

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
        pgp.registerPublicKey(fp, "k");
        vm.expectRevert();
        pgp.registerPublicKey(fp, "k-again");
    }

    function testRevokeNotRegisteredReverts() public {
        bytes32 fp = keccak256(abi.encodePacked("noreg"));
        vm.expectRevert();
        pgp.revokeKey(fp, "rev");
    }

    function testIsSubKeyAndParentOfViews() public {
        bytes32 parent = keccak256(abi.encodePacked("pv1"));
        bytes32 sub = keccak256(abi.encodePacked("sv1"));
        pgp.registerPublicKey(parent, "parent-pk");
        assertTrue(!pgp.isSubKey(parent));

        pgp.registerPublicSubkey(parent, sub, "sub-pk");
        assertTrue(pgp.isSubKey(sub));
        assertEq(pgp.parentOf(sub), parent);
        // parentOf for a non-subkey returns zero
        assertEq(pgp.parentOf(parent), bytes32(0));
    }

    function testGetKeyPublicationBatchMixed() public {
        bytes32 a = keccak256(abi.encodePacked("a"));
        bytes32 b = keccak256(abi.encodePacked("b"));
        bytes32 c = keccak256(abi.encodePacked("c"));
        pgp.registerPublicKey(a, "A");
        // b remains unregistered
        pgp.registerPublicKey(c, "C");

        bytes32[] memory ids = new bytes32[](3);
        ids[0] = a; ids[1] = b; ids[2] = c;
        uint256[] memory pubs = pgp.getKeyPublicationBatch(ids);
        assertEq(pubs.length, 3);
        assertTrue(pubs[0] != 0);
        assertEq(pubs[1], 0);
        assertTrue(pubs[2] != 0);
    }

    function testRegisterSubkeyAlreadyRegisteredReverts() public {
        bytes32 parent = keccak256(abi.encodePacked("px"));
        bytes32 sub = keccak256(abi.encodePacked("sx"));
        pgp.registerPublicKey(parent, "P");
        pgp.registerPublicSubkey(parent, sub, "S");
        // attempting to register same subkey again should revert
        vm.expectRevert();
        pgp.registerPublicSubkey(parent, sub, "S2");
    }

    function testRevokeAndListExactBoundary() public {
        bytes32 fp = keccak256(abi.encodePacked("rb1"));
        pgp.registerPublicKey(fp, "rbk");
        vm.roll(50);
        pgp.revokeKey(fp, "r1");
        vm.roll(51);
        pgp.revokeKey(fp, "r2");

        // request start 1 limit 1 -> should return only second revocation
        uint256[] memory out = pgp.listRevocations(fp, 1, 1);
        assertEq(out.length, 1);
    }

    function testListSubkeysWhenNoneReturnsEmpty() public {
        bytes32 parent = keccak256(abi.encodePacked("px-none"));
        pgp.registerPublicKey(parent, "pk");
        bytes32[] memory r = pgp.listSubkeys(parent, 0, 10);
        assertEq(r.length, 0);
    }

    function testListRevocationsWithLargeLimitReturnsAll() public {
        bytes32 fp = keccak256(abi.encodePacked("r-large"));
        pgp.registerPublicKey(fp, "k");

        // create two revocations
        vm.roll(20);
        pgp.revokeKey(fp, "rev-a");
        vm.roll(21);
        pgp.revokeKey(fp, "rev-b");

        // request with a large limit that exceeds remaining items -> should return both revocations
        uint256[] memory out = pgp.listRevocations(fp, 0, 10);
        assertEq(out.length, 2);
    }

    function testListSubkeysWithLargeLimitReturnsAll() public {
        bytes32 parent = keccak256(abi.encodePacked("par-large"));
        pgp.registerPublicKey(parent, "kp");
        bytes32 s1 = keccak256(abi.encodePacked("sl1"));
        bytes32 s2 = keccak256(abi.encodePacked("sl2"));
        pgp.registerPublicSubkey(parent, s1, "a");
        pgp.registerPublicSubkey(parent, s2, "b");

        // request with a large limit -> should return both subkeys
        bytes32[] memory out = pgp.listSubkeys(parent, 0, 10);
        assertEq(out.length, 2);
    }

    // Reentrancy attacker will be declared at top-level

    function testNonReentrantProtectionAgainstRefundReentry() public {
        // set up small pgp instance
        Web3PGP impl = new Web3PGP();
        bytes memory data = abi.encodeWithSelector(Web3PGP.initialize.selector, uint256(0));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        Web3PGP local = Web3PGP(payable(address(proxy)));

        // choose fingerprint and attacker
        bytes32 f = keccak256(abi.encodePacked("reent"));
        // deploy attacker
        ReentrancyAttacker attacker = (new ReentrancyAttacker){value: 0}(address(local), f);

    // call attacker.attack sending 1 wei so collectFee will refund (fee is 0) and trigger fallback
    attacker.attack{value: 1}();

        // registration should have succeeded for the outer call
        assertTrue(local.exist(f));
        // innerSucceeded should be false because nonReentrant prevented reentry
        assertTrue(!attacker.innerSucceeded());
    }
}
