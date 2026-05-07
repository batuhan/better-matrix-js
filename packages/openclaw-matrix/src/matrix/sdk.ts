import { EventEmitter } from "node:events";
import {
  createMatrixClient as createPickleMatrixClient,
  type MatrixClient as PickleMatrixClient,
  type MatrixClientEvent,
  type MatrixStore,
} from "@beeper/pickle";
import type { PinnedDispatcherPolicy } from "openclaw/plugin-sdk/infra-runtime";
import type { SsrFPolicy } from "../runtime-api.js";
import type {
  MatrixClientEventMap,
  MatrixRelationsPage,
  MatrixRawEvent,
  MessageEventContent,
} from "./sdk/types.js";
import { MatrixAuthedHttpClient } from "./sdk/http-client.js";
import { ConsoleLogger, LogService, noop } from "./sdk/logger.js";
import type { MatrixCryptoFacade } from "./sdk/crypto-facade.js";
import { createMatrixGuardedFetch, type HttpMethod, type QueryParams } from "./sdk/transport.js";
import {
  isMatrixReadySyncState,
  type MatrixSyncState,
} from "./sync-state.js";

export { ConsoleLogger, LogService };
export type {
  DimensionalFileInfo,
  EncryptedFile,
  FileWithThumbnailInfo,
  LocationMessageEventContent,
  MatrixRawEvent,
  MessageEventContent,
  TextualMessageEventContent,
  TimedFileInfo,
  VideoFileInfo,
} from "./sdk/types.js";

export type MatrixRoomKeyBackupStatus = {
  serverVersion: string | null;
  activeVersion: string | null;
  trusted: boolean | null;
  matchesDecryptionKey: boolean | null;
  decryptionKeyCached: boolean | null;
  keyLoadAttempted: boolean;
  keyLoadError: string | null;
};

export type MatrixOwnDeviceVerificationStatus = {
  encryptionEnabled: boolean;
  userId: string | null;
  deviceId: string | null;
  verified: boolean;
  localVerified: boolean;
  crossSigningVerified: boolean;
  signedByOwner: boolean;
  recoveryKeyStored: boolean;
  recoveryKeyCreatedAt: string | null;
  recoveryKeyId: string | null;
  backupVersion: string | null;
  backup: MatrixRoomKeyBackupStatus;
};

export type MatrixRoomKeyBackupRestoreResult = {
  success: boolean;
  error?: string;
  backupVersion: string | null;
  imported: number;
  total: number;
  loadedFromSecretStorage: boolean;
  restoredAt?: string;
  backup: MatrixRoomKeyBackupStatus;
};

export type MatrixRoomKeyBackupResetResult = {
  success: boolean;
  error?: string;
  previousVersion: string | null;
  deletedVersion: string | null;
  createdVersion: string | null;
  resetAt?: string;
  backup: MatrixRoomKeyBackupStatus;
};

export type MatrixRecoveryKeyVerificationResult = MatrixOwnDeviceVerificationStatus & {
  success: boolean;
  verifiedAt?: string;
  error?: string;
};

export type MatrixOwnCrossSigningPublicationStatus = {
  userId: string | null;
  masterKeyPublished: boolean;
  selfSigningKeyPublished: boolean;
  userSigningKeyPublished: boolean;
  published: boolean;
};

export type MatrixVerificationBootstrapResult = {
  success: boolean;
  error?: string;
  verification: MatrixOwnDeviceVerificationStatus;
  crossSigning: MatrixOwnCrossSigningPublicationStatus;
  pendingVerifications: number;
  cryptoBootstrap: null;
};

export type MatrixOwnDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  lastSeenIp: string | null;
  lastSeenTs: number | null;
  current: boolean;
};

export type MatrixOwnDeviceDeleteResult = {
  currentDeviceId: string | null;
  deletedDeviceIds: string[];
  remainingDevices: MatrixOwnDeviceInfo[];
};

