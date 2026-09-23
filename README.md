# Demo BCC Filkom Multimodal

Fullstack Bun + Hono untuk ekstraksi KTP, parsing CV PDF, HR review, dan voice chat. Model mengembalikan JSON yang divalidasi schema; tanpa API key, demo dokumen tetap dapat memakai fallback JSON.

```bash
bun install
cp .env.example .env
bun run dev
```

Buka `http://localhost:3000`.
