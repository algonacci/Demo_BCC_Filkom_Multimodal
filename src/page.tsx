import type { Child, FC } from "hono/jsx";
import type { ExtractResult } from "./extract";
import { FIELDS, type Kind } from "./schema";

const money = (value: unknown) =>
  typeof value === "number"
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(value)
    : "—";

const client = `
const input = document.querySelector("[data-file]");
const preview = document.querySelector("[data-preview]");
const empty = document.querySelector("[data-empty]");
const drop = document.querySelector("[data-drop]");
const label = document.querySelector("[data-label]");
const hint = document.querySelector("[data-hint]");
const pdf = document.querySelector("[data-pdf]");
const pdfFrame = document.querySelector("[data-pdf-frame]");
const show = (file) => {
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  empty?.classList.add("hidden");
  document.querySelectorAll("[data-action]").forEach((node) => node.classList.remove("hidden"));
  if (file.type.startsWith("image/")) {
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
    pdf?.classList.add("hidden");
  } else {
    preview.removeAttribute("src");
    preview.classList.add("hidden");
    if (pdfFrame) pdfFrame.src = URL.createObjectURL(file);
    pdfFrame?.classList.remove("hidden");
    pdf?.classList.add("hidden");
  }
  if (label) label.textContent = file.name;
  if (hint) hint.textContent = "Lepas untuk ganti file";
};
const clear = () => {
  input.value = "";
  preview.removeAttribute("src");
  preview.classList.remove("hidden");
  pdfFrame?.removeAttribute("src");
  pdfFrame?.classList.add("hidden");
  pdf?.classList.add("hidden");
  empty?.classList.remove("hidden");
  document.querySelectorAll("[data-action]").forEach((node) => node.classList.add("hidden"));
  if (label) label.textContent = "Dokumen";
};
input?.addEventListener("change", () => show(input.files?.[0]));
document.querySelector("[data-clear]")?.addEventListener("click", clear);
["dragenter", "dragover"].forEach((name) => {
  drop?.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.add("ring-4", "ring-orange-300");
  });
});
["dragleave", "drop"].forEach((name) => {
  drop?.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.remove("ring-4", "ring-orange-300");
  });
});
drop?.addEventListener("drop", (event) => show(event.dataTransfer?.files?.[0]));
const button = document.querySelector("[data-submit]");
const record = document.querySelector("[data-record]");
const waiting = document.querySelector("[data-waiting]");
document.querySelector("form")?.addEventListener("submit", () => {
  if (button) {
    button.disabled = true;
    button.textContent = "Lagi dibaca…";
    button.classList.add("cursor-wait", "bg-orange-300");
  }
  record?.classList.add("hidden");
  document.querySelector("[data-placeholder]")?.classList.add("hidden");
  waiting?.classList.remove("hidden");
  waiting?.classList.add("flex");
});
document.querySelectorAll('[data-cv-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.cvTab;
    document.querySelectorAll('[data-cv-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.cvPanel !== target));
    document.querySelectorAll('[data-cv-tab]').forEach((tab) => {
      tab.classList.toggle('bg-slate-950', tab.dataset.cvTab === target);
      tab.classList.toggle('text-white', tab.dataset.cvTab === target);
    });
  });
});
document.querySelector('[data-copy-markdown]')?.addEventListener('click', async (event) => {
  const markdown = document.querySelector('[data-markdown]')?.textContent || '';
  await navigator.clipboard.writeText(markdown);
  event.currentTarget.textContent = 'Tersalin';
});
document.querySelector('[data-hr-form]')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = document.querySelector('[data-hr-question]');
  const answer = document.querySelector('[data-hr-answer]');
  const button = document.querySelector('[data-hr-submit]');
  if (!question?.value.trim()) return;
  button.disabled = true;
  answer.textContent = 'HR sedang meninjau CV…';
  try {
    const cv = JSON.parse(document.querySelector('[data-cv-json]').textContent);
    const response = await fetch('/api/cv-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cv, question: question.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Review gagal');
    answer.textContent = data.content;
  } catch (error) {
    answer.textContent = error.message || 'Review gagal. Coba lagi.';
  } finally {
    button.disabled = false;
  }
});
`;

