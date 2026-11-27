// Builds the read-only static demo into ./out (published to GitHub Pages by .github/workflows/pages.yml).
// Usage: node scripts/build-demo.mjs [basePath]   e.g. node scripts/build-demo.mjs /open-social-listening
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const basePath = process.argv[2] ?? "";
if (basePath && !/^\/[\w-]+$/.test(basePath)) {
  console.error(`basePath must look like /name, got ${basePath}`);
  process.exit(1);
}

const env = { ...process.env, OSL_STATIC_DEMO: "1", OSL_BASE_PATH: basePath, OSL_DISABLE_SCHEDULER: "1" };
delete env.SOCQ_API_KEY;
const build = spawnSync("npx", ["next", "build"], { stdio: "inherit", env, shell: process.platform === "win32" });
if (build.status !== 0) process.exit(build.status ?? 1);

// sql.js runs in the browser from a plain script and its .wasm file (see lib/demo/static-bootstrap.ts).
const sqlJsDir = dirname(createRequire(import.meta.url).resolve("sql.js/dist/sql-wasm.js"));
mkdirSync("out/sql", { recursive: true });
for (const file of ["sql-wasm.js", "sql-wasm.wasm"]) copyFileSync(join(sqlJsDir, file), join("out/sql", file));
// Pages must not run Jekyll over the export, or it drops the _next folder.
writeFileSync("out/.nojekyll", "");
console.log(`Static demo written to ./out${basePath ? ` (served under ${basePath})` : ""}.`);
