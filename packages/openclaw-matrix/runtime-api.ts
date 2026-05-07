// Keep the external runtime API light so Jiti callers can resolve Matrix config
// helpers without traversing the full plugin-sdk/runtime graph or bootstrapping
// Pickle during plain runtime-api import.
export * from "./src/auth-precedence.js";
export {
  requiresExplicitMatrixDefaultAccount,
  resolveMatrixDefaultOrOnlyAccountId,
} from "./src/account-selection.js";
export * from "./src/account-selection.js";
export * from "./src/env-vars.js";
export * from "./src/storage-paths.js";
export { ensureMatrixSdkInstalled, isMatrixSdkAvailable } from "./src/matrix/deps.js";
export {
  assertHttpUrlTargetsPrivateNetwork,
  closeDispatcher,
  createPinnedDispatcher,
  resolvePinnedHostnameWithPolicy,
  ssrfPolicyFromDangerouslyAllowPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork,
  type LookupFn,
  type SsrFPolicy,
} from "openclaw/plugin-sdk/ssrf-runtime";
export {
  setMatrixThreadBindingIdleTimeoutBySessionKey,
  setMatrixThreadBindingMaxAgeBySessionKey,
} from "./src/matrix/thread-bindings-shared.js";
export { setMatrixRuntime } from "./src/runtime.js";
export { writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";
export type ChannelDirectoryEntry = any;
export type ChannelMessageActionContext = any;
export type OpenClawConfig = any;
export type PluginRuntime = any;
export type RuntimeLogger = any;
export type RuntimeEnv = any;
export type WizardPrompter = any;

export function formatZonedTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

export function chunkTextForOutbound(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const splitAt = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const breakAt = splitAt > 0 ? splitAt : limit;
    chunks.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining.length > 0 || text.length === 0) {
    chunks.push(remaining);
  }
  return chunks;
}
