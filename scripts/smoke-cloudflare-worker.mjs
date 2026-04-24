import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootPath = new URL("..", import.meta.url).pathname;
const temp = await mkdtemp(join(tmpdir(), "better-matrix-js-worker-"));
const packDir = join(temp, "packs");
const workerDir = join(temp, "worker");
const srcDir = join(workerDir, "src");

await mkdir(packDir, { recursive: true });
await execFileAsync("pnpm", ["-r", "--filter", "better-matrix-js", "pack", "--pack-destination", packDir], {
  cwd: rootPath,
});
await mkdir(srcDir, { recursive: true });
await execFileAsync("npm", ["init", "-y"], { cwd: workerDir });
await execFileAsync("npm", ["install", join(packDir, "better-matrix-js-0.1.0.tgz")], {
  cwd: workerDir,
});

await writeFile(
  join(srcDir, "index.js"),
  `
import "better-matrix-js/wasm_exec.js";
import wasmModule from "better-matrix-js/matrix-core.wasm";
import { MemoryMatrixStore, loadMatrixCore } from "better-matrix-js";

let corePromise;

export default {
  async fetch() {
    corePromise ??= loadMatrixCore({
      wasmModule,
      host: { store: new MemoryMatrixStore() },
    });
    const core = await corePromise;
    return Response.json({ ok: Boolean(core) });
  },
};
`.trimStart()
);

await writeFile(
  join(workerDir, "wrangler.jsonc"),
  JSON.stringify(
    {
      name: "better-matrix-js-smoke",
      main: "src/index.js",
      compatibility_date: "2026-04-24",
    },
    null,
    2
  )
);

const { stdout } = await execFileAsync(
  "npx",
  ["--yes", "wrangler@latest", "deploy", "--dry-run", "--outdir", "bundled"],
  { cwd: workerDir }
);
console.log(stdout.trim());

if (process.env.CI) {
  console.log("Skipping local Worker HTTP boot in CI after successful Wrangler dry run.");
  process.exit(0);
}

const wrangler = spawn(
  "npx",
  ["--yes", "wrangler@latest", "dev", "--local", "--ip", "127.0.0.1", "--port", "8791"],
  { cwd: workerDir, stdio: ["pipe", "pipe", "pipe"] }
);

let output = "";
wrangler.stdout.on("data", (chunk) => {
  output += chunk;
});
wrangler.stderr.on("data", (chunk) => {
  output += chunk;
});

const response = await waitForHttp("http://127.0.0.1:8791/", 30_000);
const body = await response.text();
wrangler.kill("SIGTERM");
await waitForExit(wrangler);

if (!response.ok || body !== '{"ok":true}') {
  throw new Error(`Unexpected Worker response ${response.status}: ${body}`);
}

console.log(body);

async function waitFor(predicate, timeoutMs) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      wrangler.kill("SIGTERM");
      throw new Error(`Timed out waiting for Worker dev server:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started <= timeoutMs) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  wrangler.kill("SIGTERM");
  throw new Error(`Timed out waiting for Worker HTTP server: ${lastError}\n${output}`);
}

async function waitForExit(child) {
  await new Promise((resolve, reject) => {
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else if (code === null) {
        resolve();
      } else {
        reject(new Error(`wrangler dev exited with ${code}:\n${output}`));
      }
    });
  });
}
