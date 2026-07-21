const tseslint = require("@typescript-eslint/eslint-plugin");
const parser = require("@typescript-eslint/parser");
const prettier = require("eslint-plugin-prettier");

module.exports = [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "prettier/prettier": "error",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
];
