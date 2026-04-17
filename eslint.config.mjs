import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  // Ignore build artifacts and generated files.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
