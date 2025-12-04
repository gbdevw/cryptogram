/**
 * Base error class for all Web3Doc-related errors.
 * Extends the native Error class to provide consistent error handling across the Web3Doc system.
 */
export class Web3DocError extends Error {
    /**
     * Optional underlying error that caused this error.
     */
    cause?: Error | undefined;

    /**
     * Creates a new Web3DocError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = 'Web3DocError';
        this.cause = cause;
        
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Critical error class for unrecoverable Web3Doc errors.
 * Used when the system encounters a fatal condition that requires immediate attention.
 */
export class Web3DocCriticalError extends Web3DocError {
    /**
     * Creates a new Web3DocCriticalError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'Web3DocCriticalError';
    }
}

/**
 * Base error class for Web3Doc service-related errors.
 * Used for errors that occur during service operations.
 */
export class Web3DocServiceError extends Error {
    /**
     * Optional underlying error that caused this error.
     */
    cause?: Error | undefined;

    /**
     * Creates a new Web3DocServiceError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = 'Web3DocServiceError';
        this.cause = cause;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Validation error class for Web3Doc service validation failures.
 * Thrown when input validation fails or data does not meet required criteria.
 */
export class Web3DocServiceValidationError extends Web3DocServiceError {
    /**
     * Creates a new Web3DocServiceValidationError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'Web3DocServiceValidationError';
    }
}

/**
 * Critical service error class for unrecoverable Web3Doc service errors.
 * Used when a service encounters a fatal condition that prevents continued operation.
 */
export class Web3DocServiceCriticalError extends Web3DocServiceError {
    /**
     * Creates a new Web3DocServiceCriticalError instance.
     * @param message - Human-readable error description
     * @param cause - Optional underlying error that caused this error
     */
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'Web3DocServiceCriticalError';
    }
}