import type { EncryptedFile } from "./types.js";
import type { MatrixVerificationMethod, MatrixVerificationSummary } from "./verification-manager.js";

export type MatrixCryptoFacade = {
  prepare: (joinedRooms: string[]) => Promise<void>;
  updateSyncData: (...args: unknown[]) => Promise<void>;
  isRoomEncrypted: (roomId: string) => Promise<boolean>;
  requestOwnUserVerification: () => Promise<MatrixVerificationSummary | null>;
  encryptMedia: (buffer: Buffer) => Promise<{ buffer: Buffer; file: Omit<EncryptedFile, "url"> }>;
  decryptMedia: (file: EncryptedFile, opts?: { maxBytes?: number; readIdleTimeoutMs?: number }) => Promise<Buffer>;
  getRecoveryKey: () => Promise<{ encodedPrivateKey?: string; keyId?: string | null; createdAt?: string } | null>;
  listVerifications: () => Promise<MatrixVerificationSummary[]>;
  ensureVerificationDmTracked: (params: { roomId: string; userId: string }) => Promise<MatrixVerificationSummary | null>;
  requestVerification: (params: { ownUser?: boolean; userId?: string; deviceId?: string; roomId?: string }) => Promise<MatrixVerificationSummary>;
  acceptVerification: (id: string) => Promise<MatrixVerificationSummary>;
  cancelVerification: (id: string, params?: { reason?: string; code?: string }) => Promise<MatrixVerificationSummary>;
  startVerification: (id: string, method?: MatrixVerificationMethod) => Promise<MatrixVerificationSummary>;
  generateVerificationQr: (id: string) => Promise<{ qrDataBase64: string }>;
  scanVerificationQr: (id: string, qrDataBase64: string) => Promise<MatrixVerificationSummary>;
  confirmVerificationSas: (id: string) => Promise<MatrixVerificationSummary>;
  mismatchVerificationSas: (id: string) => Promise<MatrixVerificationSummary>;
  confirmVerificationReciprocateQr: (id: string) => Promise<MatrixVerificationSummary>;
  getVerificationSas: (id: string) => Promise<{ decimal?: [number, number, number]; emoji?: Array<[string, string]> }>;
};

function verification(id: string): MatrixVerificationSummary {
  return {
    completed: false,
    id,
    isSelfVerification: false,
    otherUserId: "",
    pending: true,
    phaseName: "unsupported",
    transactionId: id,
  };
}

export function createMatrixCryptoFacade(deps: {
  getRoomStateEvent?: (roomId: string, eventType: string, stateKey?: string) => Promise<Record<string, unknown>>;
  downloadContent?: (mxcUrl: string, opts?: { maxBytes?: number; readIdleTimeoutMs?: number }) => Promise<Buffer>;
}): MatrixCryptoFacade {
  return {
    prepare: async () => {},
    updateSyncData: async () => {},
    isRoomEncrypted: async (roomId) => {
      try {
        const event = await deps.getRoomStateEvent?.(roomId, "m.room.encryption", "");
        return typeof event?.algorithm === "string";
      } catch {
        return false;
      }
    },
    requestOwnUserVerification: async () => null,
    encryptMedia: async (buffer) => ({
      buffer,
      file: {
        hashes: { sha256: "" },
        iv: "",
        key: { alg: "A256CTR", ext: true, k: "", key_ops: ["encrypt", "decrypt"], kty: "oct" },
        v: "v2",
      },
    }),
    decryptMedia: async (file, opts) => deps.downloadContent ? deps.downloadContent(file.url, opts) : Buffer.alloc(0),
    getRecoveryKey: async () => null,
    listVerifications: async () => [],
    ensureVerificationDmTracked: async () => null,
    requestVerification: async (params) => verification(params.roomId ?? params.deviceId ?? params.userId ?? "verification"),
    acceptVerification: async (id) => verification(id),
    cancelVerification: async (id) => verification(id),
    startVerification: async (id) => verification(id),
    generateVerificationQr: async () => ({ qrDataBase64: "" }),
    scanVerificationQr: async (id) => verification(id),
    confirmVerificationSas: async (id) => ({ ...verification(id), completed: true, pending: false }),
    mismatchVerificationSas: async (id) => verification(id),
    confirmVerificationReciprocateQr: async (id) => ({ ...verification(id), completed: true, pending: false }),
    getVerificationSas: async () => ({}),
  };
}