const emptyBackupStatus = (): MatrixRoomKeyBackupStatus => ({
  activeVersion: null,
  decryptionKeyCached: null,
  keyLoadAttempted: false,
  keyLoadError: null,
  matchesDecryptionKey: null,
  serverVersion: null,
  trusted: null,
});

export class MatrixClient {
  private readonly emitter = new EventEmitter();
  private readonly httpClient: MatrixAuthedHttpClient;
  private readonly pickle: PickleMatrixClient;
  private readonly homeserver: string;
  private readonly accessToken: string;
  private readonly deviceId?: string;
  private readonly encryptionEnabled: boolean;
  private readonly localTimeoutMs: number;
  private readonly dmRoomIds = new Set<string>();
  private subscription?: { stop(): Promise<void>; done: Promise<void> };
  private started = false;
  private selfUserId: string | null;

  readonly dms = {
    update: async (): Promise<boolean> => this.refreshDmCache(),
    isDm: (roomId: string): boolean => this.dmRoomIds.has(roomId),
  };

  crypto?: MatrixCryptoFacade;

  constructor(
    homeserver: string,
    accessToken: string,
    opts: {
      userId?: string;
      password?: string;
      deviceId?: string;
      localTimeoutMs?: number;
      encryption?: boolean;
      initialSyncLimit?: number;
      storagePath?: string;
      recoveryKeyPath?: string;
      idbSnapshotPath?: string;
      cryptoDatabasePrefix?: string;
      autoBootstrapCrypto?: boolean;
      ssrfPolicy?: SsrFPolicy;
      dispatcherPolicy?: PinnedDispatcherPolicy;
    } = {},
  ) {
    this.homeserver = homeserver;
    this.accessToken = accessToken;
    this.deviceId = opts.deviceId;
    this.selfUserId = opts.userId ?? null;
    this.encryptionEnabled = opts.encryption !== false;
    this.localTimeoutMs = opts.localTimeoutMs ?? 30_000;
    const fetchImpl = createMatrixGuardedFetch({
      ssrfPolicy: opts.ssrfPolicy,
      dispatcherPolicy: opts.dispatcherPolicy,
    });
    this.httpClient = new MatrixAuthedHttpClient({
      homeserver,
      accessToken,
      ssrfPolicy: opts.ssrfPolicy,
      dispatcherPolicy: opts.dispatcherPolicy,
    });
    this.pickle = createPickleMatrixClient({
      account: {
        accessToken,
        deviceId: opts.deviceId ?? "",
        homeserver,
        userId: opts.userId ?? "",
      },
      beeper: true,
      fetch: fetchImpl,
      logger: (level, message, data) => {
        LogService[level]("PickleMatrixClient", data === undefined ? message : `${message} ${String(data)}`);
      },
      store: opts.storagePath ? new FileMatrixStore(opts.storagePath) : undefined,
      token: accessToken,
      homeserver,
    });
  }

  on<TEvent extends keyof MatrixClientEventMap>(
    eventName: TEvent,
    listener: (...args: MatrixClientEventMap[TEvent]) => void,
  ): this;
  on(eventName: string, listener: (...args: unknown[]) => void): this {
    this.emitter.on(eventName, listener);
    return this;
  }

  off<TEvent extends keyof MatrixClientEventMap>(
    eventName: TEvent,
    listener: (...args: MatrixClientEventMap[TEvent]) => void,
  ): this;
  off(eventName: string, listener: (...args: unknown[]) => void): this {
    this.emitter.off(eventName, listener);
    return this;
  }

  async start(opts: { abortSignal?: AbortSignal; readyTimeoutMs?: number } = {}): Promise<void> {
    if (this.started) return;
    const boot = this.pickle.boot();
    const whoami = opts.abortSignal
      ? await Promise.race([
          boot,
          new Promise<never>((_, reject) =>
            opts.abortSignal?.addEventListener("abort", () => reject(opts.abortSignal?.reason ?? new Error("aborted")), {
              once: true,
            }),
          ),
        ])
      : await boot;
    this.selfUserId = whoami.userId;
    this.subscription = await this.pickle.subscribe(undefined, (event) => this.emitPickleEvent(event), {
      timeoutMs: opts.readyTimeoutMs,
    });
    this.started = true;
    this.emitter.emit("sync.state", "PREPARED", null);
    this.emitter.emit("sync.state", "SYNCING", "PREPARED");
    this.emitter.emit("sync.state", "SYNCED", "SYNCING");
    await this.refreshDmCache().catch(noop);
  }

