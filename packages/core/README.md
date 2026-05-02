# better-matrix-js

TypeScript Matrix SDK that runs in Node, Cloudflare Workers, browsers, and any WASM runtime. Built on `mautrix-go` + `goolm`, compiled to WebAssembly. E2EE included.

```sh
npm install better-matrix-js
```

## Node

```ts
import { FileMatrixStore, loadMatrixCoreFromNodePackage } from "better-matrix-js/node";

const core = await loadMatrixCoreFromNodePackage({
  host: { store: new FileMatrixStore(".matrix-store/my-account") },
});

await core.init({
  accessToken: process.env.MATRIX_ACCESS_TOKEN!,
  homeserverUrl: "https://matrix.example.org",
  recoveryKey: process.env.MATRIX_RECOVERY_KEY, // optional, enables E2EE
});

const { eventId } = await core.postMessage({
  roomId: "!room:example.org",
  body: "hello world",
});

await core.postReaction({ roomId: "!room:example.org", eventId, key: "👋" });
```

Drive incoming events with the built-in long poller:

```ts
import { startMatrixPolling } from "better-matrix-js";

const polling = startMatrixPolling(core, { timeoutMs: 30_000 });

core.onEvent((event) => {
  if (event.type === "message") console.log(event.message);
});

// later
await polling.stop();
```

## Cloudflare Workers

```ts
import "better-matrix-js/wasm_exec.js";
import wasmModule from "better-matrix-js/matrix-core.wasm";
import { loadMatrixCore } from "better-matrix-js";
import { createDurableObjectMatrixStore } from "@better-matrix-js/cloudflare";

const core = await loadMatrixCore({
  wasmModule,
  host: { store: createDurableObjectMatrixStore(state.storage) },
});

await core.init({ accessToken, homeserverUrl });
```

For sync, use `MatrixSyncDurableObject` from `@better-matrix-js/cloudflare` and forward the response into `core.applySyncResponse({ response, since })`. See [`examples/cloudflare-worker`](https://github.com/batuhan/better-matrix-js/tree/main/examples/cloudflare-worker).

## Browser / other runtimes

Pass any of `wasmModule`, `wasmBytes`, or `wasmUrl` to `loadMatrixCore()`, plus a `host.store` implementing the `MatrixKeyValueStore` interface (4 methods: `get`, `set`, `delete`, `list`).

## What it does

Login (password, token, JWT), `/sync` long polling, send/edit/delete messages, formatted HTML, mentions, replies, reactions, read receipts, threads, typing, media (encrypted upload/download), DMs, joined-room listing, invites, and the full mautrix E2EE pipeline (Olm/Megolm, cross-signing, key backup, recovery key).

## API surface

`MatrixCore` exposes everything as flat methods — `init`, `postMessage`, `editMessage`, `deleteMessage`, `postReaction`, `fetchMessages`, `fetchRoom`, `joinRoom`, `leaveRoom`, `inviteUser`, `openDM`, `uploadMedia`, `downloadMedia`, `applySyncResponse`, `syncOnce`, `close`, etc. All types are exported from the package root.

## License

MPL-2.0
