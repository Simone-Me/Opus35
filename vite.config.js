import react from "@vitejs/plugin-react";
import AutoImport from "unplugin-auto-import/vite";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    AutoImport({
      resolvers: [
        (name) => {
          if (name === "IconStreamlineUltimateArrowThickRightBottomCorner3") {
            return {
              name: "default",
              as: name,
              from: "~icons/streamline-ultimate/arrow-thick-right-bottom-corner-3",
            };
          }
        },
      ],
    }),
    Icons({
      compiler: "jsx",
      autoInstall: true,
    }),
  ],
});
