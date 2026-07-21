import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const PLATFORM_SDKS = {
  poki: "https://game-cdn.poki.com/scripts/v2/poki-sdk.js",
  crazygames: "https://sdk.crazygames.com/crazygames-sdk-v3.js",
};

function platformSdkScript(platform) {
  return {
    name: "platform-sdk-script",
    transformIndexHtml() {
      const src = PLATFORM_SDKS[platform];
      if (!src) return [];
      return [{
        tag: "script",
        attrs: { src },
        injectTo: "head-prepend",
      }];
    },
  };
}

export default defineConfig(({ mode }) => {
  const platform = mode === "poki" || mode === "crazygames" ? mode : "standalone";

  return {
    base: "./",
    plugins: [platformSdkScript(platform), react()],
    resolve: {
      alias: {
        "#platform-adapter": fileURLToPath(
          new URL(`./src/platform/adapters/${platform}.js`, import.meta.url),
        ),
      },
    },
    build: {
      outDir: `dist/${platform}`,
      emptyOutDir: true,
      target: "es2020",
    },
  };
});