const asRecords = (value: unknown) => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const cvMarkdown = (data: Record<string, unknown>) => {
  const lines = [`# ${data.full_name || "Kandidat"}`, data.title ? `**${data.title}**` : ""];
  const contact = [data.email, data.phone, data.location].filter(Boolean).join(" · ");
  if (contact) lines.push("", contact);
  if (data.summary) lines.push("", "## Ringkasan", String(data.summary));
  const skills = asStrings(data.skills);
  if (skills.length) lines.push("", "## Keahlian", skills.map((item) => `- ${item}`).join("\n"));
  const experience = asRecords(data.experience);
  if (experience.length) {
    lines.push("", "## Pengalaman");
    for (const item of experience) {
      lines.push("", `### ${item.title || "Peran"} · ${item.company || "Perusahaan"}`, [item.start, item.end || (item.current ? "Sekarang" : null)].filter(Boolean).join(" — "));
      lines.push(...asStrings(item.highlights).map((highlight) => `- ${highlight}`));
    }
  }
  const education = asRecords(data.education);
  if (education.length) {
    lines.push("", "## Pendidikan");
    for (const item of education) lines.push(`- **${item.institution || "Institusi"}** — ${[item.degree, item.major].filter(Boolean).join(", ")}`);
  }
  for (const section of asRecords(data.extra)) {
    lines.push("", `## ${section.section || "Tambahan"}`, ...asStrings(section.items).map((item) => `- ${item}`));
  }
  return lines.filter((line, index) => line !== "" || lines[index - 1] !== "").join("\n").trim();
};

