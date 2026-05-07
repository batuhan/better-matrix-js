export interface MetadataCodec<T = unknown> {
  decode(value: unknown): T;
  encode(value: T): unknown;
}

export interface MetadataMigration<T = unknown> {
  from: number;
  migrate(value: unknown): unknown;
  to: number;
}

export interface MetadataEnvelope {
  data: unknown;
  version: number;
}

export function jsonMetadataCodec<T>(): MetadataCodec<T> {
  return {
    decode: (value) => value as T,
    encode: (value) => value,
  };
}

export function metadataEnvelope(data: unknown, version: number): MetadataEnvelope {
  return { data, version };
}

export function migrateMetadata(
  envelope: MetadataEnvelope,
  targetVersion: number,
  migrations: MetadataMigration[]
): MetadataEnvelope {
  let version = envelope.version;
  let data = envelope.data;
  while (version < targetVersion) {
    const migration = migrations.find((item) => item.from === version);
    if (!migration) throw new Error(`No metadata migration from version ${version}`);
    data = migration.migrate(data);
    version = migration.to;
  }
  return { data, version };
}
