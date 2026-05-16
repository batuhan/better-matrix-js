#!/usr/bin/env node
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createDefaultConfig, defaultConfigPath, readConfig, secretToken, writeConfig } from "./config";
import { createAppserviceRegistration } from "./registration";
import type { AppserviceRegistration, OpenClawBridgeConfig } from "./types";

export interface CliIO {
  stderr: Pick<typeof process.stderr, "write">;
  stdout: Pick<typeof process.stdout, "write">;
}

export async function runCli(argv = process.argv.slice(2), io: CliIO = process): Promise<number> {
  const [command, ...args] = argv;
  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      io.stdout.write(helpText());
      return 0;
    }
    if (command === "init") {
      const options = parseOptions(args);
      const config = createDefaultConfig(configOverridesFromOptions(options));
      await writeConfig(config, stringOption(options, "config") ?? defaultConfigPath(config.dataDir));
      io.stdout.write(`${JSON.stringify(redactConfig(config), null, 2)}\n`);
      return 0;
    }
    if (command === "register") {
      const options = parseOptions(args);
      const config = await loadConfig(options);
      const registration = createAppserviceRegistration(config, {
        asToken: stringOption(options, "as-token") ?? secretToken(),
        hsToken: stringOption(options, "hs-token") ?? secretToken(),
      });
      const output = stringOption(options, "output") ?? resolve(config.dataDir, "registration.json");
      await writeRegistration(output, registration);
      io.stdout.write(`${output}\n`);
      return 0;
    }
    if (command === "status") {
      const config = await loadConfig(parseOptions(args));
      io.stdout.write(`${JSON.stringify(redactConfig(config), null, 2)}\n`);
      return 0;
    }
    io.stderr.write(`Unknown command: ${command}\n\n${helpText()}`);
    return 2;
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

export async function writeRegistration(path: string, registration: AppserviceRegistration): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(registration, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

function helpText(): string {
  return [
    "pickle-openclaw <command>",
    "",
    "Commands:",
    "  init       Write a secure OpenClaw bridge config",
    "  register   Write a Matrix appservice registration file",
    "  status     Print the redacted effective config",
    "",
    "Common options:",
    "  --config <path>",
    "  --data-dir <path>",
    "  --homeserver <url>",
    "  --gateway-url <url>",
    "  --registration-url <url>",
    "  --access-token <token>",
    "  --hs-token <token>",
    "  --as-token <token>",
    "  --output <path>",
    "",
  ].join("\n");
}

function configOverridesFromOptions(options: Map<string, string | boolean>): Partial<OpenClawBridgeConfig> {
  const overrides: Partial<OpenClawBridgeConfig> = {};
  const accessToken = stringOption(options, "access-token");
  const appserviceId = stringOption(options, "appservice-id");
  const dataDir = stringOption(options, "data-dir");
  const gatewayUrl = stringOption(options, "gateway-url");
  const homeserver = stringOption(options, "homeserver");
  const registrationUrl = stringOption(options, "registration-url");
  if (accessToken) overrides.accessToken = accessToken;
  if (appserviceId) overrides.appserviceId = appserviceId;
  if (dataDir) overrides.dataDir = dataDir;
  if (gatewayUrl) overrides.gatewayUrl = gatewayUrl;
  if (homeserver) overrides.homeserver = homeserver;
  if (registrationUrl) overrides.registrationUrl = registrationUrl;
  return overrides;
}

async function loadConfig(options: Map<string, string | boolean>): Promise<OpenClawBridgeConfig> {
  const configPath = stringOption(options, "config");
  if (configPath) return readConfig(configPath);
  return createDefaultConfig(configOverridesFromOptions(options));
}

function redactConfig(config: OpenClawBridgeConfig): OpenClawBridgeConfig {
  return {
    ...config,
    ...(config.accessToken ? { accessToken: "<redacted>" } : {}),
    ...(config.hsToken ? { hsToken: "<redacted>" } : {}),
  };
}

function parseOptions(args: string[]): Map<string, string | boolean> {
  const options = new Map<string, string | boolean>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options.set(key, true);
      continue;
    }
    options.set(key, next);
    index += 1;
  }
  return options;
}

function stringOption(options: Map<string, string | boolean>, key: string): string | undefined {
  const value = options.get(key);
  return typeof value === "string" ? value : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
