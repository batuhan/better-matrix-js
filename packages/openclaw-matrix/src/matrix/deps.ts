import { createRequire } from "node:module";
import type { RuntimeEnv } from "../runtime-api.js";

const REQUIRED_MATRIX_PACKAGES = ["@beeper/pickle"];

function resolveMissingMatrixPackages(): string[] {
  try {
    const req = createRequire(import.meta.url);
    return REQUIRED_MATRIX_PACKAGES.filter((pkg) => {
      try {
        req.resolve(pkg);
        return false;
      } catch {
        return true;
      }
    });
  } catch {
    return [...REQUIRED_MATRIX_PACKAGES];
  }
}

export function isMatrixSdkAvailable(): boolean {
  return resolveMissingMatrixPackages().length === 0;
}

export async function ensureMatrixCryptoRuntime(): Promise<void> {}

export async function ensureMatrixSdkInstalled(params: {
  runtime: RuntimeEnv;
  confirm?: (message: string) => Promise<boolean>;
}): Promise<void> {
  if (isMatrixSdkAvailable()) return;
  params.runtime.log?.("matrix: @beeper/pickle is required by the Pickle-backed Matrix plugin");
  throw new Error("Matrix requires @beeper/pickle (install plugin dependencies first).");
}
