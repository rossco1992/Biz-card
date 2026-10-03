export class RequestBodyError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function readRequestText(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError("Request body is too large.", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyError("Request body is too large.", 413);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const raw = await readRequestText(request, maxBytes);
  if (!raw) throw new RequestBodyError("Invalid request.", 400);

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new RequestBodyError("Invalid request.", 400);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestBodyError("Invalid request.", 400);
  }
  return value as Record<string, unknown>;
}
