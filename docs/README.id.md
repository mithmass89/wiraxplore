# Webnix (Bahasa Indonesia)

Harness E2E testing berbasis [Lightpanda](https://github.com/lightpanda-io/browser) — browser headless yang dirancang untuk AI dan automation. Mendukung web app sekarang, Flutter nanti. Terintegrasi dengan coding agent (OpenCode, Command Code) via MCP dan plugin.

## Fitur

- **Lifecycle Lightpanda**: deteksi binary, start/stop server CDP, status.
- **Adapter Playwright**: hubungkan test ke Lightpanda via CDP.
- **Server MCP**: ekspos aksi browser ke coding agent.
- **Plugin OpenCode**: registrasi tools + MCP.
- **Runner E2E**: jalankan spec Vitest terhadap Lightpanda.
- **Siap Flutter**: dokumen dan config placeholder untuk Flutter driver.

## Mulai cepat

```bash
pnpm install
pnpm build
webnix doctor
webnix init
# jalankan web app Anda, lalu:
webnix serve
webnix test
```

## Dokumentasi

- [Cara pakai](docs/USAGE.md)
- [Requirement (Web & Flutter)](docs/REQUIREMENTS.md)
- [Panduan Flutter](docs/FLUTTER.md)
