import { describe, expect, it, vi } from "vitest";
import { buildBackfillImport, discoverOneToOneSessions, isOneToOneSession } from "./backfill";
import { createDefaultConfig } from "./config";
import { OpenClawGatewayRuntime, type OpenClawTransport } from "./openclaw-runtime";

describe("OpenClaw backfill", () => {
  it("discovers terminal, mac app, and DM-like sessions while skipping group sessions", async () => {
    const runtime = runtimeWith({
      "sessions.list": {
        sessions: [
          { key: "agent:main:terminal:local", origin: { surface: "terminal" } },
          { key: "agent:main:desktop:abc", origin: { surface: "mac-app" } },
          { chatType: "dm", key: "agent:main:whatsapp:user-1", lastTo: "user-1" },
          { chatType: "group", key: "agent:main:whatsapp:group-1", lastTo: "a,b" },
        ],
      },
    });

    await expect(discoverOneToOneSessions(runtime)).resolves.toEqual([
      {
        agentId: "main",
        label: "agent:main:terminal:local",
        session: { key: "agent:main:terminal:local", origin: { surface: "terminal" } },
        sessionKey: "agent:main:terminal:local",
        source: "terminal",
      },
      {
        agentId: "main",
        label: "agent:main:desktop:abc",
        session: { key: "agent:main:desktop:abc", origin: { surface: "mac-app" } },
        sessionKey: "agent:main:desktop:abc",
        source: "mac-app",
      },
      {
        agentId: "main",
        label: "agent:main:whatsapp:user-1",
        session: { chatType: "dm", key: "agent:main:whatsapp:user-1", lastTo: "user-1" },
        sessionKey: "agent:main:whatsapp:user-1",
        source: "unknown",
      },
    ]);
  });

  it("builds import bindings and normalized Matrix backfill messages", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00.000Z"));
    const runtime = runtimeWith({
      "chat.history": {
        messages: [
          { content: "hello", id: "m1", messageSeq: 1, role: "user" },
          { content: [{ text: "hi" }], id: "m2", messageSeq: 2, role: "assistant" },
        ],
      },
    });
    try {
      await expect(buildBackfillImport(runtime, createDefaultConfig({ dataDir: "/tmp/openclaw" }), {
        agentId: "main",
        label: "Terminal",
        session: { key: "agent:main:terminal:local" },
        sessionKey: "agent:main:terminal:local",
        source: "terminal",
      }, {
        limit: 50,
        roomId: "!room:example.com",
      })).resolves.toMatchObject({
        binding: {
          agentId: "main",
          ghostUserId: "@openclaw_agent_main:localhost",
          label: "Terminal",
          owner: "imported",
          roomId: "!room:example.com",
          sessionKey: "agent:main:terminal:local",
        },
        messages: [
          {
            content: {
              body: "hello",
              msgtype: "m.notice",
              "com.beeper.openclaw.backfill": { messageSeq: 1, role: "user" },
            },
            id: "m1",
            role: "user",
            sender: "human",
            seq: 1,
          },
          {
            content: {
              body: "hi",
              msgtype: "m.text",
              "com.beeper.openclaw.backfill": { messageSeq: 2, role: "assistant" },
            },
            id: "m2",
            role: "assistant",
            sender: "agent",
            seq: 2,
          },
        ],
        source: "terminal",
      });
      expect(runtime.transport.request).toHaveBeenCalledWith("chat.history", {
        limit: 50,
        sessionKey: "agent:main:terminal:local",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("classifies one-to-one sessions conservatively", () => {
    expect(isOneToOneSession({ chatType: "direct", key: "agent:main:direct:user" })).toBe(true);
    expect(isOneToOneSession({ key: "agent:main:whatsapp:user", lastTo: "user" })).toBe(true);
    expect(isOneToOneSession({ chatType: "group", key: "agent:main:group", lastTo: "a,b" })).toBe(false);
  });
});

function runtimeWith(responses: Record<string, unknown>): OpenClawGatewayRuntime & {
  transport: OpenClawTransport & { request: ReturnType<typeof vi.fn> };
} {
  const transport = {
    async *events() {},
    request: vi.fn(async (method: string) => responses[method]),
  };
  return new OpenClawGatewayRuntime({
    config: createDefaultConfig({ dataDir: "/tmp/openclaw" }),
    transport,
  }) as OpenClawGatewayRuntime & { transport: OpenClawTransport & { request: ReturnType<typeof vi.fn> } };
}
