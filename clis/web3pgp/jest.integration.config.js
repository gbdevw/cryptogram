module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.integration.test.ts'],
  testTimeout: 180000, // 3 minutes for integration tests
  forceExit: true,
  detectOpenHandles: false,
};
