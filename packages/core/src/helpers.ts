import type { MatrixClient } from "./client-types";
import { stripUndefined } from "./object";
import type {
  MatrixClientEvent,
  MatrixInviteEvent,
  MatrixMessageEvent,
  MatrixRawEventEnvelope,
  MatrixReactionEvent,
  MatrixSubscribeFilter,
  MatrixSubscription,
} from "./types";

type Handler<T> = (event: T) => void | Promise<void>;

export function onMessage(
  client: MatrixClient,
  options: Omit<NonNullable<MatrixSubscribeFilter>, "kind"> | undefined,
  handler: Handler<MatrixMessageEvent>
): Promise<MatrixSubscription> {
  return client.subscribe({ ...options, kind: "message" }, handler as Handler<MatrixClientEvent>);
}

export function onReaction(
  client: MatrixClient,
  options: Omit<NonNullable<MatrixSubscribeFilter>, "kind"> | undefined,
  handler: Handler<MatrixReactionEvent>
): Promise<MatrixSubscription> {
  return client.subscribe({ ...options, kind: "reaction" }, handler as Handler<MatrixClientEvent>);
}

export function onInvite(
  client: MatrixClient,
  options: Omit<NonNullable<MatrixSubscribeFilter>, "kind"> | undefined,
  handler: Handler<MatrixInviteEvent>
): Promise<MatrixSubscription> {
  return client.subscribe({ ...options, kind: "invite" }, handler as Handler<MatrixClientEvent>);
}

export function onRawEvent(
  client: MatrixClient,
  options: MatrixSubscribeFilter,
  handler: Handler<MatrixRawEventEnvelope>
): Promise<MatrixSubscription> {
  return client.subscribe(options, (event) => {
    const raw = "raw" in event ? event.raw : event;
    return handler({
      event,
      kind: "raw",
      raw,
      source: stripUndefined({
        kind: event.kind,
        roomId: "roomId" in event ? event.roomId : undefined,
        type: "type" in event ? event.type : undefined,
      }),
    });
  });
}
