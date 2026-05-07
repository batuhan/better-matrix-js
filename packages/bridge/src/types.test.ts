import { describe, expect, it } from "vitest";
import type {
  BackfillingNetworkAPI,
  BridgeConnector,
  BridgeContext,
  BridgeRequestContext,
  LoginProcess,
  MatrixMessage,
  MessageHandlingNetworkAPI,
  RemoteEdit,
  RemoteMessage,
  UserLogin,
} from "./types";

describe("bridge type patterns", () => {
  it("accepts golden bridge connector and network shapes", () => {
    class GoldenLogin implements LoginProcess {
      cancel(): void {}
      async start() {
        return { instructions: "done", stepId: "done", type: "complete" as const };
      }
    }

    class GoldenNetwork implements MessageHandlingNetworkAPI, BackfillingNetworkAPI {
      connect(): void {}
      disconnect(): void {}
      async fetchMessages() {
        return { messages: [] };
      }
      async handleMatrixMessage(_ctx: BridgeRequestContext, msg: MatrixMessage) {
        return { db: { id: msg.event.eventId, mxid: msg.event.eventId } };
      }
    }

    const connector = {
      createLogin: () => new GoldenLogin(),
      getBridgeInfoVersion: () => ({ capabilities: 1, info: 1 }),
      getCapabilities: () => ({ native: true }),
      getConfig: () => ({ data: { enabled: true } }),
      getDBMetaTypes: () => ({}),
      getLoginFlows: () => [{ description: "Golden", id: "golden", name: "Golden" }],
      getName: () => ({ displayName: "Golden", networkId: "golden" }),
      init: (_ctx: BridgeContext) => {},
      loadUserLogin: (_ctx: BridgeRequestContext, _login: UserLogin) => new GoldenNetwork(),
      start: (_ctx: BridgeContext) => {},
    } satisfies BridgeConnector<{ enabled: boolean }>;

    const remoteMessage = {
      convertMessage: async () => ({ parts: [{ content: { body: "hello", msgtype: "m.text" }, type: "m.room.message" }] }),
      getID: () => "message",
      getPortalKey: () => ({ id: "portal", receiver: "login" }),
      getSender: () => ({ isFromMe: false, sender: "@alice:example" }),
      getType: () => "message" as const,
    } satisfies RemoteMessage;

    const remoteEdit = {
      convertEdit: async () => ({ modifiedParts: [{ content: { body: "edit", msgtype: "m.text" }, type: "m.room.message" }] }),
      getPortalKey: () => ({ id: "portal", receiver: "login" }),
      getSender: () => ({ isFromMe: false, sender: "@alice:example" }),
      getTargetMessage: () => "message",
      getType: () => "edit" as const,
    } satisfies RemoteEdit;

    expect(connector.getName().networkId).toBe("golden");
    expect(remoteMessage.getID()).toBe("message");
    expect(remoteEdit.getTargetMessage()).toBe("message");
  });
});
