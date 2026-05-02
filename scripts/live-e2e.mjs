#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileMatrixStore } from "../packages/state-file/dist/index.js";
import { loadMatrixCoreFromNodePackage } from "../packages/core/dist/node.js";

const DEFAULT_TIMEOUT_MS = 90_000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function optionalEnv(name) {
  return process.env[name] || undefined;
}

async function createAccount(role, runDir) {
  const homeserverUrl = requireEnv("MATRIX_HOMESERVER_URL");
  const accessToken = requireEnv(`MATRIX_${role}_ACCESS_TOKEN`);
  const recoveryKey =
    optionalEnv(`MATRIX_${role}_RECOVERY_KEY`) ?? optionalEnv(`MATRIX_${role}_RECOVERY_CODE`);
  const events = [];
  const core = await loadMatrixCoreFromNodePackage({
    host: {
      log(level, message, data) {
        if (level === "error" || level === "warn") {
          console.error(`[${role}] ${level}: ${message}`, data ?? "");
        }
      },
      store: createFileMatrixStore(join(runDir, role.toLowerCase())),
    },
  });
  core.onEvent((event) => events.push(event));
  const initOptions = {
    accessToken,
    homeserverUrl,
  };
  if (recoveryKey) {
    initOptions.recoveryKey = recoveryKey;
  }
  const whoami = await core.init(initOptions);
  return { core, events, role, userId: whoami.userId };
}

async function sync(core, count = 1, timeoutMs = 3_000) {
  for (let index = 0; index < count; index += 1) {
    await core.syncOnce({ timeoutMs });
  }
}

async function retry(label, fn, timeoutMs = 30_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`${label} timed out: ${lastError?.message ?? lastError}`);
}

async function joinRoomIfNeeded(core, roomId) {
  try {
    await core.joinRoom({ roomIdOrAlias: roomId });
  } catch (error) {
    if (!String(error?.message ?? error).includes("already in the room")) {
      throw error;
    }
  }
}

async function syncUntil(label, account, predicate, timeoutMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await sync(account.core);
    const match = predicate();
    if (match) {
      return match;
    }
  }
  throw new Error(`${label} timed out`);
}

function findMessage(events, roomId, body) {
  return events.find(
    (event) =>
      event.type === "message" &&
      event.event.roomId === roomId &&
      event.event.body === body
  )?.event;
}

function findReaction(events, roomId, messageId, key) {
  return events.find(
    (event) =>
      event.type === "reaction" &&
      event.event.roomId === roomId &&
      event.event.relatesToEventId === messageId &&
      event.event.key === key &&
      event.event.added !== false
  )?.event;
}

function findReactionRemoval(events, roomId, messageId, key) {
  return events.find(
    (event) =>
      event.type === "reaction" &&
      event.event.roomId === roomId &&
      event.event.relatesToEventId === messageId &&
      event.event.key === key &&
      event.event.added === false
  )?.event;
}

async function main() {
  const keepStore = process.argv.includes("--keep-store");
  const timeoutMs = Number(optionalEnv("MATRIX_LIVE_E2E_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS);
  const runDir = await mkdtemp(join(tmpdir(), "better-matrix-js-e2e-"));
  console.log(`store=${runDir}`);

  try {
    const [bot, peer] = await Promise.all([
      createAccount("BOT", runDir),
      createAccount("PEER", runDir),
    ]);

    await Promise.all([sync(bot.core), sync(peer.core)]);
    const dm = await bot.core.openDM({ userId: peer.userId });
    await retry("peer join", async () => joinRoomIfNeeded(peer.core, dm.roomId), timeoutMs);
    await Promise.all([sync(bot.core, 5), sync(peer.core, 5)]);

    const room = await bot.core.fetchRoom({ roomId: dm.roomId });
    if (!room.encrypted) {
      throw new Error(`Expected encrypted room, got ${JSON.stringify(room)}`);
    }

    const botText = `hello from bot ${Date.now()}`;
    const botMessage = await bot.core.postMessage({ body: botText, roomId: dm.roomId });
    const seenByPeer = await syncUntil("peer receives bot message", peer, () =>
      findMessage(peer.events, dm.roomId, botText),
      timeoutMs
    );
    if (!seenByPeer.isEncrypted) {
      throw new Error("Peer received bot message, but it was not marked encrypted");
    }
    await Promise.all([sync(bot.core, 5), sync(peer.core, 5)]);

    const peerText = `hello from peer ${Date.now()}`;
    const peerMessage = await peer.core.postMessage({ body: peerText, roomId: dm.roomId });
    const seenByBot = await syncUntil("bot receives peer message", bot, () =>
      findMessage(bot.events, dm.roomId, peerText),
      timeoutMs
    );
    if (!seenByBot.isEncrypted) {
      throw new Error("Bot received peer message, but it was not marked encrypted");
    }

    const fetched = await peer.core.fetchMessage({
      messageId: botMessage.eventId,
      roomId: dm.roomId,
    });
    if (fetched.message?.body !== botText || !fetched.message.isEncrypted) {
      throw new Error(`Fetched encrypted message mismatch: ${JSON.stringify(fetched)}`);
    }

    await peer.core.addReaction({
      emoji: "✅",
      messageId: botMessage.eventId,
      roomId: dm.roomId,
    });
    await syncUntil("bot receives reaction", bot, () =>
      findReaction(bot.events, dm.roomId, botMessage.eventId, "✅"),
      timeoutMs
    );
    await peer.core.removeReaction({
      emoji: "✅",
      messageId: botMessage.eventId,
      roomId: dm.roomId,
    });
    await syncUntil("bot receives reaction removal", bot, () =>
      findReactionRemoval(bot.events, dm.roomId, botMessage.eventId, "✅"),
      timeoutMs
    );
    await bot.core.markRead({ eventId: peerMessage.eventId, roomId: dm.roomId });

    const mediaPayload = Buffer.from("better-matrix-js media", "utf8");
    const media = await bot.core.postMediaMessage({
      bytesBase64: mediaPayload.toString("base64"),
      contentType: "text/plain",
      filename: "better-matrix-js-e2e.txt",
      roomId: dm.roomId,
    });
    const receivedMedia = await syncUntil("peer receives media", peer, () =>
      peer.events.find(
        (event) => event.type === "message" && event.event.eventId === media.eventId
      )?.event,
      timeoutMs
    );
    const attachment = receivedMedia.attachments?.[0];
    if (!attachment) {
      throw new Error(`Missing media attachment: ${JSON.stringify(receivedMedia)}`);
    }
    const downloaded = attachment.encryptedFile
      ? await peer.core.downloadEncryptedMedia({ file: attachment.encryptedFile })
      : await peer.core.downloadMedia({ contentUri: attachment.contentUri });
    const downloadedText = Buffer.from(downloaded.bytesBase64, "base64").toString("utf8");
    if (downloadedText !== mediaPayload.toString("utf8")) {
      throw new Error(`Media roundtrip mismatch: ${downloadedText}`);
    }

    await Promise.all([bot.core.close(), peer.core.close()]);
    console.log("ok");
  } finally {
    if (!keepStore) {
      await rm(runDir, { force: true, recursive: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
