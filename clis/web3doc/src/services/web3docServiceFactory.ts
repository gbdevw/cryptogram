import { Logger } from 'pino';
import { MergedConfig } from '../config/types';

/**
 * Initialize Web3Doc service
 * Currently a stub - Web3Doc service will be implemented when contract is ready
 */
export async function createWeb3DocService(
  config: MergedConfig,
  logger: Logger,
): Promise<void> {
  const serviceLogger = logger.child({ component: 'web3docService' });

  serviceLogger.debug(
    {
      contractAddress: config.web3doc.contract,
      chain: config.ethereum.chain,
    },
    'Web3Doc service initialized'
  );

  return Promise.resolve();
}
