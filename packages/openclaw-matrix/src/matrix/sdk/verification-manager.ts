export type MatrixVerificationMethod = "m.sas.v1" | "m.qr_code.show.v1" | string;
export type MatrixVerificationSummary = {
  completed: boolean;
  id: string;
  isSelfVerification: boolean;
  otherUserId: string;
  pending: boolean;
  phase?: number;
  phaseName?: string;
  transactionId?: string;
  userId?: string;
  deviceId?: string;
  roomId?: string;
  createdAtMs?: number;
  updatedAt?: string;
  sas?: {
    decimal?: [number, number, number];
    emoji?: Array<[string, string]>;
  };
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
