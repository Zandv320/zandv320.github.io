// ESLint flat config for Eldoria (runeveld/ client and server/ worker). Velmora is a separate game and not linted.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "node_modules/", "velmora/", "peerjs.min.js", "runeveld/sprites/", "runeveld/_download/"] },
  js.configs.recommended,
  {
    files: ["runeveld/src/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser } },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      camelcase: ["warn", { properties: "never", ignoreDestructuring: true }],
      eqeqeq: ["warn", "smart"],
      "prefer-const": "warn",
    },
  },
  {
    files: ["server/src/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.worker } },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      eqeqeq: ["warn", "smart"],
      "prefer-const": "warn",
    },
  },
  {
    files: ["eslint.config.js", "vite.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node } },
  },
];
