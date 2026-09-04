// vite.config.ts
import { defineConfig } from "file:///C:/Users/Thiru%20T/Desktop/forge-crm/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Thiru%20T/Desktop/forge-crm/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import electron from "file:///C:/Users/Thiru%20T/Desktop/forge-crm/frontend/node_modules/vite-plugin-electron/dist/index.mjs";
var vite_config_default = defineConfig(({ command }) => ({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            emptyOutDir: false,
            rollupOptions: {
              external: ["electron"],
              onwarn(warning, warn) {
                if (warning.code === "UNKNOWN_OPTION" && warning.message?.includes("platform")) return;
                warn(warning);
              }
            }
          }
        }
      },
      {
        entry: "electron/preload.ts",
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            emptyOutDir: false,
            rollupOptions: {
              external: ["electron"],
              onwarn(warning, warn) {
                if (warning.code === "UNKNOWN_OPTION" && warning.message?.includes("platform")) return;
                warn(warning);
              }
            }
          }
        }
      }
    ])
  ],
  base: command === "serve" ? "/" : "./",
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/health": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
        changeOrigin: true
      }
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxUaGlydSBUXFxcXERlc2t0b3BcXFxcZm9yZ2UtY3JtXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxUaGlydSBUXFxcXERlc2t0b3BcXFxcZm9yZ2UtY3JtXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9UaGlydSUyMFQvRGVza3RvcC9mb3JnZS1jcm0vZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgZWxlY3Ryb24gZnJvbSAndml0ZS1wbHVnaW4tZWxlY3Ryb24nO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgY29tbWFuZCB9KSA9PiAoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBlbGVjdHJvbihbXG4gICAgICB7XG4gICAgICAgIGVudHJ5OiAnZWxlY3Ryb24vbWFpbi50cycsXG4gICAgICAgIHZpdGU6IHtcbiAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgb3V0RGlyOiAnZGlzdC1lbGVjdHJvbicsXG4gICAgICAgICAgICBlbXB0eU91dERpcjogZmFsc2UsXG4gICAgICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGV4dGVybmFsOiBbJ2VsZWN0cm9uJ10sXG4gICAgICAgICAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ1VOS05PV05fT1BUSU9OJyAmJiB3YXJuaW5nLm1lc3NhZ2U/LmluY2x1ZGVzKCdwbGF0Zm9ybScpKSByZXR1cm47XG4gICAgICAgICAgICAgICAgd2Fybih3YXJuaW5nKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGVudHJ5OiAnZWxlY3Ryb24vcHJlbG9hZC50cycsXG4gICAgICAgIG9uc3RhcnQob3B0aW9ucykge1xuICAgICAgICAgIG9wdGlvbnMucmVsb2FkKCk7XG4gICAgICAgIH0sXG4gICAgICAgIHZpdGU6IHtcbiAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgb3V0RGlyOiAnZGlzdC1lbGVjdHJvbicsXG4gICAgICAgICAgICBlbXB0eU91dERpcjogZmFsc2UsXG4gICAgICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGV4dGVybmFsOiBbJ2VsZWN0cm9uJ10sXG4gICAgICAgICAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ1VOS05PV05fT1BUSU9OJyAmJiB3YXJuaW5nLm1lc3NhZ2U/LmluY2x1ZGVzKCdwbGF0Zm9ybScpKSByZXR1cm47XG4gICAgICAgICAgICAgICAgd2Fybih3YXJuaW5nKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSksXG4gIF0sXG4gIGJhc2U6IGNvbW1hbmQgPT09ICdzZXJ2ZScgPyAnLycgOiAnLi8nLFxuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiB0cnVlLFxuICAgIHBvcnQ6IDUxNzMsXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjgwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgICAgJy9oZWFsdGgnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICAnL3dzJzoge1xuICAgICAgICB0YXJnZXQ6ICd3czovLzEyNy4wLjAuMTo4MDAwJyxcbiAgICAgICAgd3M6IHRydWUsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVUsU0FBUyxvQkFBb0I7QUFDOVYsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sY0FBYztBQUVyQixJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLFFBQVEsT0FBTztBQUFBLEVBQzVDLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFNBQVM7QUFBQSxNQUNQO0FBQUEsUUFDRSxPQUFPO0FBQUEsUUFDUCxNQUFNO0FBQUEsVUFDSixPQUFPO0FBQUEsWUFDTCxRQUFRO0FBQUEsWUFDUixhQUFhO0FBQUEsWUFDYixlQUFlO0FBQUEsY0FDYixVQUFVLENBQUMsVUFBVTtBQUFBLGNBQ3JCLE9BQU8sU0FBUyxNQUFNO0FBQ3BCLG9CQUFJLFFBQVEsU0FBUyxvQkFBb0IsUUFBUSxTQUFTLFNBQVMsVUFBVSxFQUFHO0FBQ2hGLHFCQUFLLE9BQU87QUFBQSxjQUNkO0FBQUEsWUFDRjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFLE9BQU87QUFBQSxRQUNQLFFBQVEsU0FBUztBQUNmLGtCQUFRLE9BQU87QUFBQSxRQUNqQjtBQUFBLFFBQ0EsTUFBTTtBQUFBLFVBQ0osT0FBTztBQUFBLFlBQ0wsUUFBUTtBQUFBLFlBQ1IsYUFBYTtBQUFBLFlBQ2IsZUFBZTtBQUFBLGNBQ2IsVUFBVSxDQUFDLFVBQVU7QUFBQSxjQUNyQixPQUFPLFNBQVMsTUFBTTtBQUNwQixvQkFBSSxRQUFRLFNBQVMsb0JBQW9CLFFBQVEsU0FBUyxTQUFTLFVBQVUsRUFBRztBQUNoRixxQkFBSyxPQUFPO0FBQUEsY0FDZDtBQUFBLFlBQ0Y7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxNQUFNLFlBQVksVUFBVSxNQUFNO0FBQUEsRUFDbEMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ2hCO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDVCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsTUFDaEI7QUFBQSxNQUNBLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxRQUNSLElBQUk7QUFBQSxRQUNKLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
