/**
 * Base error class for all Web3Sign-related errors.
 * Extends the native Error class to provide consistent error handling across the Web3Sign system.
 */
export class Web3SignError extends Error {
    /**
     * Optional underlying error that caused this error.
     */
    cause?: Error | undefined;

    /**
     * Creates a new Web3SignError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = 'Web3SignError';
        this.cause = cause;
        
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Critical error class for unrecoverable Web3Sign errors.
 * Used when the system encounters a fatal condition that requires immediate attention.
 */
export class Web3SignCriticalError extends Web3SignError {
    /**
     * Creates a new Web3SignCriticalError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'Web3SignCriticalError';
    }
}

/**
 * Base error class for Web3Sign service-related errors.
 * Used for errors that occur during service operations.
 */
export class Web3SignServiceError extends Error {
    /**
     * Optional underlying error that caused this error.
     */
    cause?: Error | undefined;

    /**
     * Creates a new Web3SignServiceError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = 'Web3SignServiceError';
        this.cause = cause;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Validation error class for Web3Sign service validation failures.
 * Thrown when input validation fails or data does not meet required criteria.
 */
export class Web3SignServiceValidationError extends Web3SignServiceError {
    /**
     * Creates a new Web3SignServiceValidationError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'Web3SignServiceValidationError';
    }
}

/**
 * Critical service error class for unrecoverable Web3Sign service errors.
 * Used when a service encounters a fatal condition that prevents continued operation.
 */
export class Web3SignServiceCriticalError extends Web3SignServiceError {
    /**
     * Creates a new Web3SignServiceCriticalError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'Web3SignServiceCriticalError';
    }
}