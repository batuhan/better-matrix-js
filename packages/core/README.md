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
import {
  createDurableObjectMatrixStore,
  MatrixSyncDurableObject,
} from "@better-matrix-js/cloudflare";
```

`MatrixSyncDurableObject` is the recommended Worker sync runner for webhook
ingestion. It stores the Matrix `next_batch` cursor in Durable Object storage,
long-polls `/_matrix/client/v3/sync`, posts `{ response, since }` to your
webhook handler, and schedules the next pass with Durable Object alarms so the
object can re-wake after hibernation.

See the repository `examples/cloudflare-worker` directory for a full Worker
example.
