# CLI usage guide with gpg as OpenPGP keyring

This guide will show you how to use web3pgp in combination with gpg to create key pairs, register your public keys on the blockchain, add subkeys, certify keys and revoke keys.

In the context of this guide, we will use the convenience commands of gpg to create keys, add subkeys, etc. Feel free to use other gpg commands which provide more options.

Please note the default cofniguration will use Sepolia testnet as target. No real money will be involved. Keep in mind it takes 12 seconds to Sepolia to produce a block so be patient when using the testing environment. Production environment aims to produce a block every 2 seconds.

## Prerequisites

- Install gpg
- Install web3pgp
- Have an Ethereum private key with funds to use the testnet

### Check web3pgp configuration

First, set the DEXES_WALLET_PRIVATE_KEY environment variable with the private key you will use to sign transactions on the testing network

```bash
export DEXES_WALLET_PRIVATE_KEY='0x...' 
```

Second verify your configuration points to the testing network 

```bash
web3pgp configuration display
```

You should see something similar. You can copy this configuration in ~/.web3pgp/config.yaml which is the default location for configuration files. Make sure you remove the "privateKey" field that is just there to show your private key is detected (the CLI does not display the key in full for security reasons).

```yaml
ethereum:
  chain: sepolia
  rpc:
    endpoints:
      - url: https://ethereum-sepolia-rpc.publicnode.com
        priority: 1
        batching:
          size: 20
          waitMs: 100
      - url: https://sepolia.gateway.tenderly.co
        priority: 2
        batching:
          size: 20
          waitMs: 100
      - url: https://sepolia.drpc.org
        priority: 3
        batching:
          size: 20
          waitMs: 100
      - url: https://1rpc.io/sepolia
        priority: 4
        batching:
          size: 20
          waitMs: 100
    maxBlockRange: 10000
    retry:
      count: 3
      delayMs: 200
  wallet:
    type: private-key
    privateKey: 0xb1...39fd
web3pgp:
  contract: "0xce66927a2E6171056a9c2464CFe83b813215A905"
monitoring:
  logging:
    level: info
```

### Create a key pair

First you need to create your key pair. By default, using the convinience commands from gpg, you will create your primary key (= your identity + signing key) and a subkey (used to encrypt data that are sent to you). gpg will ask you for a password. The password is used to encrypt your keys and make sure only you can use them. gpg will display your key fingerprint. The key fingerprint is used as a unique ID for a key in Web3PGP.

```bash
gpg --quick-gen-key <alias>
KEYFP='<your key fingerprint>'
KEYALIAS='<alias>'
PASSPHRASE='<your passphrase>'
```

Here is an example of gpg output. '568D4DF6B36FA952004C4228BC5864EF00EB2AB9' is the fingerprint that is stored in 'KEYFP' variable

```txt
pub   ed25519 2026-01-21 [SC] [expires: 2029-01-20]
      568D4DF6B36FA952004C4228BC5864EF00EB2AB9
uid                      SCROLL_TEST_1
sub   cv25519 2026-01-21 [E]
```

### Register your key in Web3PGP

web3pgp can read both binary and armored OpenPGP messages from both the filesystem and stdin. See this example:

```bash
gpg --export $KEYFP | web3pgp register
```

Here is the result on stdout

```json
{
  "success": true,
  "message": "Public key and subkeys registered successfully",
  "fingerprint": "568d4df6b36fa952004c4228bc5864ef00eb2ab9", 
  "subkeys": [
    "5bc19840cf8ebad3aff3006ae24f55b67e6e8e20" 
  ],
  "transaction": {
    "hash": "0x8cf6d9fff6bb10f1beabe2cbc856aeb54d0c230cedf639d175012ebd786e2bed",
    "blockNumber": "16246348"
  }
}
```

And the structured logs on stderr

```json
{"level":"info","time":1769001374400,"pid":13076,"hostname":"XXX","command":"register","msg":"Reading PGP key from stdin"}
{"level":"info","time":1769001374405,"pid":13076,"hostname":"XXX","command":"register","msg":"Parsing and validating PGP key"}
{"level":"info","time":1769001375182,"pid":13076,"hostname":"XXX","command":"register","fingerprint":"568d4df6b36fa952004c4228bc5864ef00eb2ab9","transactionHash":"0x8cf6d9fff6bb10f1beabe2cbc856aeb54d0c230cedf639d175012ebd786e2bed","blockNumber":16246348,"msg":"Key registration successful"}
```

