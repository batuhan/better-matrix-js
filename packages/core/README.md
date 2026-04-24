# better-matrix-js

WASM-backed TypeScript Matrix SDK built on mautrix-go.

```sh
npm install better-matrix-js
```

## Node

```ts
import {
  FileMatrixStore,
  loadMatrixCoreFromNodePackage,
} from "better-matrix-js/node";

const core = await loadMatrixCoreFromNodePackage({
  host: {
    store: new FileMatrixStore(".matrix-store/my-account"),
  },
});

await core.init({
  accessToken,
  homeserverUrl: "https://matrix.example.org",
  recoveryCode,
});
```

## Cloudflare Workers

```ts
import "better-matrix-js/wasm_exec.js";
import wasmModule from "better-matrix-js/matrix-core.wasm";
import { loadMatrixCore } from "better-matrix-js";
import { createDurableObjectMatrixStore } from "better-matrix-js/cloudflare";
```

See the repository `examples/cloudflare-worker` directory for a full Worker
example.