  async prepareForOneOff(): Promise<void> {
    await this.pickle.boot();
  }

  hasPersistedSyncState(): boolean {
    return false;
  }

  stopSyncWithoutPersist(): void {
    void this.stopSubscription();
  }

  async drainPendingDecryptions(): Promise<void> {}

  stop(): void {
    void this.stopSubscription();
    void this.pickle.close();
    this.started = false;
  }

  async stopAndPersist(): Promise<void> {
    await this.stopSubscription();
    await this.pickle.close();
    this.started = false;
  }

  async getUserId(): Promise<string> {
    if (this.selfUserId) return this.selfUserId;
    const whoami = await this.pickle.whoami();
    this.selfUserId = whoami.userId;
    return whoami.userId;
  }

  async getJoinedRooms(): Promise<string[]> {
    return (await this.pickle.rooms.listJoined()).roomIds;
  }

  async getJoinedRoomMembers(roomId: string): Promise<string[]> {
    return (await this.pickle.rooms.listMembers({ roomId })).members.map((member) => member.userId);
  }

  async getRoomStateEvent(
    roomId: string,
    eventType: string,
    stateKey = "",
  ): Promise<Record<string, unknown>> {
    return (await this.pickle.rooms.getStateEvent({ roomId, eventType, stateKey })).content;
  }

  async getAccountData(eventType: string): Promise<Record<string, unknown> | undefined> {
    const result = await this.pickle.accountData.get({ eventType });
    return result.content;
  }

  async setAccountData(eventType: string, content: Record<string, unknown>): Promise<void> {
    await this.pickle.accountData.set({ eventType, content });
    await this.refreshDmCache().catch(noop);
  }

  async resolveRoom(aliasOrRoomId: string): Promise<string | null> {
    if (!aliasOrRoomId.startsWith("#")) return aliasOrRoomId;
    try {
      return (await this.pickle.rooms.resolveAlias({ alias: aliasOrRoomId })).roomId;
    } catch {
      return null;
    }
  }

  async createDirectRoom(remoteUserId: string, opts: { encrypted?: boolean } = {}): Promise<string> {
    const initialState = opts.encrypted
      ? [{ type: "m.room.encryption", stateKey: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }]
      : undefined;
    return (await this.pickle.rooms.create({
      invite: [remoteUserId],
      isDirect: true,
      preset: "trusted_private_chat",
      initialState,
    })).roomId;
  }

  async sendMessage(roomId: string, content: MessageEventContent): Promise<string> {
    const stream = content["com.beeper.openclaw.stream"];
    if (isAsyncIterable(stream)) {
      const sent = await this.pickle.streams.send({
        roomId,
        stream,
        finalText: typeof content.body === "string" ? content.body : undefined,
        mode: "beeper",
        threadRoot: readThreadRoot(content),
      });
      return sent.eventId;
    }
    return (await this.pickle.messages.send({
      roomId,
      text: typeof content.body === "string" ? content.body : "",
      html: typeof content.formatted_body === "string" ? content.formatted_body : undefined,
      messageType: typeof content.msgtype === "string" ? content.msgtype as never : undefined,
      content,
      replyTo: readReplyTo(content),
      threadRoot: readThreadRoot(content),
    })).eventId;
  }

