# Pickle Bridge WASM Options

`@beeper/pickle-bridge` forwards `wasmModule`, `wasmBytes`, and `wasmUrl` to
Pickle. Browser and worker runtimes usually choose one of these shapes.

## Browser or bundler worker with `wasmModule`

```ts
import "@beeper/pickle/wasm_exec.js";
import wasmModule from "@beeper/pickle/pickle.wasm";
import { createBridge } from "@beeper/pickle-bridge";
import { createIndexedDBMatrixStore } from "@beeper/pickle-state-indexeddb";

export function createBrowserBridge(connector: Parameters<typeof createBridge>[0]["connector"]) {
  return createBridge({
    connector,
    matrix: {
      homeserver: "https://matrix.example",
      store: createIndexedDBMatrixStore({ databaseName: "pickle-bridge" }),
      token: "access-token",
      wasmModule,
    },
  });
}
```

## Plain worker with `wasmUrl`

```ts
import "@beeper/pickle/wasm_exec.js";
import { createBridge } from "@beeper/pickle-bridge";
import { createMemoryMatrixStore } from "@beeper/pickle-state-memory";

export function createWorkerBridge(connector: Parameters<typeof createBridge>[0]["connector"]) {
  return createBridge({
    connector,
    matrix: {
      homeserver: "https://matrix.example",
      store: createMemoryMatrixStore(),
      token: "access-token",
      wasmUrl: new URL("/pickle.wasm", self.location.href).toString(),
    },
  });
}
```