export const Page: FC<{
  kind: Kind;
  fileName?: string;
  preview?: string;
  result?: ExtractResult;
  error?: string;
}> = ({ kind, fileName, preview, result, error }) => {
  const copy = {
    ktp: {
      eyebrow: "Vision OCR",
      title: "KTP jadi data terstruktur.",
      description: "Unggah foto KTP, periksa setiap field, lalu tinjau data yang belum terbaca.",
    },
    cv: {
      eyebrow: "Document AI",
      title: "CV jadi profil kandidat.",
      description: "Unggah CV PDF untuk menyusun identitas, pengalaman, pendidikan, dan keahlian.",
    },
    invoice: {
      eyebrow: "Finance OCR",
      title: "Invoice jadi record siap pakai.",
      description: "Unggah invoice untuk membaca supplier, nomor dokumen, item, pajak, dan total.",
    },
  }[kind];

  return (
  <html lang="id">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>BCC Filkom · Multimodal Demo</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap"
        rel="stylesheet"
      />
      <script src="https://cdn.tailwindcss.com" />
      <style>{`@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </head>
    <body class="min-h-screen bg-[#fff7ed] font-['Plus_Jakarta_Sans'] text-slate-800">
      <div class="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-orange-200/70 to-transparent" />
      <main class="relative mx-auto max-w-6xl px-5 py-8">
        <header class="mb-6 flex items-end justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.22em] text-orange-500">
              BCC Filkom · {copy.eyebrow}
            </p>
            <h1 class="mt-1 text-4xl font-extrabold tracking-tight text-slate-950">
              {copy.title}
            </h1>
          </div>
          <p class="hidden max-w-xs text-right text-sm leading-6 text-slate-500 sm:block">
            {copy.description}
          </p>
        </header>

        <form method="post" action={`/${kind}`} enctype="multipart/form-data">
          <input type="hidden" name="kind" value={kind} />
          <nav class="mb-5 flex flex-wrap items-center gap-2 text-sm font-bold">
            <a class="rounded-full bg-white px-4 py-2 text-slate-500 shadow-sm hover:text-orange-600" href="/">
              ← Semua fitur
            </a>
            <span class="rounded-full bg-orange-500 px-4 py-2 text-white">
              {kind === "ktp" ? "KTP" : kind === "cv" ? "CV" : "Invoice"}
            </span>
          </nav>

          {error ? (
            <p class="mb-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <section class="space-y-5">
            <article
              class="flex min-h-[32rem] flex-col overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-orange-100"
              data-drop
            >
              <div class="flex items-center justify-between gap-3 px-5 py-4">
                <h2 class="truncate font-extrabold" data-label>
                  {fileName || "Dokumen"}
                </h2>
                <button
                  class={`rounded-full px-3 py-1 text-xs font-bold text-slate-400 hover:bg-rose-50 hover:text-rose-500 ${preview ? "" : "hidden"}`}
                  data-action
                  data-clear
                  type="button"
                >
                  Hapus
                </button>
              </div>
              <label
                class={`min-h-0 flex-1 cursor-pointer ${preview ? "hidden" : ""}`}
                data-empty
              >
                <input
                  class="sr-only"
                  data-file
                  type="file"
                  name="file"
                  accept="image/*,application/pdf"
                  required
                />
                <span class="grid h-full place-items-center bg-orange-50 px-8 text-center">
                  <span>
                    <span class="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-2xl text-orange-500 shadow-sm">
                      +
                    </span>
                    <span class="mt-4 block text-lg font-extrabold text-slate-900">
                      Pilih {kind === "ktp" ? "KTP" : kind === "cv" ? "CV PDF" : "invoice"}
                    </span>
                    <span class="mt-1 block text-sm text-slate-400" data-hint>
                      Klik atau jatuhkan file di sini
                    </span>
                  </span>
                </span>
              </label>
              <div class={`flex min-h-0 flex-1 flex-col ${preview ? "" : "hidden"}`} data-action>
                <div class="grid min-h-0 flex-1 place-items-center bg-orange-50 p-4">
                   <img
                    alt="Preview dokumen"
                     class={`max-h-full w-full rounded-2xl object-contain ${preview?.startsWith("data:application/pdf") ? "hidden" : ""}`}
                    data-preview
                     src={preview || ""}
                   />
                   <iframe
                     class={`h-full min-h-[24rem] w-full rounded-2xl bg-white ${preview?.startsWith("data:application/pdf") ? "" : "hidden"}`}
                     data-pdf-frame
                     src={preview?.startsWith("data:application/pdf") ? preview : undefined}
                     title="Preview PDF"
                   />
                   <div class="hidden text-center" data-pdf>
                     <span class="mx-auto grid h-20 w-16 place-items-center rounded-xl bg-rose-500 text-sm font-extrabold text-white shadow-lg">PDF</span>
                     <p class="mt-4 text-sm font-bold text-slate-600">Dokumen siap diekstrak</p>
                   </div>
                </div>
                <div class="border-t border-orange-100 p-4">
                  <button
                    class="w-full rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white transition disabled:cursor-wait disabled:bg-orange-300"
                    data-submit
                    type="submit"
                  >
                    Ekstrak
                  </button>
                </div>
              </div>
            </article>

            <article class="relative flex min-h-[32rem] flex-col overflow-hidden rounded-[2rem] bg-white p-5 shadow-xl shadow-sky-100 sm:p-7">
              <div
                class="absolute inset-0 z-10 hidden items-center justify-center bg-white/80 backdrop-blur-sm"
                data-waiting
              >
                <div class="text-center">
                  <span class="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
                  <p class="mt-4 text-sm font-extrabold text-slate-700">Lagi dibaca…</p>
                </div>
              </div>
              {result ? (
                <div class="min-h-0 flex-1 space-y-4 overflow-auto" data-record>
                  <div class="flex items-center justify-between gap-3">
                    <h2 class="font-extrabold">
                      {result.needsReview ? "Perlu review" : "Lolos schema"}
                    </h2>
                    <span class="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                      {result.latencyMs} ms
                    </span>
                  </div>
                  {result.note ? (
                    <p class="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {result.note}
                    </p>
                  ) : null}
                  {kind === "cv" ? <CvWorkspace data={result.data} /> : (
                    <>
                      <dl class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {FIELDS[kind].map((field, index) => (
                          <Field
                            key={field.key}
                            label={field.label}
                            value={field.type === "int" ? money(result.data[field.key]) : String(result.data[field.key] ?? "null")}
                            missing={result.data[field.key] == null}
                            delay={index * 45}
                          />
                        ))}
                      </dl>
                      <details>
                        <summary class="cursor-pointer text-sm font-bold text-slate-500">JSON</summary>
                        <pre class="mt-3 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-orange-100">{JSON.stringify(result.data, null, 2)}</pre>
                      </details>
                    </>
                  )}
                </div>
              ) : (
                <div class="grid min-h-0 flex-1 place-items-center text-center" data-placeholder>
                  <div>
                    <p class="text-lg font-extrabold text-slate-900">Record belum ada.</p>
                    <p class="mt-1 text-sm text-slate-400">
                      Field yang terbaca akan tersusun di sini.
                    </p>
                  </div>
                </div>
              )}
            </article>
          </section>
        </form>
      </main>
      <script dangerouslySetInnerHTML={{ __html: client }} />
    </body>
  </html>
  );
};

const CvWorkspace: FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const experience = asRecords(data.experience);
  const education = asRecords(data.education);
  const skills = asStrings(data.skills);
  const extras = asRecords(data.extra);
  const markdown = cvMarkdown(data);
  return (
    <div>
      <script type="application/json" data-cv-json dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
      <div class="mb-6 flex flex-wrap gap-2">
        {[["profile", "Profil"], ["markdown", "Markdown"], ["hr", "Tanya HR"]].map(([id, label], index) => (
          <button class={`rounded-full px-4 py-2 text-sm font-bold ${index === 0 ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500"}`} data-cv-tab={id} type="button">{label}</button>
        ))}
      </div>
      <div class="space-y-8" data-cv-panel="profile">
        <section class="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 p-7 text-white">
          <p class="text-sm font-bold text-orange-300">{String(data.title ?? "Profil kandidat")}</p>
          <h3 class="mt-2 text-3xl font-extrabold">{String(data.full_name ?? "Nama tidak terbaca")}</h3>
          <p class="mt-3 text-sm leading-6 text-slate-300">{String(data.summary ?? "Ringkasan belum tersedia.")}</p>
          <p class="mt-5 text-xs text-slate-400">{[data.email, data.phone, data.location].filter(Boolean).join(" · ")}</p>
        </section>
        {skills.length ? <section><h3 class="text-sm font-extrabold uppercase tracking-wider text-slate-400">Keahlian</h3><div class="mt-3 flex flex-wrap gap-2">{skills.map((skill) => <span class="rounded-full bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">{skill}</span>)}</div></section> : null}
        {experience.length ? <section><h3 class="text-sm font-extrabold uppercase tracking-wider text-slate-400">Pengalaman</h3><div class="mt-4 space-y-4">{experience.map((item) => <article class="rounded-3xl border border-slate-100 p-5"><div class="flex flex-wrap justify-between gap-2"><div><h4 class="font-extrabold">{String(item.title ?? "Peran")}</h4><p class="text-sm text-slate-500">{String(item.company ?? "Perusahaan")}</p></div><span class="text-xs font-bold text-slate-400">{[item.start, item.end || (item.current ? "Sekarang" : null)].filter(Boolean).join(" — ")}</span></div><ul class="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">{asStrings(item.highlights).map((highlight) => <li>{highlight}</li>)}</ul></article>)}</div></section> : null}
        {education.length ? <section><h3 class="text-sm font-extrabold uppercase tracking-wider text-slate-400">Pendidikan</h3><div class="mt-4 grid gap-3 sm:grid-cols-2">{education.map((item) => <article class="rounded-3xl bg-sky-50 p-5"><h4 class="font-extrabold">{String(item.institution ?? "Institusi")}</h4><p class="mt-1 text-sm text-slate-600">{[item.degree, item.major].filter(Boolean).join(" · ")}</p></article>)}</div></section> : null}
        {extras.map((section) => <section><h3 class="text-sm font-extrabold uppercase tracking-wider text-slate-400">{String(section.section ?? "Tambahan")}</h3><ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{asStrings(section.items).map((item) => <li>{item}</li>)}</ul></section>)}
      </div>
      <div class="hidden" data-cv-panel="markdown"><div class="mb-3 flex justify-end"><button class="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white" data-copy-markdown type="button">Salin Markdown</button></div><pre class="whitespace-pre-wrap rounded-[2rem] bg-slate-950 p-6 text-sm leading-7 text-slate-200" data-markdown>{markdown}</pre></div>
      <div class="hidden" data-cv-panel="hr"><div class="grid gap-5 lg:grid-cols-[1fr_1.4fr]"><form class="rounded-[2rem] bg-orange-50 p-5" data-hr-form><label class="text-sm font-extrabold">Tanyakan sesuatu tentang kandidat</label><textarea class="mt-3 min-h-32 w-full rounded-2xl border-0 bg-white p-4 text-sm outline-none ring-orange-300 focus:ring-2" data-hr-question placeholder="Contoh: Apa kekuatan utama kandidat ini?" /><button class="mt-3 w-full rounded-2xl bg-orange-500 py-3 text-sm font-extrabold text-white disabled:bg-orange-300" data-hr-submit type="submit">Tanya HR</button></form><div class="min-h-64 whitespace-pre-wrap rounded-[2rem] bg-slate-950 p-6 text-sm leading-7 text-slate-200" data-hr-answer>Pilih pertanyaan untuk memulai review berbasis CV.</div></div></div>
      <details class="mt-6"><summary class="cursor-pointer text-sm font-bold text-slate-500">JSON mentah</summary><pre class="mt-3 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-orange-100">{JSON.stringify(data, null, 2)}</pre></details>
    </div>
  );
};

