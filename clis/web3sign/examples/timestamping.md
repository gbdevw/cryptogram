# Example: Timestamp a document

This guide will show you how to use Web3sign CLI to timestamp and verify a document.

## Prerequisites

- Install gpg
- Install web3pgp CLI
- Install web3sign CLI
- Register your signing on Web3PGP
- Have a funded Ethereum private key

## Steps

1. Create a document to timestamp

The first step is to create the document that will be timestamped and a fake document that will be used for verification

```bash
mkdir ~/tmp-timestamping
cd ~/tmp-timestamping
FILE_TO_TIMESTAMP=right.txt
WRONG_FILE=wrong.txt
echo "This is a 50$ invoice" > $FILE_TO_TIMESTAMP
echo "This is a 50$  invoice" > $WRONG_FILE
```

2. Hash the 'good' document and save the hash

The second step is to compute the keccak256 hash of the document using the web3sign CLI 'keccak256' command. The timestamp requires the signature to be made over the bytes of the keccak256 hash of the document.

```bash
HASH_DATA=hash.data
web3sign keccak256 -p $FILE_TO_TIMESTAMP > $HASH_DATA
DOCHASH=$(cat $HASH_DATA)
echo $DOCHASH
```

3. Sign the hash of the document

The third step is to create a detached signature over the bytes of the hash of the document with the signing key that was registered on Web3PGP

```bash
KEYFP='<fingerprint of your signing key>'
SIGFILE=signature.asc
echo -n $DOCHASH | xxd -r -p | gpg --local-user $KEYFP --armor --detach-sign > $SIGFILE
```

Note: xxd converts the hash encoded as a hexadecimal string to bytes which are then signed by gpg

4. Publish the timestamp on-chain

Use the timestamp command of the web3sign CLI to publish the detached signature and the hash of the document on-chain.

```bash
export DEXES_WALLET_PRIVATE_KEY='0x...' # pragma: allowlist secret
web3sign timestamp -e $KEYFP -H $DOCHASH -s $SIGFILE
```

Alternatively, the CLI can read the detached signature from stdin

```bash
export DEXES_WALLET_PRIVATE_KEY='0x...' # pragma: allowlist secret
cat $SIGFILE | web3sign timestamp -e $KEYFP -H $DOCHASH
```

The CLI will emit a JSON Object on stdout with the timestamp ID as top-level field (timestampId) and the receipt from the blockchain. The timestamp ID can be found in logs as well on stderr.

5. Verify the timestamp using the original document

There are several ways to find and verify timestamps related to a document on the blockchain.

For example, you can provide the ID of a timestamp and the path to the document to verify. The CLI will
1. Download the timestamp data (hash + signature + emitter key fingerprint)
2. Download the up-to-date emitter public key from the blockchain using the fingerprint from the timestamp
3. Verify the detached signature in the timestamp applies to the bytes of the hash in the timestamp. It also verifies the signing key was not revoked at the time of the publication of the timestamp on the blockchain
4. Open the document and hash its content
5. Compare the computed hash against the on-chain hash. A match confirms that the timestamp corresponds exactly to the provided file. This cryptographically guarantees the integrity of the document (it hasn't changed), proves its existence at the time of publication, and verifies the origin of the timestamp through the issuer's signature.
6. If the timestamp match, the CLI will emit the valid detached signature in armored format on stdout.

```bash
TIMESTAMP_ID=<your_timestamp_id>
web3sign verify --id $TIMESTAMP_ID --doc $FILE_TO_TIMESTAMP
```

Let's try with the wrong file and let's read the document from stdin (alternative mode)

```bash
TIMESTAMP_ID=<your_timestamp_id>
cat $WRONG_FILE | web3sign verify --id $TIMESTAMP_ID --doc
```

The CLI logs on stderr will explain the error and the CLI will exit with an exit code of 1 without displaying anything on stdout.

6. Verify the timestamp using the hash off the original document

Alternatively, if you know only the hash of the document to verify, you can use the --hash flag as isntead of the --doc flag. Note the --hash flag requires a value andd does not read from stdin.

```bash
web3sign verify --id $TIMESTAMP_ID --hash $DOCHASH
```

7. Play with verify command

A document can be timestamped many times. Or, the user might find a document and a USB stick and want to find records of it in Web3Sign but you do not know any timestamp ID which might match the document. In such case, you can provide the --all flag as instead of the --id flag. The CLI will use the provided hash or will hash the provided document and search all timestamps which have the same hash within their data. The CLI will download and verify each timestamp and only emit valid signatures on stdout.

```bash
web3sign verify --all --doc $FILE_TO_TIMESTAMP
```