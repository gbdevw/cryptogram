// Export utilities
export * from './utils/0xstr';

// Export flatfee functions
export * from './flatfee/types/types';
export * from './flatfee/flatefee.interface';
export * from './flatfee/flatefee';

// Export web3pgp functions
export * from './web3pgp/types/types';
export * from './web3pgp/web3pgp.interface';
export * from './web3pgp/web3pgp.service.interface';
export * from './web3pgp/web3pgp';
export * from './web3pgp/web3pgp.service';

// Export web3sign functions
export * from './web3sign/web3sign.interface';
export * from './web3sign/web3sign.service.interface';
export { Web3Sign } from './web3sign/web3sign';
export { Web3SignService } from './web3sign/web3sign.service';
export { Web3SignError, Web3SignCriticalError, Web3SignServiceError, Web3SignServiceCriticalError, Web3SignServiceValidationError } from './web3sign/types/errors';

// Export types (Web3Sign document types)
export type {
    Recipient,
    DocumentLog,
    CopyLog,
    SignatureLog,
    TimestampLog,
    NotificationLog,
    SignatureRevocationLog,
    Web3SignEvents,
    EventType
} from './web3sign/types/types';
