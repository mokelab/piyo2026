import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages などサブパス配信でも動くように相対パスで出力する
  base: "./",
});
