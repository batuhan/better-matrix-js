# @better-matrix-js/state-simple

Wrap any simple getter/setter backend as a `better-matrix-js` store.

```ts
import { createMatrixStore } from "@better-matrix-js/state-simple";

const store = createMatrixStore({
  get: (key) => backend.get(key),
  set: (key, value) => backend.set(key, value),
  delete: (key) => backend.delete(key),
  keys: () => backend.keys(),
});
```

If the backend cannot list keys, omit `keys` and `list`; the adapter maintains a small index entry.
