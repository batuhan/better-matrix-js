export type MatrixLegacyCryptoInspectionResult = {
  deviceId: string | null;
  roomKeyCounts: {
    total: number;
    backedUp: number;
  } | null;
  backupVersion: string | null;
  decryptionKeyBase64: string | null;
};

export async function inspectLegacyMatrixCryptoStore(params: {
  cryptoRootDir: string;
  userId: string;
  deviceId: string;
  log?: (message: string) => void;
}): Promise<MatrixLegacyCryptoInspectionResult> {
  params.log?.("matrix: legacy Pickle crypto inspection is not available in the Pickle-backed plugin");
  return {
    backupVersion: null,
    decryptionKeyBase64: null,
    deviceId: params.deviceId,
    roomKeyCounts: null,
  };
}
