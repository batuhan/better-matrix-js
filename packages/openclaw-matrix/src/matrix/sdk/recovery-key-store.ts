export class MatrixRecoveryKeyStore {
  async get(): Promise<null> {
    return null;
  }
}

export function isRepairableSecretStorageAccessError(): boolean {
  return false;
}
