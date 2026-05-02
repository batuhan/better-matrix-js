# @better-matrix-js/state-sqlite

SQLite state adapter for `better-matrix-js`.

```ts
import { createSQLiteMatrixStore } from "@better-matrix-js/state-sqlite";

const store = await createSQLiteMatrixStore(".matrix-store/alice.db");
```

This package uses Node's built-in `node:sqlite` module.
