import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";
  const raiz = fileURLToPath(new URL(".", import.meta.url));

  return {
    base: "/",
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
          convite: `${raiz}/convite.html`,
          convites: `${raiz}/convites.html`,
        },
      },
    },
  };
});