const menus: { kind: Kind; title: string; eyebrow: string; description: string; tone: string }[] = [
  { kind: "ktp", title: "Ekstraksi KTP", eyebrow: "Vision OCR", description: "Ubah foto identitas menjadi record terstruktur dan tandai field yang perlu ditinjau.", tone: "from-orange-500 to-amber-400" },
  { kind: "cv", title: "Parser CV", eyebrow: "Document AI", description: "Unggah CV PDF, susun profil, pengalaman, pendidikan, skill, dan section tambahan.", tone: "from-sky-500 to-cyan-400" },
  { kind: "invoice", title: "Ekstraksi Invoice", eyebrow: "Finance OCR", description: "Baca supplier, nomor dokumen, item, pajak, dan total untuk proses administrasi.", tone: "from-violet-500 to-fuchsia-400" },
];

export const Home: FC = () => (
  <html lang="id">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>BCC Filkom · Multimodal Lab</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet" />
      <script src="https://cdn.tailwindcss.com" />
    </head>
    <body class="min-h-screen bg-[#fff7ed] font-['Plus_Jakarta_Sans'] text-slate-900">
      <div class="pointer-events-none fixed inset-x-0 top-0 h-80 bg-gradient-to-b from-orange-200/70 to-transparent" />
      <main class="relative mx-auto max-w-6xl px-5 py-12 sm:py-20">
        <p class="text-xs font-extrabold uppercase tracking-[0.25em] text-orange-500">BCC Filkom · Multimodal Lab</p>
        <h1 class="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">Satu pintu untuk membaca dokumen.</h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">Pilih workflow, unggah dokumen, lalu bandingkan hasil model dengan schema yang siap dipakai aplikasi.</p>
        <section class="mt-12 grid gap-5 md:grid-cols-2">
          {menus.map((menu, index) => (
            <a class="group flex min-h-72 flex-col overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-orange-100 transition hover:-translate-y-1" href={`/${menu.kind}`}>
              <div class={`h-2 bg-gradient-to-r ${menu.tone}`} />
              <div class="flex flex-1 flex-col p-7">
                <span class="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">{String(index + 1).padStart(2, "0")} · {menu.eyebrow}</span>
                <h2 class="mt-6 text-2xl font-extrabold">{menu.title}</h2>
                <p class="mt-3 text-sm leading-6 text-slate-500">{menu.description}</p>
                <span class="mt-auto pt-8 text-sm font-extrabold text-orange-600">Buka fitur <span class="inline-block transition group-hover:translate-x-1">→</span></span>
              </div>
            </a>
          ))}
          <a class="group flex min-h-72 flex-col overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl shadow-slate-200 transition hover:-translate-y-1" href="/chat">
            <div class="h-2 bg-gradient-to-r from-emerald-400 to-teal-300" />
            <div class="flex flex-1 flex-col p-7">
              <span class="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">04 · Speech + LLM</span>
              <h2 class="mt-6 text-2xl font-extrabold">Voice Chat</h2>
              <p class="mt-3 text-sm leading-6 text-slate-300">Rekam suara, transkripsikan dengan Whisper Large V3 Turbo, lalu lanjutkan sebagai percakapan AI.</p>
              <span class="mt-auto pt-8 text-sm font-extrabold text-emerald-300">Mulai ngobrol <span class="inline-block transition group-hover:translate-x-1">→</span></span>
            </div>
          </a>
        </section>
      </main>
    </body>
  </html>
);

const Field: FC<{
  label: string;
  value: string;
  missing: boolean;
  delay: number;
}> = ({ label, value, missing, delay }) => (
  <div
    class={`animate-[rise_0.45s_ease_both] rounded-2xl px-3 py-2 ${missing ? "bg-rose-50" : "bg-orange-50"}`}
    style={`animation-delay:${delay}ms`}
  >
    <dt class="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd class={`mt-0.5 text-sm font-bold ${missing ? "text-rose-400" : "text-slate-900"}`}>
      {value as Child}
    </dd>
  </div>
);