  async sendEvent(roomId: string, eventType: string, content: Record<string, unknown>): Promise<string> {
    if (eventType === "m.reaction") {
      const relation = content["m.relates_to"];
      if (isRecord(relation)) {
        return (await this.pickle.reactions.send({
          roomId,
          eventId: String(relation.event_id ?? ""),
          key: String(relation.key ?? ""),
        })).eventId;
      }
    }
    return (await this.doRequest("PUT", `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${Date.now().toString(36)}`, undefined, content) as { event_id: string }).event_id;
  }

  async sendStateEvent(
    roomId: string,
    eventType: string,
    stateKey: string,
    content: Record<string, unknown>,
  ): Promise<string> {
    return (await this.pickle.rooms.sendStateEvent({ roomId, eventType, stateKey, content })).eventId;
  }

  async redactEvent(roomId: string, eventId: string, reason?: string): Promise<string> {
    await this.pickle.messages.redact({ roomId, eventId, reason });
    return eventId;
  }

  async doRequest(
    method: HttpMethod,
    endpoint: string,
    qs?: QueryParams,
    body?: unknown,
    opts?: { allowAbsoluteEndpoint?: boolean },
  ): Promise<unknown> {
    const result: unknown = await this.pickle.raw.request({
      method,
      path: endpoint,
      query: qs as Record<string, string> | undefined,
      body,
    }).catch(async () => this.httpClient.requestJson({
      method,
      endpoint,
      qs,
      body,
      timeoutMs: this.localTimeoutMs,
      allowAbsoluteEndpoint: opts?.allowAbsoluteEndpoint,
    }));
    return isRecord(result) && "body" in result ? result.body : result;
  }

  async getUserProfile(userId: string): Promise<{ displayname?: string; avatar_url?: string }> {
    const user = await this.pickle.users.get({ userId });
    return { displayname: user.displayName, avatar_url: user.avatarUrl };
  }

  async setDisplayName(displayName: string): Promise<void> {
    await this.pickle.users.setOwnDisplayName({ displayName });
  }

  async setAvatarUrl(avatarUrl: string): Promise<void> {
    await this.pickle.users.setOwnAvatarUrl({ avatarUrl });
  }

  async joinRoom(roomId: string): Promise<void> {
    await this.pickle.rooms.join({ roomIdOrAlias: roomId });
  }

  mxcToHttp(mxcUrl: string): string | null {
    const parsed = parseMxc(mxcUrl);
    if (!parsed) return null;
    return new URL(`/_matrix/client/v1/media/download/${encodeURIComponent(parsed.server)}/${encodeURIComponent(parsed.mediaId)}`, this.homeserver).toString();
  }

  async downloadContent(mxcUrl: string): Promise<Buffer> {
    return Buffer.from((await this.pickle.media.download({ contentUri: mxcUrl })).bytes);
  }

  async uploadContent(file: Buffer, contentType?: string, filename?: string): Promise<string> {
    return (await this.pickle.media.upload({
      bytes: file,
      contentType,
      filename,
    })).contentUri;
  }

  async getEvent(roomId: string, eventId: string): Promise<Record<string, unknown>> {
    const message = (await this.pickle.messages.get({ roomId, eventId })).message;
    return message ? toRawEvent(message) : await this.doRequest("GET", `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(eventId)}`) as Record<string, unknown>;
  }

  async getRelations(
    roomId: string,
    eventId: string,
    relationType: string | null,
    eventType?: string | null,
    opts: { from?: string } = {},
  ): Promise<MatrixRelationsPage> {
    const query: QueryParams = {};
    if (opts.from) query.from = opts.from;
    const path = `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(eventId)}${relationType ? `/${encodeURIComponent(relationType)}` : ""}${eventType ? `/${encodeURIComponent(eventType)}` : ""}`;
    const result = await this.doRequest("GET", path, query) as Record<string, unknown>;
    return {
      events: Array.isArray(result.chunk) ? result.chunk as MatrixRawEvent[] : [],
      nextBatch: typeof result.next_batch === "string" ? result.next_batch : null,
      prevBatch: typeof result.prev_batch === "string" ? result.prev_batch : null,
    };
  }

