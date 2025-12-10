/// <reference types="jest" />

/**
 * Create a mock logger for testing
 */
export const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(function () {
    return this;
  }),
});
