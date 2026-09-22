import type { Kind } from "./schema";

export const SAMPLES: Record<Kind, unknown> = {
  ktp: {
    nik: "3171234567890123",
    nama: "MIRA SETIAWAN",
    tempat_lahir: "JAKARTA",
    tanggal_lahir: "1986-02-18",
    jenis_kelamin: "PEREMPUAN",
    golongan_darah: "B",
    alamat: "JL. PASTI CEPAT A7/66",
    rt_rw: "007/008",
    kelurahan_desa: "PEGADUNGAN",
    kecamatan: "KALIDERES",
    agama: "ISLAM",
    status_perkawinan: "KAWIN",
    pekerjaan: "PEGAWAI SWASTA",
    kewarganegaraan: "WNI",
    berlaku_hingga: "2017-02-22",
  },
  invoice: {
    supplier: "PT ABC",
    invoice_number: "INV-2026-0914",
    invoice_date: "2026-09-14",
    subtotal: 15000000,
    tax: 1500000,
    total: 16500000,
    items: [{ description: "Product A", quantity: 10, unit_price: 500000 }],
    needs_review: false,
  },
};
