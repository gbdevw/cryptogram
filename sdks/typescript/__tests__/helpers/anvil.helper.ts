import { spawn, ChildProcess } from 'child_process';
import { createPublicClient, createWalletClient, http, publicActions, Address, encodeFunctionData } from 'viem';
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
    
    // Anvil's default first account (deterministic)
    private deployerAddress: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

    constructor(config: AnvilConfig = {}) {
        this.port = config.port ?? 8545;
        this.blockTime = config.blockTime ?? 1;
        this.accountsCount = config.accounts ?? 10;
        this.initialBalance = config.balance ?? BigInt(10000) * BigInt(10 ** 18); // 10000 ETH
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
            ];

            this.anvilProcess = spawn('anvil', args);

            if (!this.anvilProcess.stdout || !this.anvilProcess.stderr) {
                reject(new Error('Failed to spawn Anvil process'));
                return;
            }

            let resolved = false;

            // Listen for ready signal
            this.anvilProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                if (!resolved && output.includes('Listening on')) {
                    this.ready = true;
                    resolved = true;
                    // Give it a moment to be fully ready
                    setTimeout(() => resolve(), 500);
                }
            });

            this.anvilProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                // Handle port already in use - assume existing Anvil instance is OK
                if (!resolved && output.includes('Address already in use')) {
                    this.ready = true;
                    resolved = true;
                    // Give it a moment to be fully ready
                    setTimeout(() => resolve(), 500);
                }
            });

            this.anvilProcess.on('error', (error: any) => {
                if (!resolved) {
                    // Handle EADDRINUSE - port already in use (Anvil instance already running)
                    if (error.code === 'EADDRINUSE') {
                        this.ready = true;
                        resolved = true;
                        resolve();
                    } else {
                        reject(new Error(`Failed to start Anvil: ${error.message}`));
                    }
                }
            });

            this.anvilProcess.on('exit', (code) => {
                if (!resolved && code !== 0) {
                    reject(new Error(`Anvil exited with code ${code}`));
                }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!resolved) {
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
     * Uses Anvil's native accounts (unlocked)
     */
    getWalletClient(address: Address = this.deployerAddress) {
        return createWalletClient({
            account: address,
            chain: foundry,
            transport: http(this.getRpcUrl()),
        }).extend(publicActions);
    }

    /**
     * Execute a Foundry script on the Anvil instance
     * @param scriptPath - Relative path to the script file from contracts/ directory
     * @param envVars - Environment variables to pass to the script
     */
    private async runForgeScript(
        scriptPath: string,
        envVars: Record<string, string> = {}
    ): Promise<void> {
        const contractsPath = path.resolve(__dirname, '../../../../contracts');
        
        return new Promise((resolve, reject) => {
            const args = [
                'script',
                scriptPath,
                '--rpc-url', this.getRpcUrl(),
                '--broadcast',
                '--sender', this.deployerAddress,
                '--unlocked',
            ];

            const proc = spawn('forge', args, {
                cwd: contractsPath,
                env: {
                    ...process.env,
                    // Only pass FEE_IN_WEIS if provided
                    ...(envVars.FEE_IN_WEIS && { FEE_IN_WEIS: envVars.FEE_IN_WEIS }),
                },
                stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
            });

            let stdout = '';
            let stderr = '';

            if (proc.stdout) {
                proc.stdout.on('data', (data: Buffer) => {
                    stdout += data.toString();
                });
            }

            if (proc.stderr) {
                proc.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString();
                });
            }

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`forge script failed: ${stderr || 'Unknown error'}`));
                }
            });

            proc.on('error', (error) => {
                reject(new Error(`Failed to spawn forge: ${error.message}`));
            });
        });
    }

    /**
     * Extract contract addresses from Foundry broadcast files
     * @param scriptName - Name of the script file (e.g., 'DeployTestEnvironment.s.sol')
     * @returns Object containing proxy, implementation, and all deployed contract addresses
     */
    private extractDeploymentAddresses(scriptName: string): {
        proxy: Address | undefined;
        implementation: Address | undefined;
        contracts: Array<{ name: string; address: Address }>;
    } {
        const contractsPath = path.resolve(__dirname, '../../../../contracts');
        const broadcastPath = path.join(
            contractsPath,
            'broadcast',
            scriptName,
            '31337', // Anvil chain ID
            'run-latest.json'
        );

        if (!fs.existsSync(broadcastPath)) {
            throw new Error(`Broadcast file not found: ${broadcastPath}`);
        }

        const broadcast = JSON.parse(fs.readFileSync(broadcastPath, 'utf-8'));
        
        // Extract all deployed contracts
        const contracts: Array<{ name: string; address: Address }> = [];
        
        if (broadcast.transactions) {
            for (const tx of broadcast.transactions) {
                if (tx.contractAddress && tx.transactionType === 'CREATE') {
                    contracts.push({
                        name: tx.contractName || 'Unknown',
                        address: tx.contractAddress as Address,
                    });
                }
            }
        }

        // Heuristic: Last contract is usually the proxy (if applicable)
        const proxy: Address | undefined = contracts.length > 0 
            ? contracts[contracts.length - 1]?.address 
            : undefined;
        
        // Second-to-last is usually implementation
        const implementation: Address | undefined = contracts.length > 1
            ? contracts[contracts.length - 2]?.address
            : undefined;

        return { proxy, implementation, contracts };
    }

    /**
     * Deploy Web3PGP using Foundry deployment scripts
     * This ensures test environment matches production deployment exactly
     * Uses DeployTestEnvironment.s.sol which deploys AccessManager + Web3PGP with role configuration
     * Uses Anvil's first provisioned account for deployment
     */
    async deployWeb3PGP(initialFee: bigint = 0n): Promise<{
        web3pgp: Address;
        implementation: Address;
        proxy: Address;
        accessManager: Address;
    }> {
        console.log('\n========================================');
        console.log('Deploying Test Environment via Foundry');
        console.log('========================================');
        
        const envVars: Record<string, string> = {};
        if (initialFee > 0n) {
            envVars.FEE_IN_WEIS = initialFee.toString();
        }

        // Execute DeployTestEnvironment.s.sol using Anvil's account
        await this.runForgeScript('scripts/DeployTestEnvironment.s.sol', envVars);

        // Extract addresses from broadcast
        const deployment = this.extractDeploymentAddresses('DeployTestEnvironment.s.sol');

        // The deployment order in DeployTestEnvironment.s.sol is:
        // 1. AccessManagerUpgradeable (implementation)
        // 2. ERC1967Proxy (AccessManager proxy)
        // 3. Web3PGP (implementation)
        // 4. ERC1967Proxy (Web3PGP proxy)
        
        if (deployment.contracts.length < 4) {
            throw new Error(`Deployment did not create expected number of contracts (got ${deployment.contracts.length}, expected 4)`);
        }

        const accessManagerProxy = deployment.contracts[1]?.address;
        const web3pgpImplementation = deployment.contracts[2]?.address;
        const web3pgpProxy = deployment.contracts[3]?.address;

        if (!accessManagerProxy || !web3pgpProxy || !web3pgpImplementation) {
            throw new Error('Failed to extract all required addresses from deployment');
        }

        console.log('\n✓ Deployment complete:');
        console.log('  AccessManager:', accessManagerProxy);
        console.log('  Web3PGP Implementation:', web3pgpImplementation);
        console.log('  Web3PGP Proxy:', web3pgpProxy);
        console.log('  Roles configured: ADMIN(0), UPGRADE_MANAGER(1), TREASURER(2)');
        console.log('========================================\n');

        return {
            web3pgp: web3pgpProxy,
            implementation: web3pgpImplementation,
            proxy: web3pgpProxy,
            accessManager: accessManagerProxy,
        };
    }

    /**
     * Deploy Web3Doc using Foundry deployment scripts
     * This ensures test environment matches production deployment exactly
     * Uses DeployTestEnvironment.s.sol which deploys AccessManager + Web3PGP + Web3Doc with role configuration
     * Uses Anvil's first provisioned account for deployment
     */
    async deployWeb3Doc(initialFee: bigint = 0n): Promise<{
        web3doc: Address;
        web3pgp: Address;
        implementation: Address;
        proxy: Address;
        accessManager: Address;
    }> {
        console.log('\n========================================');
        console.log('Deploying Test Environment via Foundry');
        console.log('========================================');
        
        const envVars: Record<string, string> = {};
        if (initialFee > 0n) {
            envVars.FEE_IN_WEIS = initialFee.toString();
        }

        // Execute DeployTestEnvironment.s.sol using Anvil's account
        await this.runForgeScript('scripts/DeployTestEnvironment.s.sol', envVars);

        // Extract addresses from broadcast
        const deployment = this.extractDeploymentAddresses('DeployTestEnvironment.s.sol');

        // The deployment order in DeployTestEnvironment.s.sol is:
        // 1. AccessManagerUpgradeable (implementation)
        // 2. ERC1967Proxy (AccessManager proxy)
        // 3. Web3PGP (implementation)
        // 4. ERC1967Proxy (Web3PGP proxy)
        // 5. Web3Doc (implementation)
        // 6. ERC1967Proxy (Web3Doc proxy)
        
        if (deployment.contracts.length < 6) {
            throw new Error(`Deployment did not create expected number of contracts (got ${deployment.contracts.length}, expected 6)`);
        }

        const accessManagerProxy = deployment.contracts[1]?.address;
        const web3pgpImplementation = deployment.contracts[2]?.address;
        const web3pgpProxy = deployment.contracts[3]?.address;
        const web3docImplementation = deployment.contracts[4]?.address;
        const web3docProxy = deployment.contracts[5]?.address;

        if (!accessManagerProxy || !web3pgpProxy || !web3pgpImplementation || !web3docProxy || !web3docImplementation) {
            throw new Error('Failed to extract all required addresses from deployment');
        }

        console.log('\n✓ Deployment complete:');
        console.log('  AccessManager:', accessManagerProxy);
        console.log('  Web3PGP Implementation:', web3pgpImplementation);
        console.log('  Web3PGP Proxy:', web3pgpProxy);
        console.log('  Web3Doc Implementation:', web3docImplementation);
        console.log('  Web3Doc Proxy:', web3docProxy);
        console.log('========================================\n');

        return {
            web3doc: web3docProxy,
            web3pgp: web3pgpProxy,
            implementation: web3docImplementation,
            proxy: web3docProxy,
            accessManager: accessManagerProxy,
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