Remember, you can then watch transaction on https://sepolia.etherscan.io/. For example, [you can see the transaction here](https://sepolia.etherscan.io/tx/0xed6acaca05eb172f011b3bbbf145c71e933596e9f82806ebf89a5b2846ea8bed)

### Add a subkey

web3pgp has been designed to make key rotation effortless and automated at scale. The best way to achieve that is use your primary key only to sign new subkeys and certify peers. Subkeys are then used for signature and data encryption purpose. It is a good practice to rotate subkeys. Here we will show how to register a new subkey. 

First, create a new subkey for your key

```bash
gpg --batch --pinentry-mode loopback --passphrase "$PASSPHRASE" --quick-add-key "$KEYFP"
```

Second, display your key to find the new subkey fingerprint (the two --with-fingeprint are needed to display the fingerprint of the subkeys). Here is an example value "9E04 A69D 5121 9CE6 2164  B9A5 7F37 B138 C4B8 4132"

```bash
gpg --list-keys --with-fingerprint --with-fingerprint $KEYFP
SK1FP='<your first subkey fp>'
SK2FP='<your second subkey fp>'
```

Example

```txt
pub   ed25519 2026-01-21 [SC] [expires: 2029-01-20]
      568D 4DF6 B36F A952 004C  4228 BC58 64EF 00EB 2AB9
uid           [ultimate] SCROLL_TEST_1
sub   cv25519 2026-01-21 [E]
      5BC1 9840 CF8E BAD3 AFF3  006A E24F 55B6 7E6E 8E20
sub   cv25519 2026-01-21 [E]
      9E04 A69D 5121 9CE6 2164  B9A5 7F37 B138 C4B8 4132
```

Third, add the new subkey using web3pgp. Because the input key can contain multiple subkey, the command requires the user to tell which subkey should be added to on-chain records Here, the second subkey will be added.

```bash
gpg --export $KEYFP | web3pgp add-subkey "$SK2FP"
```

Here is an example of the output on stdout

```json
{
  "success": true,
  "message": "Subkey added successfully",
  "subkeyFingerprint": "9E04A69D51219CE62164B9A57F37B138C4B84132",
  "transaction": {
    "hash": "0xd3a216a2084e2cc1e60f7f8eb4153e090ca00150cec016f957316af10701064e",
    "blockNumber": "16246664"
  }
}
```

And the logs on stderr

```json
{"level":"info","time":1769002722331,"pid":16332,"hostname":"XXX","command":"add-subkey","msg":"Reading key from stdin"}
{"level":"info","time":1769002722340,"pid":16332,"hostname":"XXX","command":"add-subkey","subkeyFingerprint":"9E04A69D51219CE62164B9A57F37B138C4B84132","msg":"Adding subkey to blockchain"}
```

### Revoke a key or subkey

Revoking a key happens when you retire a key or when a key has been compromised. Web3PGP allow users to use Ethereum built-in global notification system to publish revocation certificates or revoked keys.

First, let's revoke the first subkey because we have just added a new subkey.

```bash
gpg --edit-key $KEYALIAS
```

You will have to 

```bash
gpg > key 1
gpg > revkey
gpg> quit
Save changes? (y/N) y
```

Here is an example

```txt
gpg (GnuPG) 2.4.4; Copyright (C) 2024 g10 Code GmbH
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

Secret key is available.

sec  ed25519/BC5864EF00EB2AB9
     created: 2026-01-21  expires: 2029-01-20  usage: SC  
     trust: ultimate      validity: ultimate
ssb  cv25519/E24F55B67E6E8E20
     created: 2026-01-21  expires: never       usage: E   
ssb  cv25519/7F37B138C4B84132
     created: 2026-01-21  expires: never       usage: E   
[ultimate] (1). SCROLL_TEST_1

gpg> key 1

sec  ed25519/BC5864EF00EB2AB9
     created: 2026-01-21  expires: 2029-01-20  usage: SC  
     trust: ultimate      validity: ultimate
ssb* cv25519/E24F55B67E6E8E20
     created: 2026-01-21  expires: never       usage: E   
ssb  cv25519/7F37B138C4B84132
     created: 2026-01-21  expires: never       usage: E   
[ultimate] (1). SCROLL_TEST_1

gpg> revkey
Do you really want to revoke this subkey? (y/N) y
Please select the reason for the revocation:
  0 = No reason specified
  1 = Key has been compromised
  2 = Key is superseded
  3 = Key is no longer used
  Q = Cancel
Your decision? 3
Enter an optional description; end it with an empty line:
> 
Reason for revocation: Key is no longer used
(No description given)
Is this okay? (y/N) y

sec  ed25519/BC5864EF00EB2AB9
     created: 2026-01-21  expires: 2029-01-20  usage: SC  
     trust: ultimate      validity: ultimate
The following key was revoked on 2026-01-21 by ? key BC5864EF00EB2AB9 SCROLL_TEST_1
ssb  cv25519/E24F55B67E6E8E20
     created: 2026-01-21  revoked: 2026-01-21  usage: E   
ssb  cv25519/7F37B138C4B84132
     created: 2026-01-21  expires: never       usage: E   
[ultimate] (1). SCROLL_TEST_1

gpg> quit
Save changes? (y/N) y
```

