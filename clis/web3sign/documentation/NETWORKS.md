# Network configuration

## Production network

TODO: Scroll will be used as production environment. This guide will be updated with key information post go-live. 

## Testing network

This section contains key information about the testing network which can be used to test our product.

### Prerequisites

- Generate and have an Ethereum private key
- Option: Have a wallet you can use in your web browser

### Get testnet ETH

For a no-registration method, we recommand using the POW faucet with a wallet like METAMASK to get testnet ETH on Ethereum Sepolia (https://sepolia-faucet.pk910.de/).

### Sepolia testnet

Beware Sepolia has a block rate of one block every 12 seconds. This means transactions will take at minimum this time to settle. Production environment has a block rate of one block every two seconds. 

| Key | Value |
| --- | --- |
| Network ID | 11155111 |
| RPC | https://ethereum-sepolia-rpc.publicnode.com ; https://sepolia.gateway.tenderly.co ; https://sepolia.drpc.org ;  https://1rpc.io/sepolia |
| Explorer | https://sepolia.etherscan.io/ |
| Access Manager | 0x435F71f804fa6B1E4F5FB4ed32328B52EcEf8452 |
| Web3PGP | 0x82733B49e65A2FE6B611e5CE454AC21237071638 |
| Web3Sign | 0x6f81441691340Bcf41b7eC323b6E74645820389E |
| Admin - Multsig | 0xc8AF5C5C48Cba75B9D3BD61fF6541db42fE9E201 | 