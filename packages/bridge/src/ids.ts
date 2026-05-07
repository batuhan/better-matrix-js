import type { GhostID, PortalID, PortalKey, UserLoginID } from "./types";

export function createPortalKey(id: PortalID, receiver?: UserLoginID): PortalKey {
  return receiver === undefined ? { id } : { id, receiver };
}

export function portalKeyToString(portalKey: PortalKey): string {
  return `${portalKey.receiver ?? ""}\u0000${portalKey.id}`;
}

export function messagePartKey(messageId: string, partId = "0"): string {
  return `${messageId}\u0000${partId}`;
}

export function escapeMatrixLocalpart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._=-]/g, "_");
}

export function ghostLocalpart(prefix: string, id: GhostID): string {
  return `${prefix}_${escapeMatrixLocalpart(id)}`;
}
