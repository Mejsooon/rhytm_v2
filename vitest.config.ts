import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias "@/" → "src/" (jak w tsconfig.json)
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Testy e2e należą do Playwrighta, nie do Vitesta
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
