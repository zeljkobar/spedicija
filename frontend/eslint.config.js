import js from "@eslint/js";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist", "dist/**", "**/dist/**"]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        document: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        window: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        URL: "readonly"
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      }
    },
    plugins: {
      "react-hooks": hooks,
      "react-refresh": refresh
    },
    rules: {
      ...hooks.configs.recommended.rules,
      "no-unused-vars": ["error", { "varsIgnorePattern": "^[A-Z_]" }],
      "react-refresh/only-export-components": ["warn", { "allowConstantExport": true }]
    }
  }
];
