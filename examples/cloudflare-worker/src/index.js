import "better-matrix-js/wasm_exec.js";
import wasmModule from "better-matrix-js/matrix-core.wasm";
import { loadMatrixCore } from "better-matrix-js";
import {
  createDurableObjectMatrixStore,
  MatrixSyncDurableObject,
} from "@better-matrix-js/cloudflare";

export class MatrixCoreObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.corePromise = null;
    this.initPromise = null;
  }

  async fetch(request) {
    if (new URL(request.url).pathname === "/matrix/webhook") {
      return this.handleWebhook(request);
    }

    const core = await this.loadCore();
    return Response.json({ ok: Boolean(core) });
  }

  async handleWebhook(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json();
    const core = await this.loadCore();
    await core.applySyncResponse({
      response: body.response ?? body.sync ?? body,
      since: typeof body.since === "string" ? body.since : undefined,
    });
    return Response.json({ ok: true });
  }

  async loadCore() {
    this.corePromise ??= loadMatrixCore({
      wasmModule,
      host: {
        store: createDurableObjectMatrixStore(this.state.storage, {
          prefix: "matrix/default/",
        }),
      },
    });
    const core = await this.corePromise;
    if (this.env.MATRIX_ACCESS_TOKEN && this.env.MATRIX_HOMESERVER_URL) {
      this.initPromise ??= core.init({
        accessToken: this.env.MATRIX_ACCESS_TOKEN,
        homeserverUrl: this.env.MATRIX_HOMESERVER_URL,
        recoveryKey: this.env.MATRIX_RECOVERY_KEY,
      });
      await this.initPromise;
    }
    return core;
  }
}

export class MatrixSyncObject extends MatrixSyncDurableObject {}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const objectName = url.searchParams.get("account") ?? "default";
    const binding = url.pathname.startsWith("/matrix/sync")
      ? env.MATRIX_SYNC
      : env.MATRIX_CORE;
    return binding.get(binding.idFromName(objectName)).fetch(request);
  },
};
