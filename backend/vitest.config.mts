import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "html"],
      // DoD: ≥ 80 % en el código nuevo. Cada HU agrega aquí su carpeta.
      thresholds: {
        "src/simulation/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        // US27 (src/simulation/** ya cubre RiskRatingFilter)
        "src/auth/**/ProAccess*.ts": { lines: 80, functions: 80, branches: 80, statements: 80 },
        // US33
        "src/checkout/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
        // US30
        "src/reports/**": { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  },
});
