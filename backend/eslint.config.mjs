import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// Mismo estilo que frontend/eslint.config.js, con globals de Node en vez de navegador.
// typescript-eslint usa la API de TS 6 (alias "typescript"); `tsc` sigue siendo TS 7.
export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Prefijo _ = parámetro obligatorio pero sin usar (p. ej. `_next` en el manejador de errores de Express)
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
]);
