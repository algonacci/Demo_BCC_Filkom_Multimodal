import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ExtractResult } from "./extract";
import { extractDocument } from "./extract";
import { Page } from "./page";
import type { Kind } from "./schema";

type Bindings = {
  RESULTS?: KVNamespace;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
};

type Saved = ExtractResult & { kind: Kind; fileName: string; preview?: string };

const app = new Hono<{ Bindings: Bindings }>();
const MAX_BYTES = 4_000_000;
const RESULT_COOKIE = "demo-result";
const results = new Map<string, Saved>();

const isKind = (value: unknown): value is Kind => value === "ktp" || value === "invoice";

const loadResult = async (id: string | undefined, kv?: KVNamespace) => {
  if (!id) return undefined;
  if (kv) {
    const raw = await kv.get(id);
    if (!raw) return undefined;
    cWaitDelete(kv, id);
    return JSON.parse(raw) as Saved;
  }
  const saved = results.get(id);
  results.delete(id);
  return saved;
};

const cWaitDelete = (kv: KVNamespace, id: string) => {
  void kv.delete(id);
};

app.get("/", async (c) => {
  const id = getCookie(c, RESULT_COOKIE);
  const saved = await loadResult(id, c.env.RESULTS);
  if (id) deleteCookie(c, RESULT_COOKIE);
  return c.html(
    <Page
      kind={saved?.kind ?? "ktp"}
      fileName={saved?.fileName}
      preview={saved?.preview}
      result={saved}
    />
  );
});

app.get("/health", (c) =>
  c.json({
    ok: true,
    model: Boolean(c.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY),
  })
);

app.post("/", async (c) => {
  const body = await c.req.parseBody();
  const kind = isKind(body.kind) ? body.kind : "ktp";
  const file = body.file;

  if (!(file instanceof File) || file.size === 0) {
    return c.html(<Page kind={kind} error="Pilih gambar atau PDF dulu." />, 400);
  }
  if (file.size > MAX_BYTES) {
    return c.html(<Page kind={kind} error="File lebih dari 4 MB. Kecilkan dulu." />, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await extractDocument(kind, file, bytes, c.env);
  const id = crypto.randomUUID();
  const saved: Saved = {
    ...result,
    kind,
    fileName: file.name,
    preview: file.type.startsWith("image/")
      ? `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`
      : undefined,
  };
  if (c.env.RESULTS) await c.env.RESULTS.put(id, JSON.stringify(saved), { expirationTtl: 120 });
  else results.set(id, saved);
  setCookie(c, RESULT_COOKIE, id, { httpOnly: true, path: "/", maxAge: 120 });
  return c.redirect("/");
});

export default {
  port: Number(process.env.PORT || 3000),
  fetch: app.fetch,
};
