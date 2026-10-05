import react from "@vitejs/plugin-react";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    Icons({
      compiler: "jsx",
      // Icon sets are declared in devDependencies; never install at build time.
      autoInstall: false,
    }),
  ],
  test: {
    include: ["src/**/*.test.{js,jsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    restoreMocks: true,
  },
});
