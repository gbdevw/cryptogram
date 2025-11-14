import { spawn, ChildProcess } from 'child_process';
import { createPublicClient, createWalletClient, http, publicActions, Address, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration for Anvil instance
 */
export interface AnvilConfig {
    port?: number;
    blockTime?: number;
    accounts?: number;
    balance?: bigint;
}

/**
 * Deployed contract information
 */
export interface DeployedContract {
    address: Address;
    deploymentBlock: bigint;
}

/**
 * Helper class to manage Anvil blockchain for integration tests
 */
export class AnvilHelper {
    private anvilProcess: ChildProcess | null = null;
    private port: number;
    private blockTime: number;
    private accountsCount: number;
    private initialBalance: bigint;
    private ready: boolean = false;

    // Anvil default accounts (deterministic)
    public readonly accounts = [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`, // Account 0
        '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as `0x${string}`, // Account 1
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as `0x${string}`, // Account 2
        '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as `0x${string}`, // Account 3
        '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' as `0x${string}`, // Account 4
    ].map(pk => privateKeyToAccount(pk));

    constructor(config: AnvilConfig = {}) {
        this.port = config.port ?? 8545;
        this.blockTime = config.blockTime ?? 1;
        this.accountsCount = config.accounts ?? 5;
        this.initialBalance = config.balance ?? BigInt(1000) * BigInt(10 ** 18); // 1000 ETH (was 10000)
    }

    /**
     * Start Anvil blockchain
     */
    async start(): Promise<void> {
        if (this.anvilProcess) {
            throw new Error('Anvil is already running');
        }

        return new Promise((resolve, reject) => {
            const args = [
                '--port', this.port.toString(),
                '--block-time', this.blockTime.toString(),
                '--accounts', this.accountsCount.toString(),
                '--chain-id', '31337',
                // Don't set balance - use Anvil's default (10000 ETH)
            ];

            this.anvilProcess = spawn('anvil', args);

            if (!this.anvilProcess.stdout || !this.anvilProcess.stderr) {
                reject(new Error('Failed to spawn Anvil process'));
                return;
            }

            // Listen for ready signal
            this.anvilProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                if (output.includes('Listening on')) {
                    this.ready = true;
                    // Give it a moment to be fully ready
                    setTimeout(() => resolve(), 500);
                }
            });

            this.anvilProcess.stderr.on('data', (data: Buffer) => {
                console.error('Anvil stderr:', data.toString());
            });

            this.anvilProcess.on('error', (error) => {
                reject(new Error(`Failed to start Anvil: ${error.message}`));
            });

            this.anvilProcess.on('exit', (code) => {
                if (!this.ready && code !== 0) {
                    reject(new Error(`Anvil exited with code ${code}`));
                }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.ready) {
                    this.stop();
                    reject(new Error('Anvil failed to start within 10 seconds'));
                }
            }, 10000);
        });
    }

    /**
     * Stop Anvil blockchain
     */
    stop(): void {
        if (this.anvilProcess) {
            this.anvilProcess.kill('SIGTERM');
            this.anvilProcess = null;
            this.ready = false;
        }
    }

    /**
     * Get RPC URL for the running Anvil instance
     */
    getRpcUrl(): string {
        return `http://127.0.0.1:${this.port}`;
    }

    /**
     * Create a public client for the Anvil instance
     */
    getPublicClient() {
        return createPublicClient({
            chain: foundry,
            transport: http(this.getRpcUrl()),
        });
    }

    /**
     * Create a wallet client for the Anvil instance
     */
    getWalletClient(accountIndex: number = 0) {
        if (accountIndex >= this.accounts.length) {
            throw new Error(`Account index ${accountIndex} out of range`);
        }

        return createWalletClient({
            account: this.accounts[accountIndex],
            chain: foundry,
            transport: http(this.getRpcUrl()),
        }).extend(publicActions);
    }

    /**
     * Deploy a contract using forge script
     */
    async deployContracts(): Promise<{
        web3pgp: DeployedContract;
        flatFee: DeployedContract;
        accessManager: DeployedContract;
    }> {
        const contractsPath = path.resolve(__dirname, '../../../../contracts');
        
        // Use forge script to deploy contracts
        return new Promise((resolve, reject) => {
            const deployScript = spawn('forge', [
                'script',
                'script/Deploy.s.sol',
                '--rpc-url', this.getRpcUrl(),
                '--private-key', this.accounts[0]!.source,
                '--broadcast',
                '--json',
            ], {
                cwd: contractsPath,
            });

            let output = '';
            let errorOutput = '';

            if (deployScript.stdout) {
                deployScript.stdout.on('data', (data: Buffer) => {
                    output += data.toString();
                });
            }

            if (deployScript.stderr) {
                deployScript.stderr.on('data', (data: Buffer) => {
                    errorOutput += data.toString();
                });
            }

            deployScript.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Deployment failed with code ${code}:\n${errorOutput}`));
                    return;
                }

                try {
                    // Parse deployment output to get contract addresses
                    // This is a simplified version - you may need to adjust based on actual output
                    const broadcastPath = path.join(
                        contractsPath,
                        'broadcast',
                        'Deploy.s.sol',
                        '31337', // Anvil chain ID
                        'run-latest.json'
                    );

                    if (!fs.existsSync(broadcastPath)) {
                        // Fallback: use deterministic addresses or environment variables
                        // For now, we'll reject and ask for manual deployment
                        reject(new Error('Deployment broadcast file not found. Please deploy contracts manually first.'));
                        return;
                    }

                    const broadcast = JSON.parse(fs.readFileSync(broadcastPath, 'utf-8'));
                    
                    // Extract contract addresses from broadcast
                    // This needs to be adjusted based on your actual deployment script
                    const web3pgpAddress = broadcast.transactions?.find((tx: any) => 
                        tx.contractName === 'Web3PGP'
                    )?.contractAddress;

                    const flatFeeAddress = broadcast.transactions?.find((tx: any) => 
                        tx.contractName === 'FlatFee'
                    )?.contractAddress;

                    const accessManagerAddress = broadcast.transactions?.find((tx: any) => 
                        tx.contractName === 'AccessManager'
                    )?.contractAddress;

                    if (!web3pgpAddress || !flatFeeAddress || !accessManagerAddress) {
                        reject(new Error('Failed to parse contract addresses from deployment'));
                        return;
                    }

                    resolve({
                        web3pgp: {
                            address: web3pgpAddress as Address,
                            deploymentBlock: BigInt(0),
                        },
                        flatFee: {
                            address: flatFeeAddress as Address,
                            deploymentBlock: BigInt(0),
                        },
                        accessManager: {
                            address: accessManagerAddress as Address,
                            deploymentBlock: BigInt(0),
                        },
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse deployment output: ${error}`));
                }
            });
        });
    }

    /**
     * Deploy Web3PGP contract with proper setup (AccessManager + UUPS Proxy)
     * This follows the pattern from Web3PGP.t.sol tests
     */
    async deployWeb3PGP(initialFee: bigint = 0n): Promise<{
        web3pgp: Address;
        implementation: Address;
        proxy: Address;
        accessManager: Address;
    }> {
        const client = this.getWalletClient(0);
        
        if (!client.account) {
            throw new Error('Wallet client does not have an account');
        }

        const admin = client.account.address;
        
        // Read ABIs and bytecode from contracts/out directory
        const contractsOutPath = path.resolve(__dirname, '../../../../contracts/out');
        
        console.log('Loading contract artifacts...');
        
        // Load AccessManager
        const accessManagerArtifact = JSON.parse(
            fs.readFileSync(path.join(contractsOutPath, 'AccessManager.sol/AccessManager.json'), 'utf-8')
        );

        // Load Web3PGP implementation
        const web3pgpArtifact = JSON.parse(
            fs.readFileSync(path.join(contractsOutPath, 'Web3PGP.sol/Web3PGP.json'), 'utf-8')
        );

        // Load ERC1967Proxy
        const proxyArtifact = JSON.parse(
            fs.readFileSync(path.join(contractsOutPath, 'ERC1967Proxy.sol/ERC1967Proxy.json'), 'utf-8')
        );

        console.log('1. Deploying AccessManager...');
        // 1. Deploy AccessManager with admin as initial admin
        const accessManagerHash = await client.deployContract({
            abi: accessManagerArtifact.abi,
            bytecode: accessManagerArtifact.bytecode.object as `0x${string}`,
            account: client.account,
            args: [admin], // initialAdmin
        });

        const accessManagerReceipt = await client.waitForTransactionReceipt({ hash: accessManagerHash });
        if (!accessManagerReceipt.contractAddress) {
            throw new Error('AccessManager deployment failed');
        }
        const accessManagerAddress = accessManagerReceipt.contractAddress;
        console.log('   ✓ AccessManager deployed at:', accessManagerAddress);

        console.log('2. Deploying Web3PGP implementation...');
        // 2. Deploy Web3PGP implementation
        const implementationHash = await client.deployContract({
            abi: web3pgpArtifact.abi,
            bytecode: web3pgpArtifact.bytecode.object as `0x${string}`,
            account: client.account,
            args: [],
        });

        const implementationReceipt = await client.waitForTransactionReceipt({ hash: implementationHash });
        if (!implementationReceipt.contractAddress) {
            throw new Error('Web3PGP implementation deployment failed');
        }
        const implementationAddress = implementationReceipt.contractAddress;
        console.log('   ✓ Implementation deployed at:', implementationAddress);

        console.log('3. Deploying ERC1967Proxy with initialization...');
        // 3. Prepare initialization data
        // initialize(uint256 fee, address manager)
        const initData = encodeFunctionData({
            abi: web3pgpArtifact.abi,
            functionName: 'initialize',
            args: [initialFee, accessManagerAddress],
        });

        // 4. Deploy proxy with initialization
        const proxyHash = await client.deployContract({
            abi: proxyArtifact.abi,
            bytecode: proxyArtifact.bytecode.object as `0x${string}`,
            account: client.account,
            args: [implementationAddress, initData],
        });

        const proxyReceipt = await client.waitForTransactionReceipt({ hash: proxyHash });
        if (!proxyReceipt.contractAddress) {
            throw new Error('ERC1967Proxy deployment failed');
        }
        const proxyAddress = proxyReceipt.contractAddress;
        console.log('   ✓ Proxy deployed at:', proxyAddress);
        console.log('   ✓ Web3PGP initialized with fee:', initialFee.toString(), 'wei');

        console.log('4. Web3PGP deployment complete!');
        console.log('   Use proxy address for all interactions:', proxyAddress);

        return {
            web3pgp: proxyAddress, // This is the address to use for SDK
            implementation: implementationAddress,
            proxy: proxyAddress,
            accessManager: accessManagerAddress,
        };
    }

    /**
     * Simple deployment using Viem directly (alternative to forge script)
     * This deploys contracts with minimal setup for testing purposes
     * @deprecated Use deployWeb3PGP instead for proper UUPS setup
     */
    async deployContractsSimple(): Promise<{
        web3pgp: Address;
        flatFee: Address;
    }> {
        const client = this.getWalletClient(0);
        
        if (!client.account) {
            throw new Error('Wallet client does not have an account');
        }
        
        // Read ABIs and bytecode from contracts/out directory
        const contractsOutPath = path.resolve(__dirname, '../../../../contracts/out');
        
        // Load Web3PGP contract
        const web3pgpArtifact = JSON.parse(
            fs.readFileSync(path.join(contractsOutPath, 'Web3PGP.sol/Web3PGP.json'), 'utf-8')
        );

        const flatFeeArtifact = JSON.parse(
            fs.readFileSync(path.join(contractsOutPath, 'FlatFee.sol/FlatFee.json'), 'utf-8')
        );

        // Deploy FlatFee (fee provider)
        const flatFeeHash = await client.deployContract({
            abi: flatFeeArtifact.abi,
            bytecode: flatFeeArtifact.bytecode.object as `0x${string}`,
            account: client.account,
            args: [],
        });

        const flatFeeReceipt = await client.waitForTransactionReceipt({ hash: flatFeeHash });
        if (!flatFeeReceipt.contractAddress) {
            throw new Error('FlatFee deployment failed');
        }

        // Deploy Web3PGP proxy
        const web3pgpHash = await client.deployContract({
            abi: web3pgpArtifact.abi,
            bytecode: web3pgpArtifact.bytecode.object as `0x${string}`,
            account: client.account,
            args: [],
        });

        const web3pgpReceipt = await client.waitForTransactionReceipt({ hash: web3pgpHash });
        if (!web3pgpReceipt.contractAddress) {
            throw new Error('Web3PGP deployment failed');
        }

        return {
            web3pgp: web3pgpReceipt.contractAddress,
            flatFee: flatFeeReceipt.contractAddress,
        };
    }

    /**
     * Wait for a number of blocks to be mined
     */
    async waitForBlocks(count: number): Promise<void> {
        const client = this.getPublicClient();
        const startBlock = await client.getBlockNumber();
        const targetBlock = startBlock + BigInt(count);

        return new Promise((resolve) => {
            const interval = setInterval(async () => {
                const currentBlock = await client.getBlockNumber();
                if (currentBlock >= targetBlock) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * Mine a specified number of blocks
     */
    async mineBlocks(count: number): Promise<void> {
        const client = this.getPublicClient();
        
        // Mine blocks one by one to ensure they are actually created
        for (let i = 0; i < count; i++) {
            await client.request({
                method: 'evm_mine' as any,
                params: [] as any,
            });
        }
    }

    /**
     * Set the next block timestamp
     */
    async setNextBlockTimestamp(timestamp: number): Promise<void> {
        const client = this.getPublicClient();
        
        await client.request({
            method: 'evm_setNextBlockTimestamp' as any,
            params: [timestamp] as any,
        });
    }

    /**
     * Snapshot the current blockchain state
     */
    async snapshot(): Promise<string> {
        const client = this.getPublicClient();
        
        const snapshotId = await client.request({
            method: 'evm_snapshot' as any,
            params: [] as any,
        });

        return snapshotId as string;
    }

    /**
     * Revert to a previous snapshot
     */
    async revert(snapshotId: string): Promise<void> {
        const client = this.getPublicClient();
        
        await client.request({
            method: 'evm_revert' as any,
            params: [snapshotId] as any,
        });
    }
}
