const expoTransform = require('jest-expo/jest-preset').transform;
const babelTransformKey = Object.keys(expoTransform).find((key) =>
  Array.isArray(expoTransform[key]) && expoTransform[key][0] === 'babel-jest'
);
const transform = { ...expoTransform };
if (babelTransformKey) {
  const [babelJest, options] = expoTransform[babelTransformKey];
  transform[babelTransformKey] = [babelJest, {
    ...options,
    caller: { ...options.caller, preserveEnvVars: true },
  }];
}

module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform,
  clearMocks: true,
};
