export type MatrixVerificationMethod = "m.sas.v1" | "m.qr_code.show.v1" | string;
export type MatrixVerificationSummary = {
  id: string;
  phase?: string;
  userId?: string;
  deviceId?: string;
  roomId?: string;
  createdAtMs?: number;
};
export type MatrixVerificationRequestLike = Record<string, unknown>;
export type MatrixVerificationCryptoApi = Record<string, unknown>;

export class MatrixVerificationManager {
  list(): MatrixVerificationSummary[] {
    return [];
  }
  async requestOwnUserVerification(): Promise<MatrixVerificationSummary | null> {
    return null;
  }
}
