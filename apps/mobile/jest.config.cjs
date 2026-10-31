module.exports = {
  preset: 'jest-expo',
  watchman: false,
  testMatch: ['<rootDir>/__tests__/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@rhythm-health/brand$': '<rootDir>/../../packages/brand/src/index.ts',
    '^@rhythm-health/contract$': '<rootDir>/../../packages/contract/src/index.ts',
  },
};
