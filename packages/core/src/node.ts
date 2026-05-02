import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import { loadMatrixCore, type LoadMatrixCoreOptions, type MatrixWasmCore } from "./wasm";

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
