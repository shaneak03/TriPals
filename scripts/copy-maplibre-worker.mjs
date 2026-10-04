// MapLibre v6 resolves its web worker relative to import.meta.url, which bundlers rewrite,
// so the worker (and the shared chunk it imports) is served from public/ instead.
// Runs before `dev` and `build`; the copies are gitignored and always match the installed version.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const dist = dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")) + "/dist";

// Use fileURLToPath instead of .pathname to strip the leading slash on Windows
const out = fileURLToPath(new URL("../public/maplibre/", import.meta.url));

mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
}