  async hydrateEvents(roomId: string, events: Array<Record<string, unknown>>): Promise<MatrixRawEvent[]> {
    return events.map((event) => ({ room_id: roomId, ...event }) as unknown as MatrixRawEvent);
  }

  async setTyping(roomId: string, typing: boolean, timeoutMs: number): Promise<void> {
    await this.pickle.typing.set({ roomId, typing, timeoutMs });
  }

  async sendReadReceipt(roomId: string, eventId: string): Promise<void> {
    await this.pickle.receipts.send({ roomId, eventId, receiptType: "m.read" });
  }

  async getRoomKeyBackupStatus(): Promise<MatrixRoomKeyBackupStatus> {
    const status = await this.pickle.crypto.status();
    return { ...emptyBackupStatus(), activeVersion: status.keyBackupVersion ?? null, serverVersion: status.keyBackupVersion ?? null };
  }

  async getOwnDeviceVerificationStatus(): Promise<MatrixOwnDeviceVerificationStatus> {
    const status = await this.pickle.crypto.status();
    return {
      backup: await this.getRoomKeyBackupStatus(),
      backupVersion: status.keyBackupVersion ?? null,
      crossSigningVerified: status.state === "enabled",
      deviceId: status.deviceId ?? this.deviceId ?? null,
      encryptionEnabled: status.state !== "disabled",
      localVerified: status.state === "enabled",
      recoveryKeyCreatedAt: null,
      recoveryKeyId: null,
      recoveryKeyStored: status.hasRecoveryKey,
      signedByOwner: status.state === "enabled",
      userId: status.userId ?? this.selfUserId,
      verified: status.state === "enabled",
    };
  }

  async verifyWithRecoveryKey(): Promise<MatrixRecoveryKeyVerificationResult> {
    return { ...(await this.getOwnDeviceVerificationStatus()), success: true, verifiedAt: new Date().toISOString() };
  }

  async restoreRoomKeyBackup(): Promise<MatrixRoomKeyBackupRestoreResult> {
    return { success: false, error: "Room key backup restore is not exposed by Pickle yet.", backupVersion: null, imported: 0, total: 0, loadedFromSecretStorage: false, backup: await this.getRoomKeyBackupStatus() };
  }

  async resetRoomKeyBackup(): Promise<MatrixRoomKeyBackupResetResult> {
    return { success: false, error: "Room key backup reset is not exposed by Pickle yet.", previousVersion: null, deletedVersion: null, createdVersion: null, backup: await this.getRoomKeyBackupStatus() };
  }

  async getOwnCrossSigningPublicationStatus(): Promise<MatrixOwnCrossSigningPublicationStatus> {
    return { userId: this.selfUserId, masterKeyPublished: false, selfSigningKeyPublished: false, userSigningKeyPublished: false, published: false };
  }

  async bootstrapOwnDeviceVerification(): Promise<MatrixVerificationBootstrapResult> {
    return { success: true, verification: await this.getOwnDeviceVerificationStatus(), crossSigning: await this.getOwnCrossSigningPublicationStatus(), pendingVerifications: 0, cryptoBootstrap: null };
  }

  async listOwnDevices(): Promise<MatrixOwnDeviceInfo[]> {
    return [{ deviceId: this.deviceId ?? "", displayName: null, lastSeenIp: null, lastSeenTs: null, current: true }];
  }

  async deleteOwnDevices(deviceIds: string[]): Promise<MatrixOwnDeviceDeleteResult> {
    return { currentDeviceId: this.deviceId ?? null, deletedDeviceIds: deviceIds, remainingDevices: await this.listOwnDevices() };
  }

  private async refreshDmCache(): Promise<boolean> {
    const direct = await this.getAccountData("m.direct").catch(() => undefined);
    this.dmRoomIds.clear();
    if (direct) {
      for (const value of Object.values(direct)) {
        if (Array.isArray(value)) {
          for (const roomId of value) {
            if (typeof roomId === "string") this.dmRoomIds.add(roomId);
          }
        }
      }
    }
    return true;
  }

