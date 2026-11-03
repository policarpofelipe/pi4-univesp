import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";
  const raiz = fileURLToPath(new URL(".", import.meta.url));
  const arranque = readFileSync(`${raiz}/src/acessibilidade-boot.js`, "utf8");

  return {
    base: "/",
    plugins: [
      {
        name: "inline-a11y-boot",
        transformIndexHtml: {
          order: "pre",
          handler(html) {
            return html.replace(
              '<script src="/src/acessibilidade-boot.js"></script>',
              `<script>${arranque}</script>`,
            );
          },
        },
      },
    ],
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: `${raiz}/index.html`,
          painel: `${raiz}/painel.html`,
          fonte: `${raiz}/fonte.html`,
          sobre: `${raiz}/sobre.html`,
          convite: `${raiz}/convite.html`,
          convites: `${raiz}/convites.html`,
        },
      },
    },
  };
});
