export type Kind = "ktp" | "invoice";

export type Field = {
  key: string;
  label: string;
  type: "string" | "date" | "int";
  required?: boolean;
};

export const KTP_FIELDS: Field[] = [
  { key: "nik", label: "NIK", type: "string", required: true },
  { key: "nama", label: "Nama", type: "string", required: true },
  { key: "tempat_lahir", label: "Tempat lahir", type: "string", required: true },
  { key: "tanggal_lahir", label: "Tanggal lahir", type: "date", required: true },
  { key: "jenis_kelamin", label: "Jenis kelamin", type: "string", required: true },
  { key: "golongan_darah", label: "Golongan darah", type: "string" },
  { key: "alamat", label: "Alamat", type: "string", required: true },
  { key: "rt_rw", label: "RT/RW", type: "string", required: true },
  { key: "kelurahan_desa", label: "Kelurahan/Desa", type: "string", required: true },
  { key: "kecamatan", label: "Kecamatan", type: "string", required: true },
  { key: "agama", label: "Agama", type: "string" },
  { key: "status_perkawinan", label: "Status perkawinan", type: "string" },
  { key: "pekerjaan", label: "Pekerjaan", type: "string", required: true },
  { key: "kewarganegaraan", label: "Kewarganegaraan", type: "string", required: true },
  { key: "berlaku_hingga", label: "Berlaku hingga", type: "date" },
];

export const INVOICE_FIELDS: Field[] = [
  { key: "supplier", label: "Supplier", type: "string", required: true },
  { key: "invoice_number", label: "Nomor invoice", type: "string", required: true },
  { key: "invoice_date", label: "Tanggal", type: "date", required: true },
  { key: "subtotal", label: "Subtotal", type: "int", required: true },
  { key: "tax", label: "Pajak", type: "int", required: true },
  { key: "total", label: "Total", type: "int", required: true },
];

export const FIELDS: Record<Kind, Field[]> = {
  ktp: KTP_FIELDS,
  invoice: INVOICE_FIELDS,
};

export type Issue = { field: string; message: string };

export type Validated = {
  data: Record<string, unknown>;
  issues: Issue[];
  needsReview: boolean;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const normalizeDate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (ISO_DATE.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const normalizeInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^\d-]/g, "");
  if (!digits || digits === "-") return null;
  const parsed = Number(digits);
  return Number.isInteger(parsed) ? parsed : null;
};

export const validate = (kind: Kind, raw: unknown): Validated => {
  const source = asRecord(raw) ?? {};
  const data: Record<string, unknown> = {};
  const issues: Issue[] = [];

  for (const field of FIELDS[kind]) {
    const value = source[field.key];
    const empty = value === null || value === undefined || value === "";

    if (empty) {
      data[field.key] = null;
      if (field.required) {
        issues.push({ field: field.key, message: "kosong, tidak ditebak" });
      }
      continue;
    }

    if (field.type === "date") {
      const date = normalizeDate(value);
      data[field.key] = date;
      if (!date) issues.push({ field: field.key, message: "bukan tanggal ISO" });
      continue;
    }

    if (field.type === "int") {
      const amount = normalizeInt(value);
      data[field.key] = amount;
      if (amount === null) issues.push({ field: field.key, message: "bukan integer" });
      continue;
    }

    if (typeof value !== "string") {
      data[field.key] = null;
      issues.push({ field: field.key, message: "harus string" });
      continue;
    }

    const text = value.trim();
    if (field.key === "nik" && !/^\d{16}$/.test(text)) {
      data[field.key] = text;
      issues.push({ field: field.key, message: "NIK harus 16 digit string" });
      continue;
    }

    data[field.key] = text;
  }

  if (kind === "invoice") {
    const items = Array.isArray(source.items) ? source.items : [];
    data.items = items
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({
        description: typeof item.description === "string" ? item.description : null,
        quantity: typeof item.quantity === "number" ? item.quantity : null,
        unit_price: normalizeInt(item.unit_price),
      }));

    const subtotal = data.subtotal;
    const tax = data.tax;
    const total = data.total;
    if (
      typeof subtotal === "number" &&
      typeof tax === "number" &&
      typeof total === "number" &&
      subtotal + tax !== total
    ) {
      issues.push({
        field: "total",
        message: "subtotal + pajak tidak sama dengan total",
      });
    }
  }

  return { data, issues, needsReview: issues.length > 0 };
};

export const extractJson = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("bukan JSON");
  return JSON.parse(candidate.slice(start, end + 1));
};
