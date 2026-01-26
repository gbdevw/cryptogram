# WEB3PGP: sync command usage guide

The sync command synchronizes local keyrings and key servers with blockchain data. It scans the blockchain for Web3PGP events (Key Registration, Subkey Addition, Revocations, etc.) and streams the corresponding OpenPGP data.

## How it works

The CLI operates as a stream processor:
- STDOUT (Standard Output): Emits valid, armored OpenPGP certificates ready for import.
- STDERR (Standard Error): Emits structured JSON logs for telemetry and debugging.

This separation allows SysAdmins and DevOps engineers to use the CLI as a "sidecar" process, piping the data stream directly into keyrings (GPG) or key servers, effectively turning the blockchain into a realtime Global PKI.

## Usage

```bash
web3pgp sync [options]
```

### Options

* --from <BLOCK_NUMBER>: The starting block number for the synchronization (required).
* --to <BLOCK_NUMBER>: The ending block number. If omitted, the command runs in watch mode, continuously listening for new blocks.
* --interval <SECONDS>: Polling interval when waiting for new blocks (default: 15s).

### Behavior & Notes

* Catch-up Mode: When starting from an old block, the CLI uses the configured maxBlockRange to fetch events as fast as possible until it reaches the chain tip.
* Watch Mode: Once synchronized with the tip of the chain, if no --to is defined, it polls for new blocks every --interval seconds.
* Graceful Shutdown: The CLI handles SIGINT (CTRL+C) to stop cleanly.

### Examples

Start syncing from the contract deployment block, save logs to a file and display OpenPGP messages in the terminal.

```bash
web3pgp sync --from 16246348 2> sync.log
```

Output example

