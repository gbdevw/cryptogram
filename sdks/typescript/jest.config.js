module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['\\.d\\.ts$'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};