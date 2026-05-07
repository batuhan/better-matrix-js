export async function encryptAttachment(buffer: Buffer): Promise<{ data: Buffer; info: Record<string, unknown> }> {
  return { data: buffer, info: {} };
}

export async function decryptAttachment(buffer: Buffer): Promise<Buffer> {
  return buffer;
}
