export type Kind = "ktp" | "cv";

export type Field = {
  key: string;
  label: string;
  type: "string" | "date" | "int";
  required?: boolean;
};

export const KTP_FIELDS: Field[] = [
  { key: "provinsi", label: "Provinsi", type: "string", required: true },
  { key: "kota", label: "Kota", type: "string", required: true },
  { key: "nik", label: "NIK", type: "string", required: true },
  { key: "nama", label: "Nama", type: "string", required: true },
  { key: "tempat_lahir", label: "Tempat lahir", type: "string", required: true },
  { key: "tanggal_lahir", label: "Tanggal lahir", type: "date", required: true },
  { key: "jenis_kelamin", label: "Jenis kelamin", type: "string", required: true },
  { key: "golongan_darah", label: "Golongan darah", type: "string" },
  { key: "alamat", label: "Alamat", type: "string", required: true },
  { key: "rt_rw", label: "RT/RW", type: "string", required: true },
  { key: "kelurahan", label: "Kelurahan", type: "string", required: true },
  { key: "kecamatan", label: "Kecamatan", type: "string", required: true },
  { key: "agama", label: "Agama", type: "string" },
  { key: "status_perkawinan", label: "Status perkawinan", type: "string" },
  { key: "pekerjaan", label: "Pekerjaan", type: "string", required: true },
  { key: "kewarganegaraan", label: "Kewarganegaraan", type: "string", required: true },
  { key: "berlaku_hingga", label: "Berlaku hingga", type: "date" },
  { key: "dikeluarkan_di", label: "Dikeluarkan di", type: "string" },
  { key: "tanggal_dikeluarkan", label: "Tanggal dikeluarkan", type: "date" },
];

export const CV_FIELDS: Field[] = [
  { key: "full_name", label: "Nama lengkap", type: "string", required: true },
  { key: "title", label: "Posisi", type: "string" },
  { key: "email", label: "Email", type: "string" },
  { key: "phone", label: "Telepon", type: "string" },
  { key: "location", label: "Lokasi", type: "string" },
  { key: "summary", label: "Ringkasan", type: "string" },
];

export const FIELDS: Record<Kind, Field[]> = {
  ktp: KTP_FIELDS,
  cv: CV_FIELDS,
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

  if (kind === "cv") {
    const strings = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    const records = (value: unknown) =>
      Array.isArray(value)
        ? value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null)
        : [];

    data.links = asRecord(source.links) ?? {};
    data.skills = strings(source.skills);
    data.experience = records(source.experience);
    data.education = records(source.education);
    data.extra = records(source.extra);
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
