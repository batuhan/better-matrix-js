import type { MatrixKeyValueStore } from "./types";

export interface CloudflareKVNamespaceLike {
  delete(key: string): Promise<void>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  list(options?: {
    cursor?: string;
    prefix?: string;
  }): Promise<{
    cursor?: string;
    keys: Array<{ name: string }>;
    list_complete: boolean;
  }>;
  put(key: string, value: ArrayBuffer | Uint8Array): Promise<void>;
}

export interface DurableObjectStorageLike {
  delete(key: string): Promise<boolean>;
  get<T = unknown>(key: string): Promise<T | undefined>;
  list<T = unknown>(options?: { prefix?: string }): Promise<Map<string, T>>;
  put(key: string, value: unknown): Promise<void>;
}

export interface CloudflareStoreOptions {
  prefix?: string;
}

export function createCloudflareKVMatrixStore(
  namespace: CloudflareKVNamespaceLike,
  options: CloudflareStoreOptions = {}
): MatrixKeyValueStore {
  const prefix = options.prefix ?? "";
  return {
    async delete(key) {
      await namespace.delete(prefix + key);
    },
    async get(key) {
      const value = await namespace.get(prefix + key, "arrayBuffer");
      return value ? new Uint8Array(value) : null;
    },
    async list(keyPrefix) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const options: { cursor?: string; prefix?: string } = { prefix: prefix + keyPrefix };
        if (cursor !== undefined) {
          options.cursor = cursor;
        }
        const result = await namespace.list(options);
        for (const key of result.keys) {
          keys.push(key.name.slice(prefix.length));
        }
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);
      return keys;
    },
    async set(key, value) {
      await namespace.put(prefix + key, copyToArrayBuffer(value));
    },
  };
}

export function createDurableObjectMatrixStore(
  storage: DurableObjectStorageLike,
  options: CloudflareStoreOptions = {}
): MatrixKeyValueStore {
  const prefix = options.prefix ?? "";
  return {
    async delete(key) {
      await storage.delete(prefix + key);
    },
    async get(key) {
      const value = await storage.get<ArrayBuffer | Uint8Array | number[]>(prefix + key);
      if (value instanceof Uint8Array) {
        return new Uint8Array(value);
      }
      if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
      }
      return Array.isArray(value) ? new Uint8Array(value) : null;
    },
    async list(keyPrefix) {
      const values = await storage.list({ prefix: prefix + keyPrefix });
      return [...values.keys()].map((key) => key.slice(prefix.length));
    },
    async set(key, value) {
      await storage.put(prefix + key, copyToArrayBuffer(value));
    },
  };
}

function copyToArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
