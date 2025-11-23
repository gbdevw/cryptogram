module.exports = {
  testTimeout: 45000,
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['\\.d\\.ts$'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};