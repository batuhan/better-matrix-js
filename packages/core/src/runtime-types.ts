import type {
  MatrixApplySyncResponseOptions,
  MatrixBeeperStreamOptions,
  MatrixCoreInitOptions,
  MatrixCreateBeeperStreamOptions,
  MatrixCreateBeeperStreamResult,
  MatrixDeleteMessageOptions,
  MatrixDownloadEncryptedMediaOptions,
  MatrixDownloadMediaOptions,
  MatrixDownloadMediaResult,
  MatrixEditMessageOptions,
  MatrixFetchMessageOptions,
  MatrixFetchMessageResult,
  MatrixFetchMessagesOptions,
  MatrixFetchMessagesResult,
  MatrixFetchRoomOptions,
  MatrixGetUserOptions,
  MatrixInviteEvent,
  MatrixInviteUserOptions,
  MatrixJoinRoomOptions,
  MatrixJoinRoomResult,
  MatrixJoinedRoomsResult,
  MatrixLeaveRoomOptions,
  MatrixListRoomThreadsOptions,
  MatrixListRoomThreadsResult,
  MatrixMarkReadOptions,
  MatrixMessageEvent,
  MatrixOpenDMOptions,
  MatrixOpenDMResult,
  MatrixRawEvent,
  MatrixRawMessage,
  MatrixReactionEvent,
  MatrixReactionOptions,
  MatrixRegisterBeeperStreamOptions,
  MatrixRoomInfo,
  MatrixSendEphemeralEventOptions,
  MatrixSendMediaMessageOptions,
  MatrixSendMessageOptions,
  MatrixSyncOnceOptions,
  MatrixSyncStartOptions,
  MatrixTypingOptions,
  MatrixUploadEncryptedMediaResult,
  MatrixUploadMediaOptions,
  MatrixUploadMediaResult,
  MatrixUserInfo,
  MatrixWhoami,
} from "./generated-runtime-types";

export type {
  MatrixApplySyncResponseOptions,
  MatrixBeeperStreamOptions,
  MatrixCoreInitOptions,
  MatrixCreateBeeperStreamOptions,
  MatrixCreateBeeperStreamResult,
  MatrixDeleteMessageOptions,
  MatrixDownloadEncryptedMediaOptions,
  MatrixDownloadMediaOptions,
  MatrixDownloadMediaResult,
  MatrixEditMessageOptions,
  MatrixEncryptedFile,
  MatrixEncryptedFileKey,
  MatrixFetchMessageOptions,
  MatrixFetchMessageResult,
  MatrixFetchMessagesOptions,
  MatrixFetchMessagesResult,
  MatrixFetchRoomOptions,
  MatrixGetUserOptions,
  MatrixInviteEvent,
  MatrixInviteUserOptions,
  MatrixJoinRoomOptions,
  MatrixJoinRoomResult,
  MatrixJoinedRoomsResult,
  MatrixLeaveRoomOptions,
  MatrixListRoomThreadsOptions,
  MatrixListRoomThreadsResult,
  MatrixMarkReadOptions,
  MatrixMediaAttachment,
  MatrixMediaInfo,
  MatrixMentions,
  MatrixMessageEvent,
  MatrixOpenDMOptions,
  MatrixOpenDMResult,
  MatrixRawEvent,
  MatrixRawMessage,
  MatrixReactionEvent,
  MatrixReactionOptions,
  MatrixRegisterBeeperStreamOptions,
  MatrixRoomInfo,
  MatrixRoomThreadSummary,
  MatrixSendEphemeralEventOptions,
  MatrixSendMediaMessageOptions,
  MatrixSendMessageOptions,
  MatrixSyncOnceOptions,
  MatrixSyncStartOptions,
  MatrixTypingOptions,
  MatrixUploadEncryptedMediaResult,
  MatrixUploadMediaOptions,
  MatrixUploadMediaResult,
  MatrixUserInfo,
  MatrixWhoami,
} from "./generated-runtime-types";

export type MatrixCoreEvent =
  | { event: MatrixMessageEvent; type: "message" }
  | { event: MatrixReactionEvent; type: "reaction" }
  | { event: MatrixInviteEvent; type: "invite" }
  | {
      event: {
        content?: Record<string, unknown>;
        eventId: string;
        raw: unknown;
        roomId: string;
        sender?: string;
      };
      type: "beeper_stream_update";
    }
  | {
      error?: string;
      keyBackupVersion?: string;
      keyId?: string;
      status:
        | "enabled"
        | "key_backup_unavailable"
        | "recovery_cache_unavailable"
        | "recovery_key_cached"
        | "recovery_key_loaded"
        | "recovery_restored"
        | "recovery_unverified";
      type: "crypto_status";
    }
  | {
      error: string;
      event?: Pick<MatrixRawEvent, "eventId" | "roomId" | "sender">;
      type: "decryption_error";
    }
  | { error: string; type: "error" }
  | {
      durationMs?: number;
      error?: string;
      failures?: number;
      nextRetryMs?: number;
      status: "initialized" | "init_step" | "syncing" | "synced" | "retrying" | "stopped";
      step?: string;
      type: "sync_status";
    };

export interface MatrixCore {
  addReaction(options: MatrixReactionOptions): Promise<MatrixRawMessage>;
  applySyncResponse(options: MatrixApplySyncResponseOptions): Promise<void>;
  close(): Promise<void>;
  createBeeperStream(options: MatrixCreateBeeperStreamOptions): Promise<MatrixCreateBeeperStreamResult>;
  deleteMessage(options: MatrixDeleteMessageOptions): Promise<void>;
  downloadEncryptedMedia(options: MatrixDownloadEncryptedMediaOptions): Promise<MatrixDownloadMediaResult>;
  downloadMedia(options: MatrixDownloadMediaOptions): Promise<MatrixDownloadMediaResult>;
  editMessage(options: MatrixEditMessageOptions): Promise<MatrixRawMessage>;
  fetchMessage(options: MatrixFetchMessageOptions): Promise<MatrixFetchMessageResult>;
  fetchMessages(options: MatrixFetchMessagesOptions): Promise<MatrixFetchMessagesResult>;
  fetchRoom(options: MatrixFetchRoomOptions): Promise<MatrixRoomInfo>;
  fetchJoinedRooms(): Promise<MatrixJoinedRoomsResult>;
  getUser(options: MatrixGetUserOptions): Promise<MatrixUserInfo>;
  init(options: MatrixCoreInitOptions): Promise<MatrixWhoami>;
  inviteUser(options: MatrixInviteUserOptions): Promise<void>;
  joinRoom(options: MatrixJoinRoomOptions): Promise<MatrixJoinRoomResult>;
  leaveRoom(options: MatrixLeaveRoomOptions): Promise<void>;
  listRoomThreads(options: MatrixListRoomThreadsOptions): Promise<MatrixListRoomThreadsResult>;
  markRead(options: MatrixMarkReadOptions): Promise<void>;
  onEvent(listener: (event: MatrixCoreEvent) => void): () => void;
  openDM(options: MatrixOpenDMOptions): Promise<MatrixOpenDMResult>;
  postMediaMessage(options: MatrixSendMediaMessageOptions): Promise<MatrixRawMessage>;
  postMessage(options: MatrixSendMessageOptions): Promise<MatrixRawMessage>;
  publishBeeperStream(options: MatrixBeeperStreamOptions): Promise<void>;
  registerBeeperStream(options: MatrixRegisterBeeperStreamOptions): Promise<void>;
  removeReaction(options: MatrixReactionOptions): Promise<void>;
  sendEphemeralEvent(options: MatrixSendEphemeralEventOptions): Promise<MatrixRawMessage>;
  setTyping(options: MatrixTypingOptions): Promise<void>;
  startSync(options?: MatrixSyncStartOptions): Promise<void>;
  stopSync(): Promise<void>;
  syncOnce(options?: MatrixSyncOnceOptions): Promise<void>;
  uploadEncryptedMedia(options: MatrixUploadMediaOptions): Promise<MatrixUploadEncryptedMediaResult>;
  uploadMedia(options: MatrixUploadMediaOptions): Promise<MatrixUploadMediaResult>;
  unsubscribeBeeperStream(options: MatrixBeeperStreamOptions): Promise<void>;
  whoami(): Promise<MatrixWhoami>;
}

export interface MatrixCoreHost {
  fetch?: typeof fetch;
  log?: (level: "debug" | "info" | "warn" | "error", message: string, data?: unknown) => void;
  randomBytes?: (length: number) => Uint8Array;
  state?: MatrixStore;
}

export interface MatrixStore {
  delete(key: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  list(prefix: string): Promise<string[]>;
  set(key: string, value: Uint8Array): Promise<void>;
}
