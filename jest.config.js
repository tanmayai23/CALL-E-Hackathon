/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["**/packages/**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      tsconfig: {
        module: "CommonJS",
        moduleResolution: "node",
      },
    }],
  },
  moduleNameMapper: {
    "^@sentinel/types$": "<rootDir>/packages/types/index.ts",
    "^@sentinel/calle$": "<rootDir>/packages/calle/client.ts",
    "^@sentinel/agent$": "<rootDir>/packages/agent/index.ts",
  },
  collectCoverageFrom: [
    "packages/**/*.ts",
    "!packages/**/__tests__/**",
    "!packages/**/index.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};