Next, you need to export the revoked key. Please note the CLI also supports standalone revocation certificates. The CLI requires the user to mention which key is being revoked. Here, this is the first subkey that will be revoked.

```bash
gpg --export "$SK1FP" | web3pgp revoke "$SK1FP"
```

Here is the output on stdout

```json
{
  "success": true,
  "message": "Key revoked successfully",
  "fingerprint": "5BC1 9840 CF8E BAD3 AFF3  006A E24F 55B6 7E6E 8E20",
  "transaction": {
    "hash": "0xae00381df11086ce70332ef2155034fbe9301cfeb72efd550fd23ea583053b72",
    "blockNumber": "16249692"
  }
}
```

And the logs on stderr

```json
{"level":"info","time":1769014493592,"pid":35880,"hostname":"XXX","command":"revoke","msg":"Reading armored revocation certificate from stdin"}
{"level":"info","time":1769014494341,"pid":35880,"hostname":"XXX","command":"revoke","fingerprint":"5BC19840CF8EBAD3AFF3006AE24F55B67E6E8E20","transactionHash":"0xae00381df11086ce70332ef2155034fbe9301cfeb72efd550fd23ea583053b72","blockNumber":16249692,"msg":"Key revocation successful"}
```

### Certify a key (Web of Trust)

First, let's create and register a second key that will be used to certify the first key. In this demo, we have used the same passphrase as the first key.

```bash
gpg --quick-gen-key 'alias'
CERTKEY='<key fingerprint>'
CERTKEY_ALIAS='<alias>'
gpg --export "$CERTKEY" | web3pgp register
```

Next, sign the key to tell you have verified the identity of the key owner and certify the key as trusted by you.

```bash
gpg --batch --pinentry-mode loopback --passphrase "$PASSPHRASE" -u $CERTKEY --quick-sign-key $KEYFP
```

The output will look like this

```txt
sec  ed25519/BC5864EF00EB2AB9
     created: 2026-01-21  expires: 2029-01-20  usage: SC  
     trust: ultimate      validity: ultimate
 Primary key fingerprint: 568D 4DF6 B36F A952 004C  4228 BC58 64EF 00EB 2AB9

     SCROLL_TEST_1

This key is due to expire on 2029-01-20.
```

Finally, publish the certification on-chain. The CLI command requires the user to specify the fingerprint of the issuer of the certification (eg, CERTKEY).


```bash
gpg --export $KEYFP | web3pgp certify $CERTKEY
```

The output will look like this

```json
{
  "success": true,
  "message": "Public key certified successfully",
  "issuer": {
    "fingerprint": "0x000000000000000000000000339292aad15b1ec848da1ed147bb3d6b65672a25"
  },
  "certified": {
    "fingerprint": "568d4df6b36fa952004c4228bc5864ef00eb2ab9",
    "subkeys": [
      "5bc19840cf8ebad3aff3006ae24f55b67e6e8e20",
      "9e04a69d51219ce62164b9a57f37b138c4b84132"
    ]
  },
  "transaction": {
    "hash": "0x4bcc29e47501ff63bbe58bb63b301ec62010ffc378d31d9a7f3ef627b7c588ea",
    "blockNumber": "16250082"
  }
}
```

The logs

