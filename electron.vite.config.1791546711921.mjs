// electron.vite.config.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, externalizeDepsPlugin, loadEnv } from "electron-vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
var __electron_vite_injected_import_meta_url = "file:///E:/CursorProjekte/MailClient/electron.vite.config.ts";
var __configDir = path.dirname(fileURLToPath(__electron_vite_injected_import_meta_url));
function touchMainEntryAfterPreloadRebuildPlugin() {
  let isFirstBundle = true;
  return {
    name: "mailclient-touch-main-after-preload-rebuild",
    apply: "build",
    closeBundle() {
      if (isFirstBundle) {
        isFirstBundle = false;
        return;
      }
      const mainEntry = path.resolve(__configDir, "src/main/index.ts");
      try {
        const t = /* @__PURE__ */ new Date();
        fs.utimesSync(mainEntry, t, t);
      } catch (e) {
        console.warn("[mailclient] Preload-Rebuild: Main-Eintrag touch fehlgeschlagen:", e);
      }
    }
  };
}
var electron_vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, __configDir, ["MAILCLIENT_", "CHRONELL_"]);
  const publisherDefine = {
    "process.env.MAILCLIENT_MICROSOFT_CLIENT_ID": JSON.stringify(env.MAILCLIENT_MICROSOFT_CLIENT_ID ?? ""),
    "process.env.MAILCLIENT_GOOGLE_CLIENT_ID": JSON.stringify(env.MAILCLIENT_GOOGLE_CLIENT_ID ?? ""),
    "process.env.MAILCLIENT_GOOGLE_CLIENT_SECRET": JSON.stringify(env.MAILCLIENT_GOOGLE_CLIENT_SECRET ?? ""),
    "process.env.MAILCLIENT_NOTION_CLIENT_ID": JSON.stringify(env.MAILCLIENT_NOTION_CLIENT_ID ?? ""),
    "process.env.MAILCLIENT_NOTION_CLIENT_SECRET": JSON.stringify(
      env.MAILCLIENT_NOTION_CLIENT_SECRET ?? ""
    ),
    "process.env.MAILCLIENT_REMOTE_OAUTH_CONFIG_URL": JSON.stringify(
      env.MAILCLIENT_REMOTE_OAUTH_CONFIG_URL ?? ""
    ),
    "process.env.MAILCLIENT_PRIVACY_URL": JSON.stringify(env.MAILCLIENT_PRIVACY_URL ?? ""),
    "process.env.MAILCLIENT_HELP_URL": JSON.stringify(env.MAILCLIENT_HELP_URL ?? ""),
    "process.env.CHRONELL_SUPABASE_URL": JSON.stringify(env.CHRONELL_SUPABASE_URL ?? ""),
    "process.env.CHRONELL_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      env.CHRONELL_SUPABASE_PUBLISHABLE_KEY ?? ""
    )
  };
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: publisherDefine,
      resolve: {
        alias: {
          "@shared": path.resolve(__configDir, "src/shared"),
          "@main": path.resolve(__configDir, "src/main")
        }
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin(), touchMainEntryAfterPreloadRebuildPlugin()],
      resolve: {
        alias: {
          "@shared": path.resolve(__configDir, "src/shared")
        }
      }
    },
    renderer: {
      root: path.resolve(__configDir, "src/renderer"),
      /** Relativ zu index.html — nötig für loadFile/file:// in der installierten App. */
      base: "./",
      resolve: {
        alias: {
          "@": path.resolve(__configDir, "src/renderer/src"),
          "@shared": path.resolve(__configDir, "src/shared")
        }
      },
      build: {
        rollupOptions: {
          input: {
            index: path.resolve(__configDir, "src/renderer/index.html")
          },
          output: {
            manualChunks(id) {
              if (id.includes("node_modules/@fullcalendar")) return "fullcalendar";
              if (id.includes("node_modules/@tiptap") || id.includes("node_modules/prosemirror")) {
                return "tiptap";
              }
              if (id.includes("node_modules/lucide-react")) return "lucide";
              if (id.includes("node_modules/date-fns")) return "date-fns";
              if (id.includes("node_modules/@dnd-kit")) return "dnd-kit";
              return void 0;
            }
          }
        }
      },
      plugins: [
        react(),
        process.env.ANALYZE_BUNDLE === "1" ? visualizer({
          filename: path.resolve(__configDir, "out/stats/renderer.html"),
          gzipSize: true,
          open: false
        }) : void 0
      ].filter(Boolean)
    }
  };
});
export {
  electron_vite_config_default as default
};
