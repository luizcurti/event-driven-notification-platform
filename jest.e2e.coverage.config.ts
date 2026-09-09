import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/tests"],
  testMatch: ["**/src/tests/e2e/**/*.spec.ts"],
  collectCoverageFrom: ["src/handlers/api/notification-api-lambda.ts"],
  coverageDirectory: "coverage/e2e",
  moduleFileExtensions: ["ts", "js", "json"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

export default config;
