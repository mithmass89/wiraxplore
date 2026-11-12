# Documentation / Dokumentasi

Satu halaman untuk tahu dokumen mana yang harus dibaca.

## Mulai dari sini

| Kalau Anda... | Baca |
| --- | --- |
| baru pertama kali / ingin gambaran singkat | [../README.md](../README.md) |
| ingin tahu cara kerja app + headless/headful | **[TESTING.md](TESTING.md)** |
| ingin langkah lengkap menguji app | **[USAGE.md](USAGE.md)** ← acuan utama |
| ingin versi Bahasa Indonesia | [README.id.md](README.id.md) |
| menyiapkan mesin, browser, atau CI | [REQUIREMENTS.md](REQUIREMENTS.md) |
| menguji Flutter Web / mobile | [FLUTTER.md](FLUTTER.md) |
| menghubungkan Command Code | [../plugins/commandcode/README.md](../plugins/commandcode/README.md) |
| menghubungkan OpenCode | [../plugins/opencode/README.md](../plugins/opencode/README.md) |
| mengajari agent cara memakainya | [../skills/wiraxplore/SKILL.md](../skills/wiraxplore/SKILL.md) |

**Acuan utama pemakaian: [`docs/USAGE.md`](USAGE.md).** Dokumen lain melengkapi,
tidak menggantikan.

## Pembagian peran

- `README.md` — ringkasan, instalasi, quick start, tabel engine. Untuk menarik
  orang dan menjawab "ini apa".
- `docs/USAGE.md` — referensi operasional: memilih engine, lifecycle server,
  menulis spec, API `PandaPage`, menjalankan test, integrasi agent,
  troubleshooting. Kalau ada perbedaan antar dokumen, **yang ini yang benar**.
- `docs/REQUIREMENTS.md` — prasyarat per engine dan per platform (WSL2 di
  Windows, Chrome/Edge, Flutter).
- `docs/README.id.md` — ringkasan berbahasa Indonesia; bukan terjemahan penuh
  USAGE.md.
- `docs/FLUTTER.md` — kasus khusus Flutter: Web butuh engine `playwright`,
  mobile native di luar cakupan.
- `plugins/*/README.md` — integrasi spesifik agent (config, versi OpenCode,
  verifikasi koneksi).
- `skills/wiraxplore/SKILL.md` — aturan main untuk coding agent, bukan panduan
  manusia.

## Konvensi dokumen

- Perintah ditulis apa adanya, siap tempel.
- Nama engine selalu salah satu dari `lightpanda`, `playwright`, `puppeteer`.
- Contoh config memakai `wiraxplore.config.yaml` (format lama `WiraXplore.config.*`
  masih dibaca).
- Dokumen bahasa Indonesia memakai istilah Inggris untuk nama teknis (engine,
  spec, MCP) agar tetap cocok dengan kode dan pesan error.
