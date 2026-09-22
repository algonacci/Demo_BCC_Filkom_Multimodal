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
const show = (file) => {
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  empty?.classList.add("hidden");
  document.querySelectorAll("[data-action]").forEach((node) => node.classList.remove("hidden"));
  if (file.type.startsWith("image/")) preview.src = URL.createObjectURL(file);
  if (label) label.textContent = file.name;
  if (hint) hint.textContent = "Lepas untuk ganti file";
};
const clear = () => {
  input.value = "";
  preview.removeAttribute("src");
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
`;

export const Page: FC<{
  kind: Kind;
  fileName?: string;
  preview?: string;
  result?: ExtractResult;
  error?: string;
}> = ({ kind, fileName, preview, result, error }) => (
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
              BCC Filkom
            </p>
            <h1 class="mt-1 text-4xl font-extrabold tracking-tight text-slate-950">
              Foto jadi record.
            </h1>
          </div>
          <p class="hidden max-w-xs text-right text-sm leading-6 text-slate-500 sm:block">
            Bandingkan dokumen asli dengan field yang berhasil dibaca.
          </p>
        </header>

        <form method="post" action="/" enctype="multipart/form-data">
          <div class="mb-5 grid w-56 grid-cols-2 rounded-full bg-white p-1 text-sm font-bold shadow-sm">
            {(["ktp", "invoice"] as const).map((option) => (
              <label class="cursor-pointer">
                <input
                  class="peer sr-only"
                  type="radio"
                  name="kind"
                  value={option}
                  checked={kind === option}
                />
                <span class="block rounded-full px-5 py-2 text-center text-slate-500 peer-checked:bg-orange-500 peer-checked:text-white">
                  {option === "ktp" ? "KTP" : "Invoice"}
                </span>
              </label>
            ))}
          </div>

          {error ? (
            <p class="mb-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <section class="grid items-stretch gap-5 lg:grid-cols-2">
            <article
              class="flex h-[36rem] flex-col overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-orange-100"
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
                      Pilih {kind === "ktp" ? "KTP" : "invoice"}
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
                    class="max-h-full w-full rounded-2xl object-contain"
                    data-preview
                    src={preview || ""}
                  />
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

            <article class="relative flex h-[36rem] flex-col overflow-hidden rounded-[2rem] bg-white p-5 shadow-xl shadow-sky-100">
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
                  <dl class="grid gap-2 sm:grid-cols-2">
                    {FIELDS[kind].map((field, index) => (
                      <Field
                        key={field.key}
                        label={field.label}
                        value={
                          field.type === "int"
                            ? money(result.data[field.key])
                            : String(result.data[field.key] ?? "null")
                        }
                        missing={result.data[field.key] == null}
                        delay={index * 45}
                      />
                    ))}
                  </dl>
                  <details>
                    <summary class="cursor-pointer text-sm font-bold text-slate-500">
                      JSON
                    </summary>
                    <pre class="mt-3 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-orange-100">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
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
