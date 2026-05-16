import type { BridgeRequestContext, MatrixMessage, MatrixReaction, UserLogin } from "@beeper/pickle-bridge";
import { describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "./config";
import { createOpenClawConnector, OpenClawNetworkAPI } from "./connector";
import { OpenClawGatewayRuntime, type OpenClawGatewayEvent, type OpenClawTransport } from "./openclaw-runtime";
import { OpenClawBridgeRegistry } from "./registry";

describe("OpenClawBridgeConnector", () => {
  it("exposes bridgev2-shaped metadata, capabilities, and login flow", async () => {
    const connector = createOpenClawConnector({
      config: createDefaultConfig({ dataDir: "/tmp/openclaw", gatewayUrl: "ws://gateway" }),
    });
    expect(connector.getName()).toMatchObject({
      beeperBridgeType: "openclaw",
      defaultCommandPrefix: "!openclaw",
      displayName: "OpenClaw",
      networkId: "openclaw",
    });
    expect(connector.getCapabilities().provisioning?.resolveIdentifier).toEqual({
      contactList: true,
      createDM: true,
      lookupUsername: true,
    });
    expect(connector.getLoginFlows()).toEqual([
      {
        description: "Connect to an existing OpenClaw gateway by URL and optional bearer token.",
        id: "openclaw.gateway",
        name: "OpenClaw Gateway",
      },
    ]);

    const process = connector.createLogin({} as BridgeRequestContext, { id: "@alice:example.com" }, "openclaw.gateway");
    await expect(process.start()).resolves.toMatchObject({
      stepId: "openclaw.gateway.credentials",
      type: "user_input",
    });
    await expect(
      "submitUserInput" in process
        ? process.submitUserInput({ access_token: "token", gateway_url: "ws://gateway" })
        : undefined
    ).resolves.toMatchObject({
      complete: {
        userLogin: {
          metadata: {
            accessToken: "token",
            gatewayUrl: "ws://gateway",
          },
          remoteName: "OpenClaw",
          userId: "@alice:example.com",
        },
      },
      type: "complete",
    });
  });

  it("loads a network API that registers OpenClaw agents as ghosts", async () => {
    const registry = new OpenClawBridgeRegistry("/tmp/openclaw-connector-test.json");
    const runtime = runtimeWith({
      responses: { "agents.list": { agents: [{ id: "codex", name: "Codex" }] } },
    });
    const api = new OpenClawNetworkAPI({
      config: createDefaultConfig({ dataDir: "/tmp/openclaw" }),
      login: login(),
      registry,
      runtime,
      streams: { publish: vi.fn() },
    });
    const registerGhost = vi.fn();
    await api.connect({ bridge: { registerGhost }, queue: vi.fn(), queueRemoteEvent: vi.fn() } as unknown as Parameters<typeof api.connect>[0]);
    expect(registerGhost).toHaveBeenCalledWith({
      displayName: "Codex",
      id: "codex",
      metadata: {
        openclaw: {
          agentId: "codex",
          displayName: "Codex",
          ghostUserId: "@openclaw_agent_codex:localhost",
        },
      },
      mxid: "@openclaw_agent_codex:localhost",
    });
  });

  it("resolves agent identifiers into DM portals", async () => {
    const registry = new OpenClawBridgeRegistry("/tmp/openclaw-connector-test.json");
    registry.upsertAgent({ agentId: "codex", displayName: "Codex", ghostUserId: "@codex:example.com" });
    const api = new OpenClawNetworkAPI({
      config: createDefaultConfig({ dataDir: "/tmp/openclaw" }),
      login: login(),
      registry,
      runtime: runtimeWith({ responses: {} }),
      streams: { publish: vi.fn() },
    });
    await expect(api.resolveIdentifier({} as BridgeRequestContext, {
      createDM: true,
      identifier: "codex",
      type: "username",
    })).resolves.toEqual({
      ghost: {
        displayName: "Codex",
        id: "codex",
        metadata: {
          openclaw: {
            agentId: "codex",
            displayName: "Codex",
            ghostUserId: "@codex:example.com",
          },
        },
        mxid: "@codex:example.com",
      },
      portal: {
        id: "agent:codex",
        metadata: {
          openclaw: {
            agentId: "codex",
            ghostUserId: "@codex:example.com",
            sessionKey: "agent:codex",
          },
        },
        portalKey: { id: "agent:codex", receiver: "login" },
        receiver: "login",
        roomType: "dm",
      },
      userId: "@codex:example.com",
    });
  });

  it("dispatches Matrix text and approval reactions to OpenClaw", async () => {
    const registry = new OpenClawBridgeRegistry("/tmp/openclaw-connector-test.json");
    const runtime = runtimeWith({
      events: [{ event: "run.completed", payload: { runId: "run_1", type: "run.completed" } }],
      responses: {
        "exec.approval.resolve": { ok: true },
        "sessions.create": { key: "agent:codex:session_1" },
        "sessions.send": { runId: "run_1", sessionKey: "agent:codex:session_1" },
      },
    });
    const api = new OpenClawNetworkAPI({
      config: createDefaultConfig({ dataDir: "/tmp/openclaw" }),
      login: login(),
      registry,
      runtime,
      streams: { publish: vi.fn() },
    });
    const portal = {
      id: "agent:codex",
      metadata: {
        openclaw: {
          agentId: "codex",
          ghostUserId: "@codex:example.com",
          sessionKey: "agent:codex",
        },
      },
      mxid: "!room:example.com",
      portalKey: { id: "agent:codex", receiver: "login" },
      receiver: "login",
    };

    await expect(api.handleMatrixMessage({} as BridgeRequestContext, {
      event: { eventId: "$message" },
      portal,
      sender: { userId: "@alice:example.com" },
      text: "hello",
    } as MatrixMessage)).resolves.toEqual({ pending: false });
    expect(runtime.transport.request).toHaveBeenCalledWith("sessions.send", {
      idempotencyKey: "$message",
      key: "agent:codex:session_1",
      message: "hello",
    }, { expectFinal: true });

    await expect(api.handleMatrixReaction({} as BridgeRequestContext, {
      content: {
        "m.relates_to": { event_id: "approval_1", key: "approval.deny" },
      },
      event: { eventId: "$reaction" },
      portal,
      targetMessage: { id: "approval_1" },
    } as MatrixReaction)).resolves.toEqual({
      id: "$reaction",
      metadata: {
        openclaw: {
          approval: {
            approvalId: "approval_1",
            approved: false,
            approvedAlways: false,
            decision: "deny",
          },
        },
      },
    });
    expect(runtime.transport.request).toHaveBeenCalledWith("exec.approval.resolve", {
      approvalId: "approval_1",
      decision: "deny",
    });
  });

  it("fetches OpenClaw chat history for Pickle backfill", async () => {
    const registry = new OpenClawBridgeRegistry("/tmp/openclaw-connector-test.json");
    const runtime = runtimeWith({
      responses: {
        "chat.history": {
          messages: [
            { content: "hello", id: "m1", messageSeq: 1, role: "user" },
            { content: "hi", id: "m2", messageSeq: 2, role: "assistant" },
          ],
        },
      },
    });
    const api = new OpenClawNetworkAPI({
      config: createDefaultConfig({ dataDir: "/tmp/openclaw" }),
      login: login(),
      registry,
      runtime,
      streams: { publish: vi.fn() },
    });
    const portal = {
      id: "agent:codex",
      metadata: {
        openclaw: {
          agentId: "codex",
          ghostUserId: "@codex:example.com",
          sessionKey: "agent:codex",
        },
      },
      mxid: "!room:example.com",
      portalKey: { id: "agent:codex", receiver: "login" },
      receiver: "login",
    };

    const response = await api.fetchMessages({} as BridgeRequestContext, { limit: 2, portal });
    expect(response.hasMore).toBe(false);
    expect(response.messages).toHaveLength(2);
    expect(response.messages.map((message) => message.event.getID())).toEqual(["m1", "m2"]);
    expect(response.messages.map((message) => message.event.getSender().sender)).toEqual(["login:human", "codex"]);
    expect(runtime.transport.request).toHaveBeenCalledWith("chat.history", {
      limit: 2,
      sessionKey: "agent:codex",
    });
  });
});

function login(): UserLogin {
  return { id: "login", metadata: { gatewayUrl: "ws://gateway" }, userId: "@alice:example.com" };
}

function runtimeWith(options: {
  events?: OpenClawGatewayEvent[];
  responses: Record<string, unknown>;
}): OpenClawGatewayRuntime & { transport: OpenClawTransport & { request: ReturnType<typeof vi.fn> } } {
  const transport = {
    async *events(filter?: (event: OpenClawGatewayEvent) => boolean) {
      for (const event of options.events ?? []) {
        if (!filter || filter(event)) yield event;
      }
    },
    request: vi.fn(async (method: string) => options.responses[method]),
  };
  return new OpenClawGatewayRuntime({
    config: createDefaultConfig({ dataDir: "/tmp/openclaw" }),
    transport,
  }) as OpenClawGatewayRuntime & { transport: OpenClawTransport & { request: ReturnType<typeof vi.fn> } };
}
