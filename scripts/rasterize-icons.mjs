import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const TARGETS = [
  {
    src: resolve(root, "assets/source/icon.svg"),
    dst: resolve(root, "assets/icon.png"),
    size: 1024,
  },
  {
    src: resolve(root, "assets/source/splash.svg"),
    dst: resolve(root, "assets/splash-icon.png"),
    size: 1024,
  },
  // Android adaptive-icon.png intentionally NOT rasterized here; iOS revamp scope only.
];

for (const t of TARGETS) {
  const svg = readFileSync(t.src, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: t.size },
  });
  const png = resvg.render().asPng();
  writeFileSync(t.dst, png);
  console.log(`wrote ${t.dst} (${t.size}x${t.size})`);
}
