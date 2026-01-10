import { AnvilHelper, AnvilConfig } from './anvil.helper';

/**
 * Global singleton for Anvil instance shared across all tests
 * This allows all test files to use the same Anvil blockchain,
 * dramatically reducing startup time and resource usage.
 */
class AnvilSingleton {
    private static instance: AnvilHelper | null = null;
    private static initPromise: Promise<void> | null = null;
    private static config: AnvilConfig | null = null;

    /**
     * Get or create the shared Anvil instance
     */
    static async getInstance(config?: AnvilConfig): Promise<AnvilHelper> {
        // Store config if provided
        if (config) {
            this.config = config;
        }

        // Return existing instance if available
        if (this.instance) {
            return this.instance;
        }

        // Wait for initialization if already in progress
        if (this.initPromise) {
            await this.initPromise;
            return this.instance!;
        }

        // Create initialization promise
        this.initPromise = (async () => {
            try {
                const finalConfig = this.config || { port: 8545, blockTime: 0.1 };
                this.instance = new AnvilHelper(finalConfig);
                await this.instance.start();
                console.log('✓ Anvil singleton initialized at', this.instance.getRpcUrl());
            } catch (error) {
                this.initPromise = null; // Reset on error so it can retry
                throw error;
            }
        })();

        await this.initPromise;
        return this.instance!;
    }

    /**
     * Reset the singleton (mainly for testing the singleton itself)
     */
    static async reset(): Promise<void> {
        if (this.instance) {
            await this.instance.stop();
            this.instance = null;
        }
        this.initPromise = null;
        this.config = null;
    }

    /**
     * Check if instance exists without creating it
     */
    static isInitialized(): boolean {
        return this.instance !== null;
    }
}

export { AnvilSingleton };
