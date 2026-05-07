import { ConsoleLogger, LogService, setMatrixConsoleLogging } from "../sdk/logger.js";

let matrixSdkLogMode: "default" | "quiet" = "default";
const baseLogger = new ConsoleLogger();

export function ensureMatrixSdkLoggingConfigured(): void {
  applyLogger();
}

export function setMatrixSdkLogMode(mode: "default" | "quiet"): void {
  matrixSdkLogMode = mode;
  applyLogger();
}

export function setMatrixSdkConsoleLogging(enabled: boolean): void {
  setMatrixConsoleLogging(enabled);
}

export function createMatrixJsSdkClientLogger(prefix = "matrix") {
  const log = (method: keyof ConsoleLogger, ...messageOrObject: unknown[]): void => {
    if (matrixSdkLogMode === "quiet") return;
    (baseLogger[method] as (module: string, ...args: unknown[]) => void)(prefix, ...messageOrObject);
  };
  return {
    trace: (...messageOrObject: unknown[]) => log("trace", ...messageOrObject),
    debug: (...messageOrObject: unknown[]) => log("debug", ...messageOrObject),
    info: (...messageOrObject: unknown[]) => log("info", ...messageOrObject),
    warn: (...messageOrObject: unknown[]) => log("warn", ...messageOrObject),
    error: (...messageOrObject: unknown[]) => log("error", ...messageOrObject),
    getChild: (namespace: string) =>
      createMatrixJsSdkClientLogger(namespace.trim() ? `${prefix}.${namespace.trim()}` : prefix),
  };
}

function applyLogger(): void {
  if (matrixSdkLogMode === "quiet") {
    LogService.setLogger({
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    });
    return;
  }
  LogService.setLogger({
    trace: (module, ...args) => baseLogger.trace(module, ...args),
    debug: (module, ...args) => baseLogger.debug(module, ...args),
    info: (module, ...args) => baseLogger.info(module, ...args),
    warn: (module, ...args) => baseLogger.warn(module, ...args),
    error: (module, ...args) => baseLogger.error(module, ...args),
  });
}
