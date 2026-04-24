import { describe, expect, it } from "vitest";
import { decodeMatrixThreadId, encodeMatrixThreadId, matrixChannelIdFromThreadId } from "./thread-id";

describe("Matrix thread IDs", () => {
  it("round-trips room IDs", () => {
    const threadId = encodeMatrixThreadId({ roomId: "!abc:example.com" });
    expect(decodeMatrixThreadId(threadId)).toEqual({ roomId: "!abc:example.com" });
  });

  it("round-trips thread root event IDs", () => {
    const threadId = encodeMatrixThreadId({
      eventId: "$event:example.com",
      roomId: "!abc:example.com",
    });
    expect(decodeMatrixThreadId(threadId)).toEqual({
      eventId: "$event:example.com",
      roomId: "!abc:example.com",
    });
  });

  it("derives channel IDs", () => {
    const threadId = encodeMatrixThreadId({
      eventId: "$event:example.com",
      roomId: "!abc:example.com",
    });
    expect(matrixChannelIdFromThreadId(threadId)).toBe(
      encodeMatrixThreadId({ roomId: "!abc:example.com" })
    );
  });
});

