# @better-matrix-js/chat-adapter

Matrix adapter for Chat SDK, backed by `better-matrix-js`.

```sh
npm install chat better-matrix-js @better-matrix-js/chat-adapter
```

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
