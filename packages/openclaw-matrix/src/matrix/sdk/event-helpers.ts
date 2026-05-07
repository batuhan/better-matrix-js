export function buildHttpError(status: number, body: string): Error & { statusCode?: number } {
  const error = new Error(`Matrix HTTP ${status}: ${body}`);
  (error as Error & { statusCode?: number }).statusCode = status;
  return error as Error & { statusCode?: number };
}

export function parseMxc(mxcUrl: string): { server: string; mediaId: string } | null {
  const match = /^mxc:\/\/([^/]+)\/(.+)$/.exec(mxcUrl);
  return match ? { server: match[1]!, mediaId: match[2]! } : null;
}

export function matrixEventToRaw(event: unknown): Record<string, unknown> {
  return event && typeof event === "object" ? (event as Record<string, unknown>) : {};
}
