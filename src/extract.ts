import { SAMPLES } from "./samples";
import { extractJson, type Kind, validate, type Validated } from "./schema";
import { extractText, getDocumentProxy } from "unpdf";

const PROMPTS: Record<Kind, string> = {
  ktp: [
    "Ekstrak KTP Indonesia menjadi JSON saja.",
    "Field: provinsi, kota, nik, nama, tempat_lahir, tanggal_lahir, jenis_kelamin,",
    "golongan_darah, alamat, rt_rw, kelurahan, kecamatan, agama, status_perkawinan,",
    "pekerjaan, kewarganegaraan, berlaku_hingga, dikeluarkan_di, tanggal_dikeluarkan.",
    "NIK tetap string 16 digit. Tanggal ISO YYYY-MM-DD.",
    "Field yang tidak terbaca harus null. Jangan menebak.",
  ].join(" "),
  cv: [
    "Rapikan teks CV menjadi satu object JSON saja.",
    "Fields: full_name, title, email, phone, location, summary, links (object), skills (string[]),",
    "experience: [{company,title,start,end,current,highlights:string[]}],",
    "education: [{institution,degree,major,start,end}],",
    "extra: [{section,items:string[]}].",
    "Isi field umum dulu. Informasi lain masuk extra per section.",
    "Field yang tidak tersedia harus null. Jangan membuang informasi dan jangan mengarang.",
  ].join(" "),
  invoice: [
    "Extract this invoice as JSON only.",
    "Fields: supplier, invoice_number, invoice_date (YYYY-MM-DD),",
    "subtotal, tax, total (IDR integers),",
    "items: [{description, quantity, unit_price}].",
    "Unread fields must be null. Do not guess or fix totals.",
  ].join(" "),
};

export type ExtractResult = Validated & {
  source: "model" | "fallback";
  model: string | null;
  latencyMs: number;
  note: string | null;
};

const fromFallback = (
  kind: Kind,
  latencyMs: number,
  note: string,
  useSample = false
): ExtractResult => {
  const validated = validate(kind, useSample ? SAMPLES[kind] : {});
  return {
    ...validated,
    needsReview: true,
    source: "fallback",
    model: null,
    latencyMs,
    note,
  };
};

export const extractDocument = async (
  kind: Kind,
  file: File,
  bytes: Uint8Array,
  env?: { OPENAI_API_KEY?: string; OPENAI_BASE_URL?: string; OPENAI_MODEL?: string }
): Promise<ExtractResult> => {
  const started = performance.now();
  const apiKey = process.env.OPENAI_API_KEY ?? env?.OPENAI_API_KEY;
  if (!apiKey) {
    return fromFallback(
      kind,
      Math.round(performance.now() - started),
      "OPENAI_API_KEY kosong. Demo lanjut pakai fallback JSON.",
      true
    );
  }

  const dataUrl = `data:${file.type || "image/jpeg"};base64,${Buffer.from(bytes).toString("base64")}`;
  const model = env?.OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const base = (env?.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );

  let documentContent: unknown;
  if (kind === "cv" && file.type === "application/pdf") {
    try {
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      if (!text.trim()) {
        return fromFallback(kind, Math.round(performance.now() - started), "PDF tidak memiliki teks yang bisa dibaca.");
      }
      documentContent = `${PROMPTS.cv}\n\nCV:\n${text.slice(0, 60_000)}`;
    } catch (error) {
      return fromFallback(
        kind,
        Math.round(performance.now() - started),
        `PDF gagal dibaca: ${error instanceof Error ? error.message : "format tidak didukung"}`
      );
    }
  } else {
    documentContent = [
      { type: "text", text: "Extract every field. JSON only, without Markdown." },
      { type: "image_url", image_url: { url: dataUrl } },
    ];
  }

  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: PROMPTS[kind] },
          {
            role: "user",
            content: documentContent,
          },
        ],
        temperature: 0,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    return fromFallback(
      kind,
      Math.round(performance.now() - started),
      `Model tidak terjangkau: ${error instanceof Error ? error.message : "network"}`
    );
  }

  const latencyMs = Math.round(performance.now() - started);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let message = detail.slice(0, 240);
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string }; message?: string };
      message = parsed.error?.message || parsed.message || message;
    } catch {}
    return fromFallback(kind, latencyMs, `Model menolak request (${response.status})${message ? `: ${message}` : "."}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return fromFallback(kind, latencyMs, "Model tidak mengembalikan konten.");

  try {
    const validated = validate(kind, extractJson(content));
    return { ...validated, source: "model", model, latencyMs, note: null };
  } catch {
    return fromFallback(kind, latencyMs, "Output model bukan JSON yang valid.");
  }
};
