import type { BridgeConfigPart, BridgeConnector } from "./types";

export interface BridgeConfigLoadResult<T = unknown> {
  config: T;
  example?: string;
  upgraded: boolean;
}

export function loadBridgeConfig<T>(part: BridgeConfigPart<T>, input?: unknown): BridgeConfigLoadResult<T> {
  const hasInput = input !== undefined;
  if (hasInput && part.upgrade) {
    return withExample({
      config: part.upgrade(input),
      upgraded: true,
    }, part.example);
  }
  if (hasInput) {
    return withExample({
      config: input as T,
      upgraded: false,
    }, part.example);
  }
  return withExample({
    config: part.data as T,
    upgraded: false,
  }, part.example);
}

export function loadConnectorConfig<T>(connector: Pick<BridgeConnector<T>, "getConfig">, input?: unknown): BridgeConfigLoadResult<T> {
  return loadBridgeConfig(connector.getConfig(), input);
}

function withExample<T>(result: Omit<BridgeConfigLoadResult<T>, "example">, example: string | undefined): BridgeConfigLoadResult<T> {
  return example === undefined ? result : { ...result, example };
}
