# better-matrix-js

Experimental monorepo for a TypeScript Matrix SDK and a Chat SDK adapter.

Packages:

- `better-matrix-js`: Matrix core for Node, Cloudflare Workers, browsers, and other WebAssembly runtimes.
- `@better-matrix-js/chat-adapter`: Chat SDK adapter built on top of the core package.

The core package uses Matrix terminology and exposes room/message/relation APIs. The adapter translates those APIs into Chat SDK terminology.

## Runtime

The Matrix core is Go compiled to `GOOS=js GOARCH=wasm`, built directly on `mautrix-go` with `goolm` for E2EE. It does not use `matrix-js-sdk`, Rust crypto binaries, a sidecar process, or Node FFI.

Durable state is provided by a small host key/value interface. The repo includes:

- Node file storage via `better-matrix-js/node`
- Cloudflare KV storage via `better-matrix-js/cloudflare`
- Cloudflare Durable Object storage via `better-matrix-js/cloudflare`

## Install

```sh
pnpm install
pnpm build
```

The build emits `matrix-core.wasm` and Go's `wasm_exec.js` in the core package dist.

## Node Usage

```ts
import {
  FileMatrixStore,
  loadMatrixCoreFromNodePackage,
} from "better-matrix-js/node";
import { createMatrixAdapter } from "@better-matrix-js/chat-adapter";

const core = await loadMatrixCoreFromNodePackage({
  host: {
    store: new FileMatrixStore(".matrix-store/my-account"),
  },
});

const adapter = createMatrixAdapter({
  accessToken,
  core,
  homeserverUrl: "https://matrix.example.org",
  recoveryCode,
});
```

## Worker Usage

Pass a Go runtime plus `wasmModule`, `wasmBytes`, or `wasmUrl` to `createMatrixAdapter()` or `loadMatrixCore()`. On Cloudflare Workers, use `createCloudflareKVMatrixStore()` or `createDurableObjectMatrixStore()` as the host store.

## Implemented

- Access-token initialization; `whoami` derives Matrix `userId` and `deviceId`.
- Password login and token/JWT login helpers.
- `/sync` long polling with durable next-batch storage.
- Mautrix E2EE pipeline: state-store sync, to-device processing, Olm/Megolm init, encrypted send/receive, recovery-code/passphrase verification, cross-signing restore, and key-backup download.
- Matrix messages: send, edit, delete, fetch one, fetch room history, fetch thread history, formatted HTML, mentions, replies, and read receipts.
- Matrix reactions, including redaction/removal events.
- Matrix rooms: room info, direct messages, join, leave, invite, joined-room listing, typing state, and invite auto-join in the Chat SDK adapter.
- Matrix media: upload/download, encrypted upload/download, media message send, and Chat SDK attachment rehydration.
- Matrix room threads via `m.thread` relations and `GET /_matrix/client/v1/rooms/{roomId}/threads`.
- Chat SDK adapter methods for message post/edit/delete, reactions, typing, message fetch, channel fetch, room-thread listing, DMs, slash commands, formatted rendering, attachments, and Matrix-backed thread IDs.

## Live E2E

The committed live test harness uses only environment-provided Matrix credentials. It does not create accounts.

Required:

```sh
MATRIX_HOMESERVER_URL=https://matrix.example.org
MATRIX_BOT_ACCESS_TOKEN=...
MATRIX_PEER_ACCESS_TOKEN=...
```

Optional:

```sh
MATRIX_BOT_RECOVERY_KEY=...
MATRIX_PEER_RECOVERY_KEY=...
```

Run after `pnpm build`:

```sh
pnpm test:live
```

Unit tests do not require live credentials:

```sh
pnpm test
```
