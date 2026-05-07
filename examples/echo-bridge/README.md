# Echo Bridge

Minimal `@beeper/pickle-bridge` connector that echoes Matrix messages back into
the same portal as remote messages.

```ts
import { createBridge } from "@beeper/pickle-bridge/node";
import type {
  BridgeConnector,
  BridgeContext,
  BridgeRequestContext,
  MatrixMessage,
  NetworkAPI,
  UserLogin,
} from "@beeper/pickle-bridge/types";

class EchoConnector implements BridgeConnector {
  createLogin() {
    return {
      cancel() {},
      async start() {
        return {
          complete: { userLoginId: "echo" },
          instructions: "Echo login created.",
          stepId: "complete",
          type: "complete" as const,
        };
      },
    };
  }

  getBridgeInfoVersion() {
    return { capabilities: 1, info: 1 };
  }

  getCapabilities() {
    return { native: true };
  }

  getConfig() {
    return {};
  }

  getDBMetaTypes() {
    return {};
  }

  getLoginFlows() {
    return [{ description: "Create an echo login.", id: "echo", name: "Echo" }];
  }

  getName() {
    return { defaultCommandPrefix: "echo", displayName: "Echo Bridge", networkId: "echo" };
  }

  init(_ctx: BridgeContext) {}
  start(_ctx: BridgeContext) {}
  loadUserLogin(_ctx: BridgeRequestContext, login: UserLogin) {
    return new EchoNetwork(login);
  }
}

class EchoNetwork implements NetworkAPI {
  constructor(readonly login: UserLogin) {}
  connect() {}
  disconnect() {}

  async handleMatrixMessage(ctx: BridgeRequestContext, msg: MatrixMessage) {
    ctx.queue(this.login).message({
      id: `echo-${msg.event.eventId}`,
      portal: msg.portal,
      sender: { isFromMe: false, sender: ctx.bridge.ghostUserId("echo") },
      text: `echo: ${msg.text}`,
    });
    return { db: { id: msg.event.eventId, mxid: msg.event.eventId } };
  }
}

const bridge = createBridge({
  connector: new EchoConnector(),
  matrix: {
    homeserver: process.env.MATRIX_HOMESERVER!,
    store: /* your MatrixStore */,
    token: process.env.MATRIX_TOKEN!,
  },
});

await bridge.start();
await bridge.loadUserLogin({ id: "echo" });
```
