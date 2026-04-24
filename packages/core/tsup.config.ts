import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/node.ts", "src/cloudflare.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: false,
});
