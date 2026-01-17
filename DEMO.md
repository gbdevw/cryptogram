# DEMO

This guide will show how to create a key to timestamp documents and a well-known key to certify keys which can timestamp documents and be recognized as valid by the verification front-end

## Guide

1. Create the certification key

Use gpg to create the key that will be used to certify other keys.

```bash
gpg --quick-gen-key CERTIFY
```

2. Create the key used by the customer's company to timestamp documents

Use gpg to create the key that will be used to timestamp documents in the name of the customer's company.

```bash
gpg --quick-gen-key "SECURE CORP"
```

List the keys and find the fingerprints of both keys

```bash
gpg --list-keys
CERT_KEY=<fingerprint of CERTIFY>
CUST_KEY=<fingerprint of SECURE CORP>
```

3. Register the keys in Web3PGP

Use web3pgp CLI to register both keys on the blockchain.

```bash
export DEXES_WALLET_PRIVATE_KEY='0x...' # pragma: allowlist secret
gpg --export $CERT_KEY | web3pgp register
gpg --export $CUST_KEY | web3pgp register
```

4. Use the customer's key to timestamp a document

[Follow the guide](clis/examples/timestamping.md)

Write down the timestamp ID (15)

5. Certify the customer key with the certifier key and publish the certification on the blockchain

Use gpg to sign the customer's key with the certifier's key and establish a trust link

```bash
gpg -u $CERT_KEY --quick-sign-key $CUST_KEY
```

Use web3pgp CLI to register the certification made by CERT_KEY over CUST_KEY on the blockchain

```bash
gpg --export $CUST_KEY | web3pgp certify $CERT_KEY
```

6. Use the customer's key to timestamp the document again (repeat 4)

The goal of this step is to create a new timestamp AFTER the key was certified. Write down the timestamp ID (16)

7. Configure and start the verification front-end

frontends/timestamp-verification/public, create a file named 'well-known-keys.json' with the following content (use the CERTIFY key fingerprint)

```json
{
  "keys": [
    "0xB1D04E00671C5AA34A35028AAA78C54933C9320E"
  ]
}
```

The frontend will flag as 'verified' valid timestamps which match the provided document and are signed either by a well-known key or by a key certified by a well-known key. In the later case, the front end verifies the key was certified at the time the timestamp was published.

Now, start the front end

```bash
cd frontends/timestamp-verification
npm run build
npm run preview
```

Select the right file to trigger the timestamp validation. You should see the second timestamp being mentionned as valid because the first one was emitted when the customer key was not certified.

8. Revoke the certification of the customer key and publish the revocation of the certification

Use gpg to revoke the certification issued by the certifier's key to the customer's key and then use web3pgp CLI to publish the revocation

```bash
gpg -u $CERT_KEY --quick-revoke-sig $CUST_KEY $CERT_KEY
gpg --export $CUST_KEY | web3pgp revoke-certification $CERT_KEY
```

9. Timestamp the document again with the customer's key

Repeat the timestamping procedure with the same document and key then verify the document again with the front end. The new timestamp will not be displayed because the customer's key was no longer certified at the time of the timestamp publication on the blockchain.