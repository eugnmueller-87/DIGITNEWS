import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";

/**
 * ESLint — strict but pragmatic. Catches real bug classes (unawaited promises,
 * unsafe patterns) and keeps imports/structure tidy, without so much noise that
 * the gate gets disabled. Formatting is owned by Prettier (eslint-config-prettier
 * last disables any stylistic ESLint rules that would conflict).
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Enable TYPE-AWARE linting (needed for no-floating-promises etc.).
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin },
    rules: {
      // --- Real bug catchers (errors) -------------------------------------
      // Unawaited promises are a top source of silent failures in async server
      // code (auth flows, RPCs). Force handling.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // --- Code-hygiene (errors) ------------------------------------------
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Keep imports ordered & grouped → diffs stay clean, no duplicate imports.
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",

      // --- Pragmatic warnings (don't block, but nag) ----------------------
      // `any` defeats the type system; allowed but flagged so it's a conscious
      // choice, not a habit.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Node scripts / config: allow console + relax rules.
  {
    files: ["scripts/**/*.{mjs,js}", "*.config.{mjs,js,ts}"],
    rules: { "no-console": "off" },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "worker/**", // Python — linted by Ruff
  ]),

  // MUST be last: turn off ESLint rules that conflict with Prettier formatting.
  prettier,
]);

export default eslintConfig;
