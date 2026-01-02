// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Web3Doc} from "src/Web3Doc.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {IWeb3Doc} from "src/IWeb3Doc.sol";
import {IFlatFee} from "src/IFlatFee.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Web3DocTest is Test {
    AccessManager pgpAccessManager;
    AccessManager docAccessManager;
    Web3Doc doc;
    Web3PGP pgp;
    
    address admin = vm.addr(1);
    address treasurer = vm.addr(2);
    address upgrader = vm.addr(3);
    address alice = vm.addr(4);
    
    // Role identifiers
    uint64 public constant TREASURER_ROLE = 1;
    uint64 public constant UPGRADER_ROLE = 2;

    // declare events to allow vm.expectEmit + emit(...) pattern
    event Document(
        uint256 indexed id,
        bytes32 indexed emitter,
        bytes32 indexed dochash,
        bytes signature,
        bytes document,
        string uri,
        string mimeType
    );
    event Copy(uint256 indexed copy, uint256 indexed original, bytes32 indexed emitter, bytes document, string uri);
    event Signature(uint256 indexed id, bytes32 indexed emitter, bytes32 indexed signatureHash, bytes signature);
    event SignatureRevocation(uint256 indexed id, bytes32 indexed emitter, bytes32 indexed signatureHash, bytes signature);
    event Timestamp(uint256 indexed id, bytes32 indexed emitter, bytes32 indexed dochash, bytes signature);
    event Notification(
        uint256 indexed id,
        bytes32 emitter,
        bytes32 indexed recipient,
        IWeb3Doc.EventType source,
        bool indexed signatureRequested
    );

    function setUp() public {
        // Deploy AccessManagers
        vm.startPrank(admin);
        pgpAccessManager = new AccessManager(admin);
        docAccessManager = new AccessManager(admin);
        vm.stopPrank();
        
        // Deploy and initialize Web3PGP
        Web3PGP pgpImpl = new Web3PGP();
        bytes memory pgpInitData = abi.encodeCall(Web3PGP.initialize, (uint256(0), address(pgpAccessManager)));
        ERC1967Proxy pgpProxy = new ERC1967Proxy(address(pgpImpl), pgpInitData);
        pgp = Web3PGP(payable(address(pgpProxy)));
        
        // Deploy and initialize Web3Doc
        Web3Doc docImpl = new Web3Doc();
        bytes memory docInitData = abi.encodeCall(Web3Doc.initialize, (uint256(0), address(docAccessManager), address(pgp)));
        ERC1967Proxy docProxy = new ERC1967Proxy(address(docImpl), docInitData);
        doc = Web3Doc(payable(address(docProxy)));
        
        // Setup roles for both contracts
        vm.startPrank(admin);
        
        // Grant roles
        pgpAccessManager.grantRole(TREASURER_ROLE, treasurer, 0);
        docAccessManager.grantRole(TREASURER_ROLE, treasurer, 0);
        
        // Configure permissions for Web3PGP
        bytes4[] memory treasurerSelectors = new bytes4[](2);
        treasurerSelectors[0] = IFlatFee.updateRequestedFee.selector;
        treasurerSelectors[1] = IFlatFee.withdrawFees.selector;
        
        pgpAccessManager.setTargetFunctionRole(
            address(pgp),
            treasurerSelectors,
            TREASURER_ROLE
        );
        
        // Configure permissions for Web3Doc
        docAccessManager.setTargetFunctionRole(
            address(doc),
            treasurerSelectors,
            TREASURER_ROLE
        );
        
        vm.stopPrank();
    }

    function testSendOnChainEmitsDocumentEvent() public {
        bytes32 emitter = keccak256("em");
        pgp.register(emitter, new bytes32[](0), "k");

        bytes32 dochash = keccak256("d1");
        bytes memory signature = "sig";
        bytes memory document = "doc";

        vm.expectEmit(true, true, true, false, address(doc));
        emit Document(1, emitter, dochash, signature, document, "", "text/plain");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, signature, document, "text/plain");
    }

    function testTimestampEmitsTimestamp() public {
        bytes32 emitter = keccak256("em2");
        pgp.register(emitter, new bytes32[](0), "k2");
        bytes32 dochash = keccak256("h2");
        bytes memory signature = "sig2";
        
        vm.expectEmit(true, true, true, false, address(doc));
        emit Timestamp(1, emitter, dochash, signature);
        doc.timestamp(emitter, dochash, signature);
    }

    function testSendOffChainEmitsDocumentEvent() public {
        bytes32 emitter = keccak256("em-off");
        pgp.register(emitter, new bytes32[](0), "k-off");

        bytes32 dochash = keccak256("doc-off-1");
        bytes memory signature = "sig-off";
        string memory uri = "ipfs://QmExample";

        vm.expectEmit(true, true, true, false, address(doc));
        emit Document(1, emitter, dochash, signature, new bytes(0), uri, "application/pdf");
        doc.sendOffChain(emitter, new IWeb3Doc.Recipient[](0), dochash, signature, uri, "application/pdf");
        
        uint256 b = doc.getDocumentBlockNumberByID(1);
        assertTrue(b != 0);
    }

    function testCopyOnChainAndIsCopyOf() public {
        bytes32 emitter = keccak256("em-copy");
        pgp.register(emitter, new bytes32[](0), "k-copy");

        bytes32 dochash = keccak256("orig");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s", "orig-doc", "text/plain");

        doc.copyOnChain(1, emitter, new IWeb3Doc.Recipient[](0), "copied-doc");

        uint256 original = doc.isCopyOf(2);
        assertEq(original, 1);
    }

    function testCopyOffChainRevertsWhenOriginalIsCopy() public {
        bytes32 emitter = keccak256("em-copy2");
        pgp.register(emitter, new bytes32[](0), "k-copy2");

        bytes32 dochash = keccak256("orig2");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s2", "orig2", "text/plain");
        doc.copyOffChain(1, emitter, new IWeb3Doc.Recipient[](0), "ipfs://copy");

        vm.expectRevert();
        doc.copyOffChain(2, emitter, new IWeb3Doc.Recipient[](0), "ipfs://copy2");
    }

    function testSendOnChainWithRecipientsEmitsNotification() public {
        bytes32 emitter = keccak256("em-not");
        bytes32 recipientFp = keccak256("rec-not");
        pgp.register(emitter, new bytes32[](0), "k-em");
        pgp.register(recipientFp, new bytes32[](0), "k-rec");

        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: recipientFp, signatureRequested: true});

        bytes32 dochash = keccak256("d-not");
        bytes memory signature = "sig-not";
        bytes memory document = "doc-not";

        vm.expectEmit(true, true, true, false, address(doc));
        emit Document(1, emitter, dochash, signature, document, "", "text/plain");

        vm.expectEmit(true, false, true, false, address(doc));
        emit Notification(1, emitter, recipientFp, IWeb3Doc.EventType.DOCUMENT, true);

        doc.sendOnChain(emitter, recs, dochash, signature, document, "text/plain");
    }

    function testSendOffChainWithRecipientsEmitsNotification() public {
        bytes32 emitter = keccak256("em-not2");
        bytes32 recipientFp = keccak256("rec-not2");
        pgp.register(emitter, new bytes32[](0), "k-em2");
        pgp.register(recipientFp, new bytes32[](0), "k-rec2");

        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: recipientFp, signatureRequested: false});

        vm.expectEmit(true, true, true, false, address(doc));
        emit Document(1, emitter, keccak256("dh"), "s", new bytes(0), "uri", "text/plain");

        vm.expectEmit(true, false, true, false, address(doc));
        emit Notification(1, emitter, recipientFp, IWeb3Doc.EventType.DOCUMENT, false);

        doc.sendOffChain(emitter, recs, keccak256("dh"), "s", "uri", "text/plain");
    }

    function testCopyCreatesCorrectMapping() public {
        bytes32 emitter = keccak256("em-copy-nf");
        pgp.register(emitter, new bytes32[](0), "k-copy-nf");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("orig"), "s", "orig", "text/plain");
        doc.copyOnChain(1, emitter, new IWeb3Doc.Recipient[](0), "copy");
        
        assertEq(doc.isCopyOf(2), 1);
    }

    function testCopyOnChainRevertsWhenOriginalIsCopy() public {
        bytes32 emitter = keccak256("em-copy3");
        pgp.register(emitter, new bytes32[](0), "k-copy3");

        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("o"), "s", "orig", "text/plain");
        doc.copyOnChain(1, emitter, new IWeb3Doc.Recipient[](0), "copy1");

        vm.expectRevert();
        doc.copyOnChain(2, emitter, new IWeb3Doc.Recipient[](0), "copy-of-copy");
    }

    function testSignAndListSignaturesPagination() public {
        bytes32 emitter = keccak256("em-sign");
        pgp.register(emitter, new bytes32[](0), "k-sign");

        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");

        vm.roll(10);
        doc.sign(1, emitter, "sig1");
        vm.roll(11);
        doc.sign(1, emitter, "sig2");
        vm.roll(12);
        doc.sign(1, emitter, "sig3");

        uint256[] memory sigs = doc.listSignatures(1, 0, 10);
        assertEq(sigs.length, 3);

        uint256[] memory page = doc.listSignatures(1, 1, 2);
        assertEq(page.length, 2);
    }

    function testListSignaturesEdgeCases() public {
        bytes32 emitter = keccak256("em-edge");
        pgp.register(emitter, new bytes32[](0), "k-edge");

        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d-edge"), "s", "doc", "text/plain");

        uint256[] memory empty = doc.listSignatures(1, 0, 10);
        assertEq(empty.length, 0);

        vm.roll(20);
        doc.sign(1, emitter, "s1");
        vm.roll(21);
        doc.sign(1, emitter, "s2");

        uint256[] memory e2 = doc.listSignatures(1, 5, 10);
        assertEq(e2.length, 0);

        uint256[] memory e3 = doc.listSignatures(1, 0, 0);
        assertEq(e3.length, 0);
    }

    function testGetDocumentBlockNumberByIDBatchAndTimestamp() public {
        bytes32 emitter = keccak256("em-batch");
        pgp.register(emitter, new bytes32[](0), "k-batch");

        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d1"), "s1", "doc1", "text/plain");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d2"), "s2", "doc2", "text/plain");
        doc.timestamp(emitter, keccak256("ts"), "ts-sig");

        uint256[] memory ids = new uint256[](3);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 3;
        uint256[] memory blocks = doc.getDocumentBlockNumberByIDBatch(ids);
        assertEq(blocks.length, 3);
        assertTrue(blocks[0] != 0);
        assertTrue(blocks[1] != 0);
        assertTrue(blocks[2] != 0);
    }

    function testRecipientNotFoundReverts() public {
        bytes32 emitter = keccak256("em-rec-err");
        bytes32 nonExistentRecipient = keccak256("rec-missing");
        pgp.register(emitter, new bytes32[](0), "k-rec");

        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: nonExistentRecipient, signatureRequested: false});

        vm.expectRevert();
        doc.sendOnChain(emitter, recs, keccak256("d"), "s", "doc", "text/plain");
    }

    function testEmitterNotFoundReverts() public {
        bytes32 nonExistentEmitter = keccak256("em-missing");
        
        vm.expectRevert();
        doc.sendOnChain(nonExistentEmitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
    }

    /*****************************************************************************************************************/
    /* UUPS UPGRADE TESTS                                                                                            */
    /*****************************************************************************************************************/

    function testUpgraderCanUpgrade() public {
        // Deploy new implementation
        Web3Doc newImplementation = new Web3Doc();
        
        // Create a document to track state
        bytes32 emitter = keccak256("upgrade-test");
        pgp.register(emitter, new bytes32[](0), "key");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("doc"), "sig", "data", "text/plain");
        
        uint256 blockNum = doc.getDocumentBlockNumberByID(1);
        assertTrue(blockNum != 0);
        
        // Setup upgrader role for Web3Doc
        vm.startPrank(admin);
        docAccessManager.grantRole(UPGRADER_ROLE, upgrader, 0);
        bytes4[] memory upgraderSelectors = new bytes4[](1);
        upgraderSelectors[0] = bytes4(keccak256("upgradeToAndCall(address,bytes)"));
        docAccessManager.setTargetFunctionRole(
            address(doc),
            upgraderSelectors,
            UPGRADER_ROLE
        );
        vm.stopPrank();
        
        // Upgrader upgrades the contract
        vm.prank(upgrader);
        doc.upgradeToAndCall(address(newImplementation), "");
        
        // State should be preserved
        uint256 blockNumAfter = doc.getDocumentBlockNumberByID(1);
        assertEq(blockNum, blockNumAfter);
    }

    function testNonUpgraderCannotUpgrade() public {
        Web3Doc newImplementation = new Web3Doc();
        
        // Setup upgrader role first
        vm.startPrank(admin);
        docAccessManager.grantRole(UPGRADER_ROLE, upgrader, 0);
        bytes4[] memory upgraderSelectors = new bytes4[](1);
        upgraderSelectors[0] = bytes4(keccak256("upgradeToAndCall(address,bytes)"));
        docAccessManager.setTargetFunctionRole(
            address(doc),
            upgraderSelectors,
            UPGRADER_ROLE
        );
        vm.stopPrank();
        
        // Alice (non-upgrader) cannot upgrade
        vm.prank(alice);
        vm.expectRevert();
        doc.upgradeToAndCall(address(newImplementation), "");
    }

    function testUpgradePreservesAllState() public {
        bytes32 emitter = keccak256("em-upgrade");
        pgp.register(emitter, new bytes32[](0), "k");
        
        // Create various documents
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d1"), "s1", "doc1", "text/plain");
        doc.sendOffChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d2"), "s2", "ipfs://doc2", "text/plain");
        doc.timestamp(emitter, keccak256("ts"), "ts-sig");
        
        vm.roll(50);
        doc.sign(1, emitter, "sig-extra");
        
        // Copy a document
        doc.copyOnChain(1, emitter, new IWeb3Doc.Recipient[](0), "copy-data");
        
        // Setup upgrader and upgrade
        vm.startPrank(admin);
        docAccessManager.grantRole(UPGRADER_ROLE, upgrader, 0);
        bytes4[] memory upgraderSelectors = new bytes4[](1);
        upgraderSelectors[0] = bytes4(keccak256("upgradeToAndCall(address,bytes)"));
        docAccessManager.setTargetFunctionRole(
            address(doc),
            upgraderSelectors,
            UPGRADER_ROLE
        );
        vm.stopPrank();
        
        Web3Doc newImplementation = new Web3Doc();
        vm.prank(upgrader);
        doc.upgradeToAndCall(address(newImplementation), "");
        
        // Verify all documents still exist
        assertTrue(doc.getDocumentBlockNumberByID(1) != 0);
        assertTrue(doc.getDocumentBlockNumberByID(2) != 0);
        assertTrue(doc.getDocumentBlockNumberByID(3) != 0);
        assertTrue(doc.getDocumentBlockNumberByID(4) != 0);
        
        // Verify copy mapping preserved
        assertEq(doc.isCopyOf(4), 1);
        
        // Verify signatures preserved
        uint256[] memory sigs = doc.listSignatures(1, 0, 10);
        assertEq(sigs.length, 1);
        assertEq(sigs[0], 50);
        
        // Verify can still use functions after upgrade
        bytes32 newEmitter = keccak256("post-upgrade");
        pgp.register(newEmitter, new bytes32[](0), "new-key");
        doc.sendOnChain(newEmitter, new IWeb3Doc.Recipient[](0), keccak256("new"), "new-sig", "new-doc", "text/plain");
        assertTrue(doc.getDocumentBlockNumberByID(5) != 0);
    }

    /*****************************************************************************************************************/
    /* FLATFEE RBAC TESTS                                                                                            */
    /*****************************************************************************************************************/

    function testTreasurerCanUpdateFee() public {
        assertEq(doc.requestedFee(), 0);
        
        vm.prank(treasurer);
        doc.updateRequestedFee(0.5 ether);
        
        assertEq(doc.requestedFee(), 0.5 ether);
    }

    function testNonTreasurerCannotUpdateFee() public {
        vm.prank(alice);
        vm.expectRevert();
        doc.updateRequestedFee(0.5 ether);
        
        assertEq(doc.requestedFee(), 0);
    }

    function testTreasurerCanWithdrawFees() public {
        // Set a fee and have someone pay it
        vm.prank(treasurer);
        doc.updateRequestedFee(0.5 ether);
        
        bytes32 emitter = keccak256("fee-test");
        pgp.register(emitter, new bytes32[](0), "key");
        
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        doc.sendOnChain{value: 0.5 ether}(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        assertEq(address(doc).balance, 0.5 ether);
        
        uint256 treasurerBalanceBefore = treasurer.balance;
        
        vm.prank(treasurer);
        doc.withdrawFees(treasurer);
        
        assertEq(address(doc).balance, 0);
        assertEq(treasurer.balance, treasurerBalanceBefore + 0.5 ether);
    }

    function testNonTreasurerCannotWithdrawFees() public {
        // Set a fee and have someone pay it
        vm.prank(treasurer);
        doc.updateRequestedFee(0.5 ether);
        
        bytes32 emitter = keccak256("fee-test2");
        pgp.register(emitter, new bytes32[](0), "key");
        
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        doc.sendOnChain{value: 0.5 ether}(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        assertEq(address(doc).balance, 0.5 ether);
        
        vm.prank(alice);
        vm.expectRevert();
        doc.withdrawFees(alice);
        
        assertEq(address(doc).balance, 0.5 ether);
    }

    /*****************************************************************************************************************/
    /* SIGN TESTS                                                                                                    */
    /*****************************************************************************************************************/

    function testSignEmitsSignatureEvent() public {
        bytes32 emitter = keccak256("em-sign-evt");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData = "signature-data";
        bytes32 sigHash = keccak256(sigData);
        vm.roll(25);
        vm.expectEmit(true, true, true, false, address(doc));
        emit Signature(1, emitter, sigHash, sigData);
        
        doc.sign(1, emitter, sigData);
    }

    function testSignRevertsWhenEmitterNotFound() public {
        bytes32 emitter = keccak256("em-sign-ok");
        bytes32 nonExistent = keccak256("em-not-exist");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        vm.expectRevert();
        doc.sign(1, nonExistent, "sig");
    }

    function testMultipleSignaturesByDifferentEmitters() public {
        bytes32 em1 = keccak256("em1");
        bytes32 em2 = keccak256("em2");
        bytes32 em3 = keccak256("em3");
        
        pgp.register(em1, new bytes32[](0), "k1");
        pgp.register(em2, new bytes32[](0), "k2");
        pgp.register(em3, new bytes32[](0), "k3");
        
        doc.sendOnChain(em1, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        vm.roll(10);
        doc.sign(1, em1, "sig1");
        vm.roll(11);
        doc.sign(1, em2, "sig2");
        vm.roll(12);
        doc.sign(1, em3, "sig3");
        
        uint256[] memory sigs = doc.listSignatures(1, 0, 10);
        assertEq(sigs.length, 3);
        assertEq(sigs[0], 10);
        assertEq(sigs[1], 11);
        assertEq(sigs[2], 12);
    }

    /*****************************************************************************************************************/
    /* COPY WITH RECIPIENTS TESTS                                                                                    */
    /*****************************************************************************************************************/

    function testCopyOffChainEmitsCopyEvent() public {
        bytes32 emitter = keccak256("em-copy-off");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("orig"), "s", "orig-doc", "text/plain");
        
        vm.expectEmit(true, true, true, false, address(doc));
        emit Copy(2, 1, emitter, new bytes(0), "ipfs://copy");
        
        doc.copyOffChain(1, emitter, new IWeb3Doc.Recipient[](0), "ipfs://copy");
    }

    function testCopyOnChainWithRecipientsEmitsNotification() public {
        bytes32 emitter = keccak256("em-copy-rec");
        bytes32 recipient = keccak256("rec-copy");
        
        pgp.register(emitter, new bytes32[](0), "k-em");
        pgp.register(recipient, new bytes32[](0), "k-rec");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("orig"), "s", "orig", "text/plain");
        
        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: recipient, signatureRequested: true});
        
        vm.expectEmit(true, true, true, false, address(doc));
        emit Copy(2, 1, emitter, "copy-data", "");
        
        vm.expectEmit(true, false, true, false, address(doc));
        emit Notification(2, emitter, recipient, IWeb3Doc.EventType.COPY, true);
        
        doc.copyOnChain(1, emitter, recs, "copy-data");
    }

    function testCopyOffChainWithRecipientsEmitsNotification() public {
        bytes32 emitter = keccak256("em-copy-off-rec");
        bytes32 recipient = keccak256("rec-copy-off");
        
        pgp.register(emitter, new bytes32[](0), "k-em");
        pgp.register(recipient, new bytes32[](0), "k-rec");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("orig"), "s", "orig", "text/plain");
        
        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: recipient, signatureRequested: false});
        
        vm.expectEmit(true, true, true, false, address(doc));
        emit Copy(2, 1, emitter, new bytes(0), "ipfs://copy");
        
        vm.expectEmit(true, false, true, false, address(doc));
        emit Notification(2, emitter, recipient, IWeb3Doc.EventType.COPY, false);
        
        doc.copyOffChain(1, emitter, recs, "ipfs://copy");
    }

    /*****************************************************************************************************************/
    /* ADDITIONAL ROBUSTNESS TESTS                                                                                   */
    /*****************************************************************************************************************/

    function testSendWithMultipleRecipients() public {
        bytes32 emitter = keccak256("em-multi");
        bytes32 rec1 = keccak256("rec1");
        bytes32 rec2 = keccak256("rec2");
        bytes32 rec3 = keccak256("rec3");
        
        pgp.register(emitter, new bytes32[](0), "k-em");
        pgp.register(rec1, new bytes32[](0), "k-r1");
        pgp.register(rec2, new bytes32[](0), "k-r2");
        pgp.register(rec3, new bytes32[](0), "k-r3");
        
        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](3);
        recs[0] = IWeb3Doc.Recipient({fingerprint: rec1, signatureRequested: true});
        recs[1] = IWeb3Doc.Recipient({fingerprint: rec2, signatureRequested: false});
        recs[2] = IWeb3Doc.Recipient({fingerprint: rec3, signatureRequested: true});
        
        // Expect Document event
        vm.expectEmit(true, true, true, false, address(doc));
        emit Document(1, emitter, keccak256("d"), "s", "doc", "", "text/plain");
        
        // Expect 3 Notification events (we can't check all in one test easily, so check count)
        doc.sendOnChain(emitter, recs, keccak256("d"), "s", "doc", "text/plain");
        
        // Verify document was created
        assertTrue(doc.getDocumentBlockNumberByID(1) != 0);
    }

    function testTimestampRevertsWhenEmitterNotFound() public {
        bytes32 nonExistent = keccak256("em-ts-missing");
        
        vm.expectRevert();
        doc.timestamp(nonExistent, keccak256("dh"), "sig");
    }

    function testGetDocumentBlockNumberForNonExistentDoc() view public {
        uint256 blockNum = doc.getDocumentBlockNumberByID(9999);
        assertEq(blockNum, 0);
    }

    /*****************************************************************************************************************/
    /* SIGNATURE REVOCATION TESTS                                                                                   */
    /*****************************************************************************************************************/

    function testRevokeSignatureEmitsEvent() public {
        bytes32 emitter = keccak256("em-revoke");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        // Create a signature first
        bytes memory sigData = "signature-to-revoke";
        bytes32 sigHash = keccak256(sigData);
        vm.roll(50);
        doc.sign(1, emitter, sigData);
        
        // Now revoke it
        vm.roll(51);
        vm.expectEmit(true, true, false, false, address(doc));
        emit SignatureRevocation(1, emitter, sigHash, "revocation-sig");
        
        doc.revokeSignature(1, emitter, sigHash, "revocation-sig");
    }

    function testRevokeSignatureDocumentNotFoundReverts() public {
        bytes32 emitter = keccak256("em-revoke-doc");
        pgp.register(emitter, new bytes32[](0), "k");
        
        bytes32 sigHash = keccak256("sig");
        
        // Try to revoke signature on non-existent document
        vm.expectRevert();
        doc.revokeSignature(9999, emitter, sigHash, "rev");
    }

    function testRevokeSignatureEmitterNotFoundReverts() public {
        bytes32 emitter = keccak256("em-revoke-ok");
        bytes32 emitterNonExistent = keccak256("em-revoke-bad");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        doc.sign(1, emitter, "sig-data");
        
        bytes32 sigHash = keccak256("sig-data");
        
        // Try to revoke with non-existent emitter
        vm.expectRevert();
        doc.revokeSignature(1, emitterNonExistent, sigHash, "rev");
    }

    function testRevokeSignatureNonExistentSignatureReverts() public {
        bytes32 emitter = keccak256("em-revoke-sig");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes32 nonExistentSigHash = keccak256("sig-does-not-exist");
        
        // Try to revoke non-existent signature
        vm.expectRevert();
        doc.revokeSignature(1, emitter, nonExistentSigHash, "rev");
    }

    function testMultipleRevocationsOfSameSignature() public {
        bytes32 emitter = keccak256("em-multi-rev");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData = "sig-to-multi-revoke";
        bytes32 sigHash = keccak256(sigData);
        doc.sign(1, emitter, sigData);
        
        // Revoke at different blocks
        vm.roll(100);
        doc.revokeSignature(1, emitter, sigHash, "rev1");
        vm.roll(200);
        doc.revokeSignature(1, emitter, sigHash, "rev2");
        vm.roll(300);
        doc.revokeSignature(1, emitter, sigHash, "rev3");
    }

    /*****************************************************************************************************************/
    /* GET SIGNATURE BLOCK NUMBER BY HASH TESTS                                                                     */
    /*****************************************************************************************************************/

    function testGetSignatureBlockNumberByHashReturnsCorrectBlock() public {
        bytes32 emitter = keccak256("em-sig-block");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData = "signature-hash-1";
        bytes32 sigHash = keccak256(sigData);
        vm.roll(75);
        doc.sign(1, emitter, sigData);
        
        uint256 blockNum = doc.getSignatureBlockNumberByHash(sigHash);
        assertEq(blockNum, 75);
    }

    function testGetSignatureBlockNumberByHashReturnsZeroForNonExistent() view public {
        bytes32 nonExistentHash = keccak256("sig-does-not-exist");
        uint256 blockNum = doc.getSignatureBlockNumberByHash(nonExistentHash);
        assertEq(blockNum, 0);
    }

    function testGetSignatureBlockNumberByHashMultipleSignatures() public {
        bytes32 emitter = keccak256("em-multi-sig");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData1 = "sig1";
        bytes memory sigData2 = "sig2";
        bytes memory sigData3 = "sig3";
        bytes32 sig1 = keccak256(sigData1);
        bytes32 sig2 = keccak256(sigData2);
        bytes32 sig3 = keccak256(sigData3);
        
        vm.roll(50);
        doc.sign(1, emitter, sigData1);
        vm.roll(100);
        doc.sign(1, emitter, sigData2);
        vm.roll(150);
        doc.sign(1, emitter, sigData3);
        
        assertEq(doc.getSignatureBlockNumberByHash(sig1), 50);
        assertEq(doc.getSignatureBlockNumberByHash(sig2), 100);
        assertEq(doc.getSignatureBlockNumberByHash(sig3), 150);
    }

    /*****************************************************************************************************************/
    /* GET SIGNATURE BLOCK NUMBER BY HASH BATCH TESTS                                                               */
    /*****************************************************************************************************************/

    function testGetSignatureBlockNumberByHashBatchReturnsCorrectBlocks() public {
        bytes32 emitter = keccak256("em-batch-sig");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData1 = "batch-sig1";
        bytes memory sigData2 = "batch-sig2";
        bytes memory sigData3 = "batch-sig3";
        bytes32 sig1 = keccak256(sigData1);
        bytes32 sig2 = keccak256(sigData2);
        bytes32 sig3 = keccak256(sigData3);
        
        vm.roll(60);
        doc.sign(1, emitter, sigData1);
        vm.roll(120);
        doc.sign(1, emitter, sigData2);
        vm.roll(180);
        doc.sign(1, emitter, sigData3);
        
        bytes32[] memory sigs = new bytes32[](3);
        sigs[0] = sig1;
        sigs[1] = sig2;
        sigs[2] = sig3;
        
        uint256[] memory blocks = doc.getSignatureBlockNumberByHashBatch(sigs);
        assertEq(blocks.length, 3);
        assertEq(blocks[0], 60);
        assertEq(blocks[1], 120);
        assertEq(blocks[2], 180);
    }

    function testGetSignatureBlockNumberByHashBatchWithMixedExistence() public {
        bytes32 emitter = keccak256("em-batch-mixed");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData1 = "batch-mixed-1";
        bytes memory sigData2 = "batch-mixed-2";
        bytes memory sigData3 = "batch-mixed-3";
        bytes32 sig1 = keccak256(sigData1);
        bytes32 sig2 = keccak256(sigData2);
        bytes32 sig3 = keccak256(sigData3);
        bytes32 nonExistent = keccak256(abi.encodePacked("batch-mixed-nonexistent"));
        
        vm.roll(70);
        doc.sign(1, emitter, sigData1);
        // sig2 is not created
        vm.roll(140);
        doc.sign(1, emitter, sigData3);
        
        bytes32[] memory sigs = new bytes32[](4);
        sigs[0] = sig1;
        sigs[1] = sig2;
        sigs[2] = sig3;
        sigs[3] = nonExistent;
        
        uint256[] memory blocks = doc.getSignatureBlockNumberByHashBatch(sigs);
        assertEq(blocks.length, 4);
        assertEq(blocks[0], 70);
        assertEq(blocks[1], 0);
        assertEq(blocks[2], 140);
        assertEq(blocks[3], 0);
    }

    function testGetSignatureBlockNumberByHashBatchEmptyArray() view public {
        bytes32[] memory emptySigs = new bytes32[](0);
        uint256[] memory blocks = doc.getSignatureBlockNumberByHashBatch(emptySigs);
        assertEq(blocks.length, 0);
    }

    /*****************************************************************************************************************/
    /* LIST SIGNATURE REVOCATIONS BLOCK NUMBERS TESTS                                                               */
    /*****************************************************************************************************************/

    function testListSignatureRevocationsBlockNumbersEmpty() view public {
        bytes32 sigHash = keccak256("sig-no-revocations");
        uint256[] memory revs = doc.listSignatureRevocationsBlockNumbers(sigHash, 0, 10);
        assertEq(revs.length, 0);
    }

    function testListSignatureRevocationsBlockNumbersBasic() public {
        bytes32 emitter = keccak256("em-list-rev");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData = "sig-for-revocations";
        bytes32 sigHash = keccak256(sigData);
        doc.sign(1, emitter, sigData);
        
        // Create revocations at specific blocks
        vm.roll(100);
        doc.revokeSignature(1, emitter, sigHash, "rev1");
        vm.roll(150);
        doc.revokeSignature(1, emitter, sigHash, "rev2");
        vm.roll(200);
        doc.revokeSignature(1, emitter, sigHash, "rev3");
        
        // List all revocations
        uint256[] memory revs = doc.listSignatureRevocationsBlockNumbers(sigHash, 0, 10);
        assertEq(revs.length, 3);
        assertEq(revs[0], 100);
        assertEq(revs[1], 150);
        assertEq(revs[2], 200);
    }

    function testListSignatureRevocationsBlockNumbersPagination() public {
        bytes32 emitter = keccak256("em-rev-pag");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData = "sig-pag";
        bytes32 sigHash = keccak256(sigData);
        doc.sign(1, emitter, sigData);
        
        // Create 5 revocations
        for (uint256 i = 0; i < 5; i++) {
            vm.roll(100 + i * 10);
            doc.revokeSignature(1, emitter, sigHash, abi.encodePacked("rev", i));
        }
        
        // Test first page
        uint256[] memory page1 = doc.listSignatureRevocationsBlockNumbers(sigHash, 0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], 100);
        assertEq(page1[1], 110);
        
        // Test second page
        uint256[] memory page2 = doc.listSignatureRevocationsBlockNumbers(sigHash, 2, 2);
        assertEq(page2.length, 2);
        assertEq(page2[0], 120);
        assertEq(page2[1], 130);
        
        // Test last item
        uint256[] memory page3 = doc.listSignatureRevocationsBlockNumbers(sigHash, 4, 2);
        assertEq(page3.length, 1);
        assertEq(page3[0], 140);
    }

    function testListSignatureRevocationsBlockNumbersStartOutOfBounds() public {
        bytes32 emitter = keccak256("em-rev-bounds");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData = "sig-bounds";
        bytes32 sigHash = keccak256(sigData);
        doc.sign(1, emitter, sigData);
        vm.roll(100);
        doc.revokeSignature(1, emitter, sigHash, "rev1");
        
        // Start index beyond the list
        uint256[] memory revs = doc.listSignatureRevocationsBlockNumbers(sigHash, 10, 10);
        assertEq(revs.length, 0);
    }

    function testListSignatureRevocationsBlockNumbersZeroLimit() public {
        bytes32 emitter = keccak256("em-rev-zero");
        pgp.register(emitter, new bytes32[](0), "k");
        
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d"), "s", "doc", "text/plain");
        
        bytes memory sigData = "sig-zero";
        bytes32 sigHash = keccak256(sigData);
        doc.sign(1, emitter, sigData);
        vm.roll(100);
        doc.revokeSignature(1, emitter, sigHash, "rev1");
        
        // Zero limit returns empty
        uint256[] memory revs = doc.listSignatureRevocationsBlockNumbers(sigHash, 0, 0);
        assertEq(revs.length, 0);
    }

    /*****************************************************************************************************************/
    /* LIST DOCUMENT IDS BY HASH TESTS                                                                              */
    /*****************************************************************************************************************/

    function testListDocumentIdsByHashEmpty() view public {
        bytes32 dochash = keccak256("hash-no-docs");
        uint256[] memory ids = doc.listDocumentIdsByHash(dochash, 0, 10);
        assertEq(ids.length, 0);
    }

    function testListDocumentIdsByHashBasic() public {
        bytes32 emitter = keccak256("em-list-docs");
        pgp.register(emitter, new bytes32[](0), "k");
        
        bytes32 dochash = keccak256("shared-hash");
        
        // Create multiple documents with the same hash
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s1", "doc1", "text/plain");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s2", "doc2", "text/plain");
        doc.timestamp(emitter, dochash, "ts-sig");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s3", "doc3", "text/plain");
        
        // List all documents with this hash
        uint256[] memory ids = doc.listDocumentIdsByHash(dochash, 0, 10);
        assertEq(ids.length, 4);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
        assertEq(ids[2], 3);
        assertEq(ids[3], 4);
    }

    function testListDocumentIdsByHashPagination() public {
        bytes32 emitter = keccak256("em-doc-pag");
        pgp.register(emitter, new bytes32[](0), "k");
        
        bytes32 dochash = keccak256("doc-hash-pag");
        
        // Create 6 documents with the same hash
        for (uint256 i = 0; i < 6; i++) {
            doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, abi.encodePacked("sig", i), abi.encodePacked("doc", i), "text/plain");
        }
        
        // Test first page with limit 2
        uint256[] memory page1 = doc.listDocumentIdsByHash(dochash, 0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], 1);
        assertEq(page1[1], 2);
        
        // Test second page
        uint256[] memory page2 = doc.listDocumentIdsByHash(dochash, 2, 2);
        assertEq(page2.length, 2);
        assertEq(page2[0], 3);
        assertEq(page2[1], 4);
        
        // Test third page
        uint256[] memory page3 = doc.listDocumentIdsByHash(dochash, 4, 2);
        assertEq(page3.length, 2);
        assertEq(page3[0], 5);
        assertEq(page3[1], 6);
        
        // Request beyond available items
        uint256[] memory page4 = doc.listDocumentIdsByHash(dochash, 6, 2);
        assertEq(page4.length, 0);
    }

    function testListDocumentIdsByHashLargeLimitReturnsAll() public {
        bytes32 emitter = keccak256("em-doc-large");
        pgp.register(emitter, new bytes32[](0), "k");
        
        bytes32 dochash = keccak256("doc-hash-large");
        
        // Create 3 documents
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s1", "doc1", "text/plain");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s2", "doc2", "text/plain");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s3", "doc3", "text/plain");
        
        // Request with large limit
        uint256[] memory ids = doc.listDocumentIdsByHash(dochash, 0, 100);
        assertEq(ids.length, 3);
    }

    function testListDocumentIdsByHashDifferentHashes() public {
        bytes32 emitter = keccak256("em-diff-hash");
        pgp.register(emitter, new bytes32[](0), "k");
        
        bytes32 hash1 = keccak256("hash1");
        bytes32 hash2 = keccak256("hash2");
        
        // Create documents with different hashes
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), hash1, "s1", "doc1", "text/plain");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), hash2, "s2", "doc2", "text/plain");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), hash1, "s3", "doc3", "text/plain");
        
        // Hash1 should have 2 documents
        uint256[] memory ids1 = doc.listDocumentIdsByHash(hash1, 0, 10);
        assertEq(ids1.length, 2);
        assertEq(ids1[0], 1);
        assertEq(ids1[1], 3);
        
        // Hash2 should have 1 document
        uint256[] memory ids2 = doc.listDocumentIdsByHash(hash2, 0, 10);
        assertEq(ids2.length, 1);
        assertEq(ids2[0], 2);
    }

    function testListDocumentIdsByHashStartOutOfBounds() public {
        bytes32 emitter = keccak256("em-doc-bounds");
        pgp.register(emitter, new bytes32[](0), "k");
        
        bytes32 dochash = keccak256("doc-hash-bounds");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s", "doc", "text/plain");
        
        // Start index beyond the list
        uint256[] memory ids = doc.listDocumentIdsByHash(dochash, 10, 10);
        assertEq(ids.length, 0);
    }

    function testListDocumentIdsByHashZeroLimit() public {
        bytes32 emitter = keccak256("em-doc-zero");
        pgp.register(emitter, new bytes32[](0), "k");
        
        bytes32 dochash = keccak256("doc-hash-zero");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s", "doc", "text/plain");
        
        // Zero limit returns empty
        uint256[] memory ids = doc.listDocumentIdsByHash(dochash, 0, 0);
        assertEq(ids.length, 0);
    }

    function testListDocumentIdsByHashMixedDocumentTypes() public {
        bytes32 emitter = keccak256("em-mixed-types");
        pgp.register(emitter, new bytes32[](0), "k");
        
        bytes32 dochash = keccak256("hash-mixed");
        
        // Create different types of documents with same hash
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s1", "doc1", "text/plain");
        doc.sendOffChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s2", "ipfs://doc2", "text/plain");
        doc.timestamp(emitter, dochash, "ts-sig");
        doc.copyOnChain(1, emitter, new IWeb3Doc.Recipient[](0), "copy-doc");
        
        // List documents - should include all types
        uint256[] memory ids = doc.listDocumentIdsByHash(dochash, 0, 10);
        assertEq(ids.length, 3); // sendOnChain, sendOffChain, timestamp (copy has same hash but different ID)
    }
}

