# @better-matrix-js/cloudflare

Cloudflare Workers and Durable Objects helpers for `better-matrix-js`.

```sh
npm install better-matrix-js @better-matrix-js/cloudflare
```

```ts
import {
  createDurableObjectMatrixStore,
  MatrixSyncDurableObject,
} from "@better-matrix-js/cloudflare";
```

`MatrixSyncDurableObject` stores the Matrix `next_batch` cursor, long-polls
`/_matrix/client/v3/sync`, posts `{ response, since }` to your webhook handler,
and schedules the next pass with Durable Object alarms so the object can re-wake
after hibernation.
