export { isBeeperHomeserver } from "./homeserver";
import type { StreamChunk } from "chat";

export type MatrixStream = AsyncIterable<string | StreamChunk | Record<string, unknown>>;