```json
{"level":"info","time":1769015187456,"pid":37514,"hostname":"XXX","command":"certify","issuerFp":"0x000000000000000000000000339292aad15b1ec848da1ed147bb3d6b65672a25","msg":"Fetching issuer public key"}
{"level":"info","time":1769015187457,"pid":37514,"hostname":"XXX","command":"certify","msg":"Reading PGP key to certify from stdin"}
{"level":"info","time":1769015187460,"pid":37514,"hostname":"XXX","command":"certify","msg":"Parsing and validating PGP key to certify"}
{"level":"info","time":1769015188375,"pid":37514,"hostname":"XXX","command":"certify","issuerFingerprint":"339292aad15b1ec848da1ed147bb3d6b65672a25","certifiedFingerprint":"568d4df6b36fa952004c4228bc5864ef00eb2ab9","transactionHash":"0x4bcc29e47501ff63bbe58bb63b301ec62010ffc378d31d9a7f3ef627b7c588ea","blockNumber":16250082,"msg":"Key certification successful"}
```

### Revoke a key certification

First, you need to revoke your certification locally

```bash
gpg --batch --pinentry-mode loopback --passphrase "$PASSPHRASE" -u $CERTKEY --quick-revoke-sig $KEYFP $CERTKEY
```

Second, you need to publish the certification revocation on-chain. The CLI command needs the user to tell which key has issued the certification revocation.

```bash
gpg --export $KEYFP | web3pgp revoke-certification $CERTKEY
```

Here is the output

```json
{
  "success": true,
  "message": "Certification revoked successfully",
  "issuer": {
    "fingerprint": "0x000000000000000000000000339292aad15b1ec848da1ed147bb3d6b65672a25"
  },
  "certified": {
    "fingerprint": "568d4df6b36fa952004c4228bc5864ef00eb2ab9",
    "subkeys": [
      "5bc19840cf8ebad3aff3006ae24f55b67e6e8e20",
      "9e04a69d51219ce62164b9a57f37b138c4b84132"
    ]
  },
  "transaction": {
    "hash": "0x9eadec1a5539285c9392c7e703f03d8ee0ec72ffbfc69fba21ac55ec627adb63",
    "blockNumber": "16250239"
  }
}
```

The logs

```json
{"level":"info","time":1769015762883,"pid":39833,"hostname":"XXX","command":"revoke-certification","issuerFp":"0x000000000000000000000000339292aad15b1ec848da1ed147bb3d6b65672a25","msg":"Fetching issuer public key"}
{"level":"info","time":1769015762883,"pid":39833,"hostname":"XXX","command":"revoke-certification","msg":"Reading PGP key to revoke certification from stdin"}
{"level":"info","time":1769015762887,"pid":39833,"hostname":"XXX","command":"revoke-certification","msg":"Parsing and validating PGP key"}
{"level":"info","time":1769015763782,"pid":39833,"hostname":"XXX","command":"revoke-certification","issuerFingerprint":"339292aad15b1ec848da1ed147bb3d6b65672a25","certifiedFingerprint":"568d4df6b36fa952004c4228bc5864ef00eb2ab9","transactionHash":"0x9eadec1a5539285c9392c7e703f03d8ee0ec72ffbfc69fba21ac55ec627adb63","blockNumber":16250239,"msg":"Certification revocation successful"}
```

### Fetch a public key by fingerprint

Web3pgp offers a streamlined get command to download, consolidate, and verify a public key using its fingerprint. The retrieved key includes the entire history—from creation to the latest update—along with all associated subkeys. Additionally, if you provide a subkey fingerprint, the CLI automatically resolves it to the parent key and returns the complete key bundle.

```bash
web3pgp get "$SK2FP"
```

The output on stdout (armored format)

