// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Web3Doc.sol";
import "../src/Web3PGP.sol";
import "../src/IWeb3Doc.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Web3DocExtraTest is Test {
    Web3Doc doc;
    Web3PGP pgp;

    // declare events to allow vm.expectEmit + emit(...) pattern
    event Publication(uint256 indexed id, bytes32 indexed emitter, bytes32 indexed dochash, bytes signature, bytes document, string uri, string mimeType);
    event Copy(uint256 indexed docId, uint256 original, bytes32 indexed emitter, bytes document, string uri);
    event Signature(uint256 indexed id, bytes32 indexed emitter, bytes signature);
    event Timestamp(uint256 indexed id, bytes32 indexed emitter, bytes32 indexed dochash, bytes signature);

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

    function testSendOffChainEmitsPublicationAndNotification() public {
        bytes32 emitter = keccak256("em-off");
        pgp.registerPublicKey(emitter, "k-off");

        bytes32 dochash = keccak256("doc-off-1");
        bytes memory signature = "sig-off";
        string memory uri = "ipfs://QmExample";

    // Expect the Timestamp-like indexed topics for the forthcoming Publication
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
        doc.sendOnChain(emitter, new Web3Doc.Recipient[](0), dochash, "s", "orig-doc", "text/plain");

        // copy on chain
    // emit will be produced by contract; rely on state checks below instead of strict event matching
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
        doc.sendOnChain(emitter, new Web3Doc.Recipient[](0), dochash, "s2", "orig2", "text/plain");
    // make a copy (id 2)
    doc.copyOffChain(1, emitter, new IWeb3Doc.Recipient[](0), "ipfs://copy");

        // attempting to copy the copy should revert DocumentIsACopy
    vm.expectRevert();
    doc.copyOffChain(2, emitter, new IWeb3Doc.Recipient[](0), "ipfs://copy2");
    }

    function testRespondOnChainAndRewindThread() public {
        bytes32 emitter = keccak256("em-resp");
        pgp.registerPublicKey(emitter, "k-resp");

        // publish root
        bytes32 dochash = keccak256("r");
        doc.sendOnChain(emitter, new Web3Doc.Recipient[](0), dochash, "sigR", "r-doc", "text/plain");
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

    function testGetDocumentBlockNumberByIDBatchAndTimestamp() public {
        bytes32 emitter = keccak256("em-ts");
        pgp.registerPublicKey(emitter, "k-ts");

        // timestamp -> id 1
        bytes32 dochash = keccak256("h-ts");
    doc.timestamp(emitter, dochash, "sig-ts");
        // sendOnChain -> id 2
        doc.sendOnChain(emitter, new Web3Doc.Recipient[](0), keccak256("d2"), "s2", "doc2", "text/plain");

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
