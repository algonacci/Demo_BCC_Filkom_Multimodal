import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ExtractResult } from "./extract";
import { extractDocument } from "./extract";
import { Home, Page } from "./page";
import { ChatPage } from "./chat";
import type { Kind } from "./schema";

type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

type Bindings = {
  RESULTS?: KVNamespace;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  STT_BASE_URL?: string;
  STT_API_KEY?: string;
};

type Saved = ExtractResult & { kind: Kind; fileName: string; preview?: string };

const app = new Hono<{ Bindings: Bindings }>();
const MAX_BYTES = 4_000_000;
const RESULT_COOKIE = "demo-result";
const results = new Map<string, Saved>();

const isKind = (value: unknown): value is Kind => value === "ktp" || value === "cv";

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
  return c.html(<Home />);
});

app.get("/health", (c) =>
  c.json({
    ok: true,
    model: Boolean(c.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY),
  })
);

app.get("/chat", (c) => c.html(<ChatPage />));

app.post("/api/transcribe", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File) || file.size === 0) return c.json({ error: "Audio kosong." }, 400);
  if (file.size > 12_000_000) return c.json({ error: "Audio lebih dari 12 MB." }, 400);

  const base = (c.env.STT_BASE_URL || process.env.STT_BASE_URL || "https://stt-service.ngodings.my.id").replace(/\/$/, "");
  const apiKey = c.env.STT_API_KEY || process.env.STT_API_KEY;
  const form = new FormData();
  form.set("file", file, file.name || "recording.webm");
  form.set("model", "whisper-large-v3-turbo");
  form.set("language", "id");
  form.set("response_format", "json");
  form.set("engine", "cloudflare");

  let response: Response;
  try {
    response = await fetch(`${base}/v1/audio/transcriptions`, {
      method: "POST",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return c.json({ error: "Layanan transkripsi tidak terjangkau." }, 502);
  }
  const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string; detail?: string };
  if (!response.ok) return c.json({ error: payload.error || payload.detail || `STT menolak request (${response.status}).` }, 502);
  if (!payload.text?.trim()) return c.json({ error: "Transkripsi kosong." }, 502);
  return c.json({ text: payload.text.trim(), model: "whisper-large-v3-turbo" });
});

app.post("/api/chat", async (c) => {
  const apiKey = c.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return c.json({ error: "Model chat belum dikonfigurasi." }, 503);
  const body: { messages?: { role: string; content: string }[] } = await c.req
    .json<{ messages?: { role: string; content: string }[] }>()
    .catch(() => ({}));
  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((message) => ["user", "assistant"].includes(message.role) && typeof message.content === "string")
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content.slice(0, 8_000) }))
    : [];
  if (!messages.length || messages.at(-1)?.role !== "user") return c.json({ error: "Pesan pengguna diperlukan." }, 400);

  const base = (c.env.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.orvix.id/v1").replace(/\/$/, "");
  const model = c.env.OPENAI_MODEL || process.env.OPENAI_MODEL || "orvix/gpt-5.6-sol";
  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: "Jawab dalam Bahasa Indonesia dengan jelas dan ringkas." }, ...messages], max_tokens: 2048 }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return c.json({ error: "Model chat tidak terjangkau." }, 502);
  }
  const payload = (await response.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!response.ok || !content) return c.json({ error: payload.error?.message || `Model menolak request (${response.status}).` }, 502);
  return c.json({ content, model });
});

app.post("/api/cv-chat", async (c) => {
  const apiKey = c.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return c.json({ error: "Model chat belum dikonfigurasi." }, 503);
  const body: { cv?: unknown; question?: string } = await c.req.json().catch(() => ({}));
  if (!body.cv || typeof body.question !== "string" || !body.question.trim()) {
    return c.json({ error: "Konteks CV dan pertanyaan diperlukan." }, 400);
  }
  const context = JSON.stringify(body.cv).slice(0, 30_000);
  const base = (c.env.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.orvix.id/v1").replace(/\/$/, "");
  const model = c.env.OPENAI_MODEL || process.env.OPENAI_MODEL || "orvix/gpt-5.6-sol";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Anda adalah HR reviewer. Jawab hanya berdasarkan CV yang diberikan. Pisahkan fakta dari saran, sebutkan jika informasi tidak tersedia, dan jangan mengarang pengalaman kandidat." },
        { role: "user", content: `CV JSON:\n${context}\n\nPertanyaan HR:\n${body.question.slice(0, 2_000)}` },
      ],
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);
  if (!response) return c.json({ error: "Model HR tidak terjangkau." }, 502);
  const payload = (await response.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!response.ok || !content) return c.json({ error: payload.error?.message || `Model menolak request (${response.status}).` }, 502);
  return c.json({ content, model });
});

app.get("/:kind", async (c) => {
  const routeKind = c.req.param("kind");
  if (!isKind(routeKind)) return c.notFound();
  const id = getCookie(c, RESULT_COOKIE);
  const saved = await loadResult(id, c.env.RESULTS);
  if (id) deleteCookie(c, RESULT_COOKIE);
  return c.html(
    <Page
      kind={saved?.kind ?? routeKind}
      fileName={saved?.fileName}
      preview={saved?.preview}
      result={saved}
    />
  );
});

app.post("/:kind", async (c) => {
  const body = await c.req.parseBody();
  const routeKind = c.req.param("kind");
  if (!isKind(routeKind)) return c.notFound();
  const kind = isKind(body.kind) ? body.kind : routeKind;
  const file = body.file;

  if (!(file instanceof File) || file.size === 0) {
    return c.html(<Page kind={kind} error="Pilih gambar atau PDF dulu." />, 400);
  }
  if (file.size > MAX_BYTES) {
    return c.html(<Page kind={kind} error="File lebih dari 4 MB. Kecilkan dulu." />, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const previewBytes = bytes.slice();
  const result = await extractDocument(kind, file, bytes, c.env);
  const id = crypto.randomUUID();
  const saved: Saved = {
    ...result,
    kind,
    fileName: file.name,
    preview: file.type.startsWith("image/") || file.type === "application/pdf"
      ? `data:${file.type};base64,${Buffer.from(previewBytes).toString("base64")}`
      : undefined,
  };
  if (c.env.RESULTS) await c.env.RESULTS.put(id, JSON.stringify(saved), { expirationTtl: 120 });
  else results.set(id, saved);
  setCookie(c, RESULT_COOKIE, id, { httpOnly: true, path: "/", maxAge: 120 });
  return c.redirect(`/${kind}`);
});

export default {
  port: Number(process.env.PORT || 3000),
  fetch: app.fetch,
};