```txt
-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEaXDQ8xYJKwYBBAHaRw8BAQdAO2Yo7vcMAbGI3WTVHy/VoVW0oRa2kkdg
uYYdJcL6cSrNDVNDUk9MTF9URVNUXzHCeAQwFgoAIBYhBDOSkqrRWx7ISNoe
0Ue7PWtlZyolBQJpcQlXAh0AAAoJEEe7PWtlZyolOAgBAJX9FWpku0iwzdb2
0WkLXFy1bT2FbQRjUeq0w0+AmLDnAQDysKZLdFv6w3QKtFS9KAeQnTET+TxD
KnXyWaif/OW7DMKZBBMWCgBBFiEEVo1N9rNvqVIATEIovFhk7wDrKrkFAmlw
0PMCGwMFCQWjmoAFCwkIBwICIgIGFQoJCAsCBBYCAwECHgcCF4AACgkQvFhk
7wDrKrmWpQEAtuhE7UlTt3GUgJ4ESAQfFCrtxYsCARLUA1wHyJgvVh8BAKdk
o9cgixLIXgzHd+qbt/1HwZ9AzYqUqIYr8k9sHZgBwnUEEBYKAB0WIQQzkpKq
0VseyEjaHtFHuz1rZWcqJQUCaXEHcgAKCRBHuz1rZWcqJcoMAQDY/vd/TSrJ
XhsD5H1ox35muaqqk9L0Qk7xSmvCqKr9WgD9GqSjNRltW4foL942jM5V5BKb
KEF27rhrn7ZIPAqAIgXOOARpcNDzEgorBgEEAZdVAQUBAQdAGxMb+uH5avwa
sveCSTgfq1343MuhhcUe/WC4kZbU5UUDAQgHwngEKBYKACAWIQRWjU32s2+p
UgBMQii8WGTvAOsquQUCaXED2gIdAwAKCRC8WGTvAOsqufcqAP9muqMT4tIQ
aCtIXZPFbkJ1wPAYPw8y/KOoAwninJkk4gEA7iztZv3dp7RDBEQJCrAFSxYs
2vBpkYjWv/dg/3uC3QXCeAQYFgoAIBYhBFaNTfazb6lSAExCKLxYZO8A6yq5
BQJpcNDzAhsMAAoJELxYZO8A6yq5KtMA/RlUbkfjDg8VKgJwG1REN9u+ZLuM
K0mvR7pu9PJ2u1b7AQDe9hbDhEQGFh3puPs+GlRMsN0cb5nlLRZXHxjC0ulL
AM44BGlw1fASCisGAQQBl1UBBQEBB0DIgNaQp76GvAxQjThT7vw1Fre0wstM
gYU98DCty4cIXwMBCAfCeAQYFgoAIBYhBFaNTfazb6lSAExCKLxYZO8A6yq5
BQJpcNXwAhsMAAoJELxYZO8A6yq5VLcA/3hKFlfyD6i/m5VIn+y995UEfDu4
Q8XlFdk5MlUWqbOiAP9k+0oDQLwBOPdWyvcFPGpGw0xKtzfPe0Ayq3+GWGqt
DA==
=cLCu
-----END PGP PUBLIC KEY BLOCK-----
```

The logs on stderr

```json
{"level":"info","time":1769016149456,"pid":40236,"hostname":"XXX","command":"get","fingerprint":"9E04A69D51219CE62164B9A57F37B138C4B84132","msg":"Retrieving public key"}
{"level":"info","time":1769016149918,"pid":40236,"hostname":"XXX","command":"get","fingerprint":"9E04A69D51219CE62164B9A57F37B138C4B84132","msg":"Key retrieved"}
```

You can import or inspect the public key like this:

```bash
web3pgp get "$SK2FP" | gpg --list-packets
```

You will be able to verify that the downloaded public key contains the primary key, the User ID packet, the certification and its revocation (from the certification key), and two subkeys—the first of which is revoked.