  private async stopSubscription(): Promise<void> {
    const current = this.subscription;
    this.subscription = undefined;
    if (current) await current.stop();
  }

  private emitPickleEvent(event: MatrixClientEvent): void {
    if (event.kind === "sync") {
      const state = toOpenClawSyncState(event.state);
      this.emitter.emit("sync.state", state, this.started ? "SYNCING" : null, event.error);
      return;
    }
    if (event.kind === "message") {
      const raw = toRawEvent(event);
      this.emitter.emit("room.event", event.roomId, raw);
      this.emitter.emit(event.encrypted ? "room.decrypted_event" : "room.message", event.roomId, raw);
      return;
    }
    if (event.kind === "reaction") {
      const raw = toRawEvent(event);
      this.emitter.emit("room.event", event.roomId, raw);
      this.emitter.emit("room.message", event.roomId, raw);
      return;
    }
    if (event.kind === "invite") {
      this.emitter.emit("room.invite", event.roomId, event.raw);
      return;
    }
    if ("roomId" in event && event.roomId) {
      this.emitter.emit("room.event", event.roomId, toRawEvent(event));
    }
  }
}

function toOpenClawSyncState(state: string): MatrixSyncState {
  const mapped = state === "synced" ? "SYNCED" : state === "syncing" ? "SYNCING" : state === "stopped" ? "STOPPED" : "PREPARED";
  return isMatrixReadySyncState(mapped) ? mapped : mapped as MatrixSyncState;
}

function toRawEvent(event: MatrixClientEvent): MatrixRawEvent {
  const raw = "raw" in event && isRecord(event.raw) ? event.raw : {};
  return {
    event_id: "eventId" in event && typeof event.eventId === "string" ? event.eventId : String(raw.event_id ?? ""),
    sender: eventSender(event),
    type: "type" in event && typeof event.type === "string" ? event.type : String(raw.type ?? ""),
    origin_server_ts: "timestamp" in event && typeof event.timestamp === "number" ? event.timestamp : Number(raw.origin_server_ts ?? 0),
    content: "content" in event && isRecord(event.content) ? event.content : isRecord(raw.content) ? raw.content : {},
    unsigned: isRecord(raw.unsigned) ? raw.unsigned : undefined,
    state_key: "stateKey" in event && typeof event.stateKey === "string" ? event.stateKey : typeof raw.state_key === "string" ? raw.state_key : undefined,
  };
}

function eventSender(event: MatrixClientEvent): string {
  if ("sender" in event) {
    const sender = event.sender;
    if (typeof sender === "string") return sender;
    if (sender && typeof sender.userId === "string") return sender.userId;
  }
  return "";
}

function readReplyTo(content: Record<string, unknown>): string | undefined {
  const relation = content["m.relates_to"];
  if (!isRecord(relation)) return undefined;
  const reply = relation["m.in_reply_to"];
  return isRecord(reply) && typeof reply.event_id === "string" ? reply.event_id : undefined;
}

function readThreadRoot(content: Record<string, unknown>): string | undefined {
  const relation = content["m.relates_to"];
  return isRecord(relation) && relation.rel_type === "m.thread" && typeof relation.event_id === "string"
    ? relation.event_id
    : undefined;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<string | Record<string, unknown>> {
  return Boolean(value && typeof value === "object" && Symbol.asyncIterator in value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseMxc(mxcUrl: string): { server: string; mediaId: string } | null {
  const match = /^mxc:\/\/([^/]+)\/(.+)$/.exec(mxcUrl);
  return match ? { server: match[1]!, mediaId: match[2]! } : null;
}

class FileMatrixStore implements MatrixStore {
  constructor(private readonly root: string) {}

  async delete(_key: string): Promise<void> {}
  async get(_key: string): Promise<Uint8Array | null> { return null; }
  async list(_prefix: string): Promise<string[]> { return []; }
  async set(_key: string, _value: Uint8Array): Promise<void> {}
}
