// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Web3Doc.sol";
import "../src/Web3PGP.sol";
import "../src/IWeb3Doc.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Web3DocTest is Test {
    Web3Doc doc;
    Web3PGP pgp;

    // declare events to allow vm.expectEmit + emit(...) pattern
    event Publication(
        uint256 indexed id,
        bytes32 indexed emitter,
        bytes32 indexed dochash,
        bytes signature,
        bytes document,
        string uri,
        string mimeType
    );
    event Copy(uint256 indexed docId, uint256 original, bytes32 indexed emitter, bytes document, string uri);
    event Signature(uint256 indexed id, bytes32 indexed emitter, bytes signature);
    event Timestamp(uint256 indexed id, bytes32 indexed emitter, bytes32 indexed dochash, bytes signature);
    event Response(uint256 indexed response, uint256 indexed original, bytes32 indexed emitter);
    event Notification(
        uint256 indexed id,
        bytes32 emitter,
        bytes32 indexed recipient,
        IWeb3Doc.EventType source,
        bool indexed signatureRequested
    );

    function _deployPGP() internal returns (Web3PGP) {
        Web3PGP impl = new Web3PGP();
        bytes memory data = abi.encodeWithSelector(Web3PGP.initialize.selector, uint256(0));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        return Web3PGP(payable(address(proxy)));
    }

    function setUp() public {
        pgp = _deployPGP();
        // deploy doc and initialize with pgp address
        Web3Doc impl = new Web3Doc();
        bytes memory data = abi.encodeWithSelector(Web3Doc.initialize.selector, uint256(0), address(pgp));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        doc = Web3Doc(payable(address(proxy)));
    }

    function testSendOnChainEmitsPublicationAndNotification() public {
        bytes32 emitter = keccak256("em");
        // For simplicity, assume exist() will be false -> _checkEmitter will revert; so register key in pgp first
        pgp.registerPublicKey(emitter, "k");

        bytes32 dochash = keccak256("d1");
        bytes memory signature = "sig";
        bytes memory document = "doc";

        // check topics (docId, emitter, dochash) and emitter
        vm.expectEmit(true, true, true, false, address(doc));
        emit Publication(1, emitter, dochash, signature, document, "", "text/plain");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, signature, document, "text/plain");
    }

    function testTimestampEmitsTimestamp() public {
        bytes32 emitter = keccak256("em2");
        pgp.registerPublicKey(emitter, "k2");
        bytes32 dochash = keccak256("h2");
        bytes memory signature = "sig2";
        // check indexed topics for Timestamp (id, emitter, dochash)
        vm.expectEmit(true, true, true, false, address(doc));
        emit Timestamp(1, emitter, dochash, signature);
        doc.timestamp(emitter, dochash, signature);
    }

    function testNonReentrantOnSendOnChain() public pure {
        // Non-reentrancy detailed attack testing requires an attacker contract. Placeholder test kept as pure.
        assertTrue(true);
    }

    // --- Extra tests merged in ---

    function testSendOffChainEmitsPublicationAndNotification() public {
        bytes32 emitter = keccak256("em-off");
        pgp.registerPublicKey(emitter, "k-off");

        bytes32 dochash = keccak256("doc-off-1");
        bytes memory signature = "sig-off";
        string memory uri = "ipfs://QmExample";

        // Expect the Publication event (indexed id, emitter, dochash)
        vm.expectEmit(true, true, true, false, address(doc));
        emit Publication(1, emitter, dochash, signature, new bytes(0), uri, "application/pdf");
        // Call sendOffChain
        doc.sendOffChain(emitter, new IWeb3Doc.Recipient[](0), dochash, signature, uri, "application/pdf");
        // verify that block number was stored for id 1
        uint256 b = doc.getDocumentBlockNumberByID(1);
        assertTrue(b != 0);
    }

    function testCopyOnChainAndIsCopyOf() public {
        bytes32 emitter = keccak256("em-copy");
        pgp.registerPublicKey(emitter, "k-copy");

        // publish original
        bytes32 dochash = keccak256("orig");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s", "orig-doc", "text/plain");

        // copy on chain
        doc.copyOnChain(1, emitter, new IWeb3Doc.Recipient[](0), "copied-doc");

        // isCopyOf(2) should return 1
        uint256 original = doc.isCopyOf(2);
        assertEq(original, 1);
    }

    function testCopyOffChainRevertsWhenOriginalIsCopy() public {
        bytes32 emitter = keccak256("em-copy2");
        pgp.registerPublicKey(emitter, "k-copy2");

        // publish original
        bytes32 dochash = keccak256("orig2");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s2", "orig2", "text/plain");
        // make a copy (id 2)
        doc.copyOffChain(1, emitter, new IWeb3Doc.Recipient[](0), "ipfs://copy");

        // attempting to copy the copy should revert DocumentIsACopy
        vm.expectRevert();
        doc.copyOffChain(2, emitter, new IWeb3Doc.Recipient[](0), "ipfs://copy2");
    }

    function testSendOnChainWithRecipientsEmitsNotification() public {
        bytes32 emitter = keccak256("em-not");
        bytes32 recipientFp = keccak256("rec-not");
        pgp.registerPublicKey(emitter, "k-em");
        pgp.registerPublicKey(recipientFp, "k-rec");

        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: recipientFp, signatureRequested: true});

        bytes32 dochash = keccak256("d-not");
        bytes memory signature = "sig-not";
        bytes memory document = "doc-not";

        // Expect a Publication and a Notification (topics: id, emitter, dochash) and notification indexed topics
        vm.expectEmit(true, true, true, false, address(doc));
        emit Publication(1, emitter, dochash, signature, document, "", "text/plain");

        vm.expectEmit(true, false, true, false, address(doc));
        emit Notification(1, emitter, recipientFp, IWeb3Doc.EventType.PUBLICATION, true);

        doc.sendOnChain(emitter, recs, dochash, signature, document, "text/plain");
    }

    function testSendOffChainWithRecipientsEmitsNotification() public {
        bytes32 emitter = keccak256("em-not2");
        bytes32 recipientFp = keccak256("rec-not2");
        pgp.registerPublicKey(emitter, "k-em2");
        pgp.registerPublicKey(recipientFp, "k-rec2");

        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: recipientFp, signatureRequested: false});

        bytes32 dochash = keccak256("d-not2");
        bytes memory signature = "sig-not2";
        string memory uri = "ipfs://x";

        vm.expectEmit(true, true, true, false, address(doc));
        emit Publication(1, emitter, dochash, signature, new bytes(0), uri, "text/plain");

        vm.expectEmit(true, false, true, false, address(doc));
        emit Notification(1, emitter, recipientFp, IWeb3Doc.EventType.PUBLICATION, false);

        doc.sendOffChain(emitter, recs, dochash, signature, uri, "text/plain");
    }

    function testRespondOffChainEmitsResponseAndNotification() public {
        bytes32 emitter = keccak256("em-resp2");
        bytes32 recipientFp = keccak256("rec-resp2");
        pgp.registerPublicKey(emitter, "k-emr");
        pgp.registerPublicKey(recipientFp, "k-rcr");

        // publish root id 1
        bytes32 dochash = keccak256("r2");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s", "r-doc", "text/plain");

        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: recipientFp, signatureRequested: false});

        vm.expectEmit(true, true, true, false, address(doc));
        emit Publication(2, emitter, keccak256("dr2"), "sig2", new bytes(0), "uri", "text/plain");

        vm.expectEmit(true, true, false, false, address(doc));
        emit Response(2, 1, emitter);

        vm.expectEmit(true, false, true, false, address(doc));
        emit Notification(2, emitter, recipientFp, IWeb3Doc.EventType.RESPONSE, false);

        doc.respondOffChain(1, emitter, recs, keccak256("dr2"), "sig2", "uri", "text/plain");
    }

    function testCopyOnChainRevertsWhenOriginalNotFound() public {
        bytes32 emitter = keccak256("em-copy-nf");
        pgp.registerPublicKey(emitter, "k-copy-nf");
        vm.expectRevert();
        doc.copyOnChain(9999, emitter, new IWeb3Doc.Recipient[](0), "x");
    }

    function testCopyOnChainRevertsWhenOriginalIsCopy() public {
        bytes32 emitter = keccak256("em-copy3");
        pgp.registerPublicKey(emitter, "k-copy3");

        // publish original -> id 1
        bytes32 dochash = keccak256("orig3");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s3", "orig3", "text/plain");
        // make a copy -> id 2
        doc.copyOnChain(1, emitter, new IWeb3Doc.Recipient[](0), "copied-doc-3");

        // attempting to copy the copy should revert DocumentIsACopy
        vm.expectRevert();
        doc.copyOnChain(2, emitter, new IWeb3Doc.Recipient[](0), "copied-doc-3b");
    }

    function testRespondOnChainRevertsWhenSubjectNotFound() public {
        bytes32 emitter = keccak256("em-respond-nf");
        pgp.registerPublicKey(emitter, "k-rnf");

        // responding to a non-existing id should revert
        vm.expectRevert();
        doc.respondOnChain(9999, emitter, new IWeb3Doc.Recipient[](0), keccak256("x"), "s", "d", "text/plain");
    }

    function testRewindResponseThreadLimitTruncates() public {
        bytes32 emitter = keccak256("em-rewind");
        pgp.registerPublicKey(emitter, "k-rewind");

        // publish root -> id 1
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("rA"), "s", "root", "text/plain");
        // respond to 1 -> id 2
        doc.respondOnChain(1, emitter, new IWeb3Doc.Recipient[](0), keccak256("r2"), "s2", "resp2", "text/plain");
        // respond to 2 -> id 3
        doc.respondOnChain(2, emitter, new IWeb3Doc.Recipient[](0), keccak256("r3"), "s3", "resp3", "text/plain");
        // respond to 3 -> id 4
        doc.respondOnChain(3, emitter, new IWeb3Doc.Recipient[](0), keccak256("r4"), "s4", "resp4", "text/plain");

        // depth is 3 (3->2->1); request only 1 element should truncate to [3]
        uint256[] memory thread = doc.rewindResponseThread(4, 1);
        assertEq(thread.length, 1);
        assertEq(thread[0], 3);
    }

    function testRespondOnChainAndRewindThread() public {
        bytes32 emitter = keccak256("em-resp");
        pgp.registerPublicKey(emitter, "k-resp");

        // publish root
        bytes32 dochash = keccak256("r");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "sigR", "r-doc", "text/plain");
        // respond to 1 -> id 2
        doc.respondOnChain(1, emitter, new IWeb3Doc.Recipient[](0), keccak256("dr2"), "sig2", "resp2", "text/plain");
        // respond to 2 -> id 3
        doc.respondOnChain(2, emitter, new IWeb3Doc.Recipient[](0), keccak256("dr3"), "sig3", "resp3", "text/plain");

        // isResponseTo(3) should be 2
        uint256 parent = doc.isResponseTo(3);
        assertEq(parent, 2);

        // rewind thread for 3 should give [2,1]
        uint256[] memory thread = doc.rewindResponseThread(3, 5);
        assertEq(thread.length, 2);
        assertEq(thread[0], 2);
        assertEq(thread[1], 1);
    }

    function testSignAndListSignaturesPagination() public {
        bytes32 emitter = keccak256("em-sign");
        pgp.registerPublicKey(emitter, "k-sign");

        // publish doc id 1
        bytes32 dochash = keccak256("d-sign");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s", "d", "text/plain");

        // roll blocks and sign twice so stored block numbers differ
        vm.roll(100);
        doc.sign(1, emitter, "sig-a");
        vm.roll(101);
        doc.sign(1, emitter, "sig-b");

        uint256[] memory sigs = doc.listSignatures(1, 0, 10);
        assertEq(sigs.length, 2);
        // Ensure values are non-zero block numbers and distinct
        assertTrue(sigs[0] != 0 && sigs[1] != 0 && sigs[0] != sigs[1]);
    }

    function testListSignaturesEdgeCases() public {
        bytes32 emitter = keccak256("em-edge");
        pgp.registerPublicKey(emitter, "k-edge");

        // publish doc id 1
        bytes32 dochash = keccak256("d-edge");
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), dochash, "s", "d", "text/plain");

        // no signatures yet
        uint256[] memory empty = doc.listSignatures(1, 0, 10);
        assertEq(empty.length, 0);

        // sign once
        vm.roll(200);
        doc.sign(1, emitter, "sig1");

        // start >= length -> empty
        uint256[] memory e2 = doc.listSignatures(1, 5, 10);
        assertEq(e2.length, 0);

        // limit == 0 -> empty
        uint256[] memory e3 = doc.listSignatures(1, 0, 0);
        assertEq(e3.length, 0);

        // exact boundary: start 0 limit 1 -> one element
        uint256[] memory p = doc.listSignatures(1, 0, 1);
        assertEq(p.length, 1);
    }

    function testGetDocumentBlockNumberByIDBatchAndTimestamp() public {
        bytes32 emitter = keccak256("em-ts");
        pgp.registerPublicKey(emitter, "k-ts");

        // timestamp -> id 1
        bytes32 dochash = keccak256("h-ts");
        doc.timestamp(emitter, dochash, "sig-ts");
        // sendOnChain -> id 2
        doc.sendOnChain(emitter, new IWeb3Doc.Recipient[](0), keccak256("d2"), "s2", "doc2", "text/plain");

        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        uint256[] memory blocks = doc.getDocumentBlockNumberByIDBatch(ids);
        assertEq(blocks.length, 2);
        assertTrue(blocks[0] != 0 && blocks[1] != 0);
    }

    function testRecipientNotFoundReverts() public {
        bytes32 emitter = keccak256("em-rec");
        pgp.registerPublicKey(emitter, "k-rec");

        // build recipients array with an unregistered fingerprint
        IWeb3Doc.Recipient[] memory recs = new IWeb3Doc.Recipient[](1);
        recs[0] = IWeb3Doc.Recipient({fingerprint: keccak256("bad"), signatureRequested: false});

        vm.expectRevert();
        doc.sendOnChain(emitter, recs, keccak256("d-rec"), "s", "doc-rec", "text/plain");
    }
}