```txt
# off=0 ctb=c6 tag=6 hlen=2 plen=51 new-ctb
:public key packet:
        version 4, algo 22, created 1769001203, expires 0
        pkey[0]: [80 bits] ed25519 (1.3.6.1.4.1.11591.15.1)
        pkey[1]: [263 bits]
        keyid: BC5864EF00EB2AB9
# off=53 ctb=cd tag=13 hlen=2 plen=13 new-ctb
:user ID packet: "SCROLL_TEST_1"
# off=68 ctb=c2 tag=2 hlen=2 plen=120 new-ctb
:signature packet: algo 22, keyid 47BB3D6B65672A25
        version 4, created 1769015639, md5len 0, sigclass 0x30
        digest algo 10, begin of digest 38 08
        hashed subpkt 33 len 21 (issuer fpr v4 339292AAD15B1EC848DA1ED147BB3D6B65672A25)
        hashed subpkt 2 len 4 (sig created 2026-01-21)
        hashed subpkt 29 len 1 (revocation reason 0x00 ())
        subpkt 16 len 8 (issuer key ID 47BB3D6B65672A25)
        data: [256 bits]
        data: [256 bits]
# off=190 ctb=c2 tag=2 hlen=2 plen=153 new-ctb
:signature packet: algo 22, keyid BC5864EF00EB2AB9
        version 4, created 1769001203, md5len 0, sigclass 0x13
        digest algo 10, begin of digest 96 a5
        hashed subpkt 33 len 21 (issuer fpr v4 568D4DF6B36FA952004C4228BC5864EF00EB2AB9)
        hashed subpkt 2 len 4 (sig created 2026-01-21)
        hashed subpkt 27 len 1 (key flags: 03)
        hashed subpkt 9 len 4 (key expires after 3y0d0h0m)
        hashed subpkt 11 len 4 (pref-sym-algos: 9 8 7 2)
        hashed subpkt 34 len 1 (pref-aead-algos: 2)
        hashed subpkt 21 len 5 (pref-hash-algos: 10 9 8 11 2)
        hashed subpkt 22 len 3 (pref-zip-algos: 2 3 1)
        hashed subpkt 30 len 1 (features: 07)
        hashed subpkt 23 len 1 (keyserver preferences: 80)
        subpkt 16 len 8 (issuer key ID BC5864EF00EB2AB9)
        data: [256 bits]
        data: [256 bits]
# off=345 ctb=c2 tag=2 hlen=2 plen=117 new-ctb
:signature packet: algo 22, keyid 47BB3D6B65672A25
        version 4, created 1769015154, md5len 0, sigclass 0x10
        digest algo 10, begin of digest ca 0c
        hashed subpkt 33 len 21 (issuer fpr v4 339292AAD15B1EC848DA1ED147BB3D6B65672A25)
        hashed subpkt 2 len 4 (sig created 2026-01-21)
        subpkt 16 len 8 (issuer key ID 47BB3D6B65672A25)
        data: [256 bits]
        data: [253 bits]
# off=464 ctb=ce tag=14 hlen=2 plen=56 new-ctb
:public sub key packet:
        version 4, algo 18, created 1769001203, expires 0
        pkey[0]: [88 bits] cv25519 (1.3.6.1.4.1.3029.1.5.1)
        pkey[1]: [263 bits]
        pkey[2]: [32 bits]
        keyid: E24F55B67E6E8E20
# off=522 ctb=c2 tag=2 hlen=2 plen=120 new-ctb
:signature packet: algo 22, keyid BC5864EF00EB2AB9
        version 4, created 1769014234, md5len 0, sigclass 0x28
        digest algo 10, begin of digest f7 2a
        hashed subpkt 33 len 21 (issuer fpr v4 568D4DF6B36FA952004C4228BC5864EF00EB2AB9)
        hashed subpkt 2 len 4 (sig created 2026-01-21)
        hashed subpkt 29 len 1 (revocation reason 0x03 ())
        subpkt 16 len 8 (issuer key ID BC5864EF00EB2AB9)
        data: [255 bits]
        data: [256 bits]
# off=644 ctb=c2 tag=2 hlen=2 plen=120 new-ctb
:signature packet: algo 22, keyid BC5864EF00EB2AB9
        version 4, created 1769001203, md5len 0, sigclass 0x18
        digest algo 10, begin of digest 2a d3
        hashed subpkt 33 len 21 (issuer fpr v4 568D4DF6B36FA952004C4228BC5864EF00EB2AB9)
        hashed subpkt 2 len 4 (sig created 2026-01-21)
        hashed subpkt 27 len 1 (key flags: 0C)
        subpkt 16 len 8 (issuer key ID BC5864EF00EB2AB9)
        data: [253 bits]
        data: [256 bits]
# off=766 ctb=ce tag=14 hlen=2 plen=56 new-ctb
:public sub key packet:
        version 4, algo 18, created 1769002480, expires 0
        pkey[0]: [88 bits] cv25519 (1.3.6.1.4.1.3029.1.5.1)
        pkey[1]: [263 bits]
        pkey[2]: [32 bits]
        keyid: 7F37B138C4B84132
# off=824 ctb=c2 tag=2 hlen=2 plen=120 new-ctb
:signature packet: algo 22, keyid BC5864EF00EB2AB9
        version 4, created 1769002480, md5len 0, sigclass 0x18
        digest algo 10, begin of digest 54 b7
        hashed subpkt 33 len 21 (issuer fpr v4 568D4DF6B36FA952004C4228BC5864EF00EB2AB9)
        hashed subpkt 2 len 4 (sig created 2026-01-21)
        hashed subpkt 27 len 1 (key flags: 0C)
        subpkt 16 len 8 (issuer key ID BC5864EF00EB2AB9)
        data: [255 bits]
        data: [255 bits]
```