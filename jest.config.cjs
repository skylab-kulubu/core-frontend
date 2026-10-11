const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/src/**/*.spec.{ts,tsx}'],
  moduleNameMapper: {
    '^@testing-library/react$': '<rootDir>/src/test/setup/rtl.tsx',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/index.{ts,tsx}'],
  coverageDirectory: '<rootDir>/coverage',
};

module.exports = createJestConfig(config);