```txt
-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEaXDQ8xYJKwYBBAHaRw8BAQdAO2Yo7vcMAbGI3WTVHy/VoVW0oRa2kkdg
uYYdJcL6cSrNDVNDUk9MTF9URVNUXzHCmQQTFgoAQRYhBFaNTfazb6lSAExC
KLxYZO8A6yq5BQJpcNDzAhsDBQkFo5qABQsJCAcCAiICBhUKCQgLAgQWAgMB
Ah4HAheAAAoJELxYZO8A6yq5lqUBALboRO1JU7dxlICeBEgEHxQq7cWLAgES
1ANcB8iYL1YfAQCnZKPXIIsSyF4Mx3fqm7f9R8GfQM2KlKiGK/JPbB2YAc44
BGlw0PMSCisGAQQBl1UBBQEBB0AbExv64flq/Bqy94JJOB+rXfjcy6GFxR79
YLiRltTlRQMBCAfCeAQYFgoAIBYhBFaNTfazb6lSAExCKLxYZO8A6yq5BQJp
cNDzAhsMAAoJELxYZO8A6yq5KtMA/RlUbkfjDg8VKgJwG1REN9u+ZLuMK0mv
R7pu9PJ2u1b7AQDe9hbDhEQGFh3puPs+GlRMsN0cb5nlLRZXHxjC0ulLAA==
=SNvt
-----END PGP PUBLIC KEY BLOCK-----

-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEaXDQ8xYJKwYBBAHaRw8BAQdAO2Yo7vcMAbGI3WTVHy/VoVW0oRa2kkdg
uYYdJcL6cSrNDVNDUk9MTF9URVNUXzHCmQQTFgoAQRYhBFaNTfazb6lSAExC
KLxYZO8A6yq5BQJpcNDzAhsDBQkFo5qABQsJCAcCAiICBhUKCQgLAgQWAgMB
Ah4HAheAAAoJELxYZO8A6yq5lqUBALboRO1JU7dxlICeBEgEHxQq7cWLAgES
1ANcB8iYL1YfAQCnZKPXIIsSyF4Mx3fqm7f9R8GfQM2KlKiGK/JPbB2YAc44
BGlw1fASCisGAQQBl1UBBQEBB0DIgNaQp76GvAxQjThT7vw1Fre0wstMgYU9
8DCty4cIXwMBCAfCeAQYFgoAIBYhBFaNTfazb6lSAExCKLxYZO8A6yq5BQJp
cNXwAhsMAAoJELxYZO8A6yq5VLcA/3hKFlfyD6i/m5VIn+y995UEfDu4Q8Xl
Fdk5MlUWqbOiAP9k+0oDQLwBOPdWyvcFPGpGw0xKtzfPe0Ayq3+GWGqtDA==
=pfBN
-----END PGP PUBLIC KEY BLOCK-----

-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEaXDQ8xYJKwYBBAHaRw8BAQdAO2Yo7vcMAbGI3WTVHy/VoVW0oRa2kkdg
uYYdJcL6cSrNDVNDUk9MTF9URVNUXzHCmQQTFgoAQRYhBFaNTfazb6lSAExC
KLxYZO8A6yq5BQJpcNDzAhsDBQkFo5qABQsJCAcCAiICBhUKCQgLAgQWAgMB
Ah4HAheAAAoJELxYZO8A6yq5lqUBALboRO1JU7dxlICeBEgEHxQq7cWLAgES
1ANcB8iYL1YfAQCnZKPXIIsSyF4Mx3fqm7f9R8GfQM2KlKiGK/JPbB2YAc44
BGlw0PMSCisGAQQBl1UBBQEBB0AbExv64flq/Bqy94JJOB+rXfjcy6GFxR79
YLiRltTlRQMBCAfCeAQoFgoAIBYhBFaNTfazb6lSAExCKLxYZO8A6yq5BQJp
cQPaAh0DAAoJELxYZO8A6yq59yoA/2a6oxPi0hBoK0hdk8VuQnXA8Bg/DzL8
o6gDCeKcmSTiAQDuLO1m/d2ntEMERAkKsAVLFiza8GmRiNa/92D/e4LdBcJ4
BBgWCgAgFiEEVo1N9rNvqVIATEIovFhk7wDrKrkFAmlw0PMCGwwACgkQvFhk
7wDrKrkq0wD9GVRuR+MODxUqAnAbVEQ3275ku4wrSa9Hum708na7VvsBAN72
FsOERAYWHem4+z4aVEyw3RxvmeUtFlcfGMLS6UsA
=eyZM
-----END PGP PUBLIC KEY BLOCK-----

-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEaXEFyRYJKwYBBAHaRw8BAQdACVN3PfDYXG1NYvKo2Dw8klERIeiXFCdP
VrGU893tFlbNElNDUk9MTF8xX1RFU1RfQ0VSVMKZBBMWCgBBFiEEM5KSqtFb
HshI2h7RR7s9a2VnKiUFAmlxBckCGwMFCQWjmoAFCwkIBwICIgIGFQoJCAsC
BBYCAwECHgcCF4AACgkQR7s9a2VnKiVmVgEA8NMwz6o0NdSaqoYsXVUOynlL
h5MeE/+cwG14ppDgOuEA/RlS5752M+UaQLBFjfqKSkoaHIeGgVY/zL8Ru659
gkEPzjgEaXEFyRIKKwYBBAGXVQEFAQEHQO2icN8PvcDmDYNVoC7D3wfBTXdJ
dZ4ANXJl70VMm4V0AwEIB8J4BBgWCgAgFiEEM5KSqtFbHshI2h7RR7s9a2Vn
KiUFAmlxBckCGwwACgkQR7s9a2VnKiVJZQEAkc5Tfeeuo6i7u89kHHdkjUUr
Nn6owX9VxwRzkkeG+TEA/jLXBqZYr5pr4lrB1oYvi+KqG7xveMNqWrjGIsWS
jooF
=VAV6
-----END PGP PUBLIC KEY BLOCK-----

-----BEGIN PGP PUBLIC KEY BLOCK-----

xjMEaXDQ8xYJKwYBBAHaRw8BAQdAO2Yo7vcMAbGI3WTVHy/VoVW0oRa2kkdg
uYYdJcL6cSrNDVNDUk9MTF9URVNUXzHCmQQTFgoAQRYhBFaNTfazb6lSAExC
KLxYZO8A6yq5BQJpcNDzAhsDBQkFo5qABQsJCAcCAiICBhUKCQgLAgQWAgMB
Ah4HAheAAAoJELxYZO8A6yq5lqUBALboRO1JU7dxlICeBEgEHxQq7cWLAgES
1ANcB8iYL1YfAQCnZKPXIIsSyF4Mx3fqm7f9R8GfQM2KlKiGK/JPbB2YAcJ1
BBAWCgAdFiEEM5KSqtFbHshI2h7RR7s9a2VnKiUFAmlxB3IACgkQR7s9a2Vn
KiXKDAEA2P73f00qyV4bA+R9aMd+ZrmqqpPS9EJO8Uprwqiq/VoA/RqkozUZ
bVuH6C/eNozOVeQSmyhBdu64a5+2SDwKgCIF
=VjeE
-----END PGP PUBLIC KEY BLOCK-----

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
KEF27rhrn7ZIPAqAIgU=
=Yl3T
-----END PGP PUBLIC KEY BLOCK-----
```

