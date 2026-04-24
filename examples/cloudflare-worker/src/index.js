import "better-matrix-js/wasm_exec.js";
import wasmModule from "better-matrix-js/matrix-core.wasm";
import { loadMatrixCore } from "better-matrix-js";
import { createCloudflareKVMatrixStore } from "better-matrix-js/cloudflare";

let corePromise;

export default {
  async fetch(_request, env) {
    corePromise ??= loadMatrixCore({
      wasmModule,
      host: {
        store: createCloudflareKVMatrixStore(env.MATRIX_STORE, {
          prefix: "matrix/default/",
        }),
      },
    });

    const core = await corePromise;
    return Response.json({ ok: Boolean(core) });
  },
};
