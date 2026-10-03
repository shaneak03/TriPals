// MapLibre v6 resolves its web worker relative to import.meta.url, which bundlers rewrite,
// so the worker (and the shared chunk it imports) is served from public/ instead.
// Runs before `dev` and `build`; the copies are gitignored and always match the installed version.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const dist = dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")) + "/dist";
const out = new URL("../public/maplibre/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
}