Logs examples

```json
{"level":"info","time":1769185304641,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","fromBlock":16246348,"toBlock":16256347,"msg":"Fetching events from blockchain from block 16246348 to 16256347"}
{"level":"info","time":1769185304808,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","block":16246348,"tx":"0x8cf6d9fff6bb10f1beabe2cbc856aeb54d0c230cedf639d175012ebd786e2bed","primaryKeyFingerprint":"0x000000000000000000000000568d4df6b36fa952004c4228bc5864ef00eb2ab9","msg":"Processing KeyRegistered event"}
{"level":"info","time":1769185304816,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","block":16246664,"tx":"0xd3a216a2084e2cc1e60f7f8eb4153e090ca00150cec016f957316af10701064e","primaryKeyFingerprint":"0x000000000000000000000000568d4df6b36fa952004c4228bc5864ef00eb2ab9","subkeyFingerprint":"0x0000000000000000000000009e04a69d51219ce62164b9a57f37b138c4b84132","msg":"Processing SubkeyAdded event"}
{"level":"info","time":1769185304818,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","block":16249692,"tx":"0xae00381df11086ce70332ef2155034fbe9301cfeb72efd550fd23ea583053b72","fingerprint":"0x0000000000000000000000005bc19840cf8ebad3aff3006ae24f55b67e6e8e20","msg":"Processing KeyRevoked event"}
{"level":"info","time":1769185304819,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","block":16249901,"tx":"0xeec9b6237498870dc8cd9991fea2723c7318285913fbb7e994e285ed4a74aa8b","primaryKeyFingerprint":"0x000000000000000000000000339292aad15b1ec848da1ed147bb3d6b65672a25","msg":"Processing KeyRegistered event"}
{"level":"info","time":1769185304821,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","block":16250082,"tx":"0x4bcc29e47501ff63bbe58bb63b301ec62010ffc378d31d9a7f3ef627b7c588ea","issuerFingerprint":"0x000000000000000000000000339292aad15b1ec848da1ed147bb3d6b65672a25","subjectFingerprint":"0x000000000000000000000000568d4df6b36fa952004c4228bc5864ef00eb2ab9","msg":"Processing KeyCertified event"}
{"level":"info","time":1769185304823,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","block":16250239,"tx":"0x9eadec1a5539285c9392c7e703f03d8ee0ec72ffbfc69fba21ac55ec627adb63","issuerFingerprint":"0x000000000000000000000000339292aad15b1ec848da1ed147bb3d6b65672a25","subjectFingerprint":"0x000000000000000000000000568d4df6b36fa952004c4228bc5864ef00eb2ab9","msg":"Processing KeyCertificationRevoked event"}
{"level":"info","time":1769185319935,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","fromBlock":16256348,"toBlock":16266347,"msg":"Fetching events from blockchain from block 16256348 to 16266347"}
{"level":"info","time":1769185335201,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","fromBlock":16266348,"toBlock":16276347,"msg":"Fetching events from blockchain from block 16266348 to 16276347"}
{"level":"info","time":1769185350553,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","fromBlock":16276348,"toBlock":16286347,"msg":"Fetching events from blockchain from block 16276348 to 16286347"}
{"level":"info","time":1769185365869,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","fromBlock":16286348,"toBlock":16290092,"msg":"Fetching events from blockchain from block 16286348 to 16290092"}
{"level":"info","time":1769185381093,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","fromBlock":16290093,"toBlock":16290097,"msg":"Fetching events from blockchain from block 16290093 to 16290097"}
{"level":"info","time":1769185396447,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","fromBlock":16290098,"toBlock":16290100,"msg":"Fetching events from blockchain from block 16290098 to 16290100"}
{"level":"info","time":1769185401594,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","msg":"Received SIGINT - initiating graceful shutdown"}
{"level":"info","time":1769185411688,"pid":18315,"hostname":"gbdevw-Inspiron-16-5635","command":"sync","msg":"Event synchronization completed - exiting gracefully"}
```