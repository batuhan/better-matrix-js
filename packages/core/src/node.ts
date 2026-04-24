import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import { loadMatrixCore, type LoadMatrixCoreOptions, type MatrixWasmCore } from "./wasm";
import type { MatrixKeyValueStore } from "./types";

export interface LoadMatrixCoreFromNodeOptions extends Omit<LoadMatrixCoreOptions, "wasmUrl"> {
  wasmExecPath?: string;
  wasmPath?: string;
}

export async function loadMatrixCoreFromNodePackage(
  options: LoadMatrixCoreFromNodeOptions = {}
): Promise<MatrixWasmCore> {
  const { wasmExecPath, wasmPath, ...coreOptions } = options;
  const distDir = dirname(fileURLToPath(import.meta.url));

  if (!coreOptions.go && !globalThis.Go) {
    const runtimePath = wasmExecPath ?? join(distDir, "wasm_exec.js");
    runInThisContext(await readFile(runtimePath, "utf8"), { filename: runtimePath });
  }

  if (!coreOptions.wasmBytes && !coreOptions.wasmModule) {
    coreOptions.wasmBytes = await readFile(wasmPath ?? join(distDir, "matrix-core.wasm"));
  }

  return loadMatrixCore(coreOptions);
}

export class FileMatrixStore implements MatrixKeyValueStore {
  readonly #dir: string;
  #index: Map<string, string> | null = null;

  constructor(dir: string) {
    this.#dir = dir;
  }

  async delete(key: string): Promise<void> {
    const index = await this.#loadIndex();
    const filename = index.get(key);
    if (!filename) {
      return;
    }
    index.delete(key);
    await rm(join(this.#dir, filename), { force: true });
    await this.#saveIndex(index);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const index = await this.#loadIndex();
    const filename = index.get(key);
    if (!filename) {
      return null;
    }
    try {
      return new Uint8Array(await readFile(join(this.#dir, filename)));
    } catch (error) {
      if (isNodeENOENT(error)) {
        return null;
      }
      throw error;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const index = await this.#loadIndex();
    return [...index.keys()].filter((key) => key.startsWith(prefix));
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    const index = await this.#loadIndex();
    const filename = index.get(key) ?? keyToFilename(key);
    index.set(key, filename);
    await mkdir(this.#dir, { recursive: true });
    await writeFile(join(this.#dir, filename), value);
    await this.#saveIndex(index);
  }

  async #loadIndex(): Promise<Map<string, string>> {
    if (this.#index) {
      return this.#index;
    }
    try {
      const raw = await readFile(join(this.#dir, "index.json"), "utf8");
      this.#index = new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
    } catch (error) {
      if (!isNodeENOENT(error)) {
        throw error;
      }
      this.#index = new Map();
    }
    return this.#index;
  }

  async #saveIndex(index: Map<string, string>): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    await writeFile(
      join(this.#dir, "index.json"),
      JSON.stringify(Object.fromEntries(index), null, 2)
    );
  }
}

export function createFileMatrixStore(dir: string): FileMatrixStore {
  return new FileMatrixStore(dir);
}

function keyToFilename(key: string): string {
  return `${createHash("sha256").update(key).digest("base64url")}.bin`;
}

function isNodeENOENT(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
