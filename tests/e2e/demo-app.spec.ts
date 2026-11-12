import { test, expect, describe, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSharedSession } from '../../src/adapters/engine.ts';
import { loadConfig } from '../../src/config.ts';
import type { PandaPage } from '../../src/adapters/page.ts';

const here = dirname(fileURLToPath(import.meta.url));
const DEMO_FILE = join(here, '..', '..', 'examples', 'webapp', 'index.html');

const EMAIL = 'admin@demo.test';
const PASSWORD = 'panda123';

/**
 * A rendered UI needs a real browser. Lightpanda has no renderer, and when it runs
 * inside WSL it cannot reach the HTTP server this spec starts on Windows, so a
 * lightpanda override is ignored here on purpose.
 */
const ENV_ENGINE = process.env.WIRAXPLORE_ENGINE;
const ENGINE = ENV_ENGINE === 'puppeteer' ? 'puppeteer' : 'playwright';
const HEADED = process.env.WIRAXPLORE_HEADED === '1';
// One browser per spec file: launching Chrome per test dominates the runtime.
const shared = createSharedSession(loadConfig(process.cwd()), { engine: ENGINE, headed: HEADED });

afterAll(() => shared.close());

let server: Server | null = null;
let demoUrl = '';

async function startDemoServer(): Promise<string> {
  if (demoUrl) return demoUrl;
  const html = readFileSync(DEMO_FILE, 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  demoUrl = `http://127.0.0.1:${port}/`;
  return demoUrl;
}

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
});

async function openDemo(page: PandaPage) {
  await page.goto(await startDemoServer());
  await page.waitFor('[data-testid=login-form]');
}

async function login(page: PandaPage) {
  await page.fill('[data-testid=login-email]', EMAIL);
  await page.fill('[data-testid=login-password]', PASSWORD);
  await page.click('[data-testid=login-submit]');
  await page.waitFor('[data-testid=data-form]');
}

async function addRecord(page: PandaPage, record: { name: string; role?: string; city: string; notes?: string }) {
  await page.fill('[data-testid=data-name]', record.name);
  if (record.role) {
    await page.eval(`document.querySelector('[data-testid=data-role]').value = ${JSON.stringify(record.role)}`);
  }
  await page.fill('[data-testid=data-city]', record.city);
  if (record.notes) await page.fill('[data-testid=data-notes]', record.notes);
  await page.click('[data-testid=data-submit]');
}

describe('demo app: login and data entry', () => {
  test('login form is shown first', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      expect(await page.text('[data-testid=session-badge]')).toBe('belum login');
      expect(await page.eval<boolean>(`document.querySelector('[data-testid=app-view]').classList.contains('hidden')`)).toBe(true);
    });
  }, 60000);

  test('rejects wrong credentials', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      await page.fill('[data-testid=login-email]', EMAIL);
      await page.fill('[data-testid=login-password]', 'salah');
      await page.click('[data-testid=login-submit]');
      expect(await page.text('[data-testid=login-message]')).toBe('Kredensial salah.');
      expect(await page.eval<boolean>(`document.querySelector('[data-testid=app-view]').classList.contains('hidden')`)).toBe(true);
    });
  }, 60000);

  test('requires both fields before submitting', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      await page.click('[data-testid=login-submit]');
      expect(await page.text('[data-testid=login-message]')).toBe('Email dan password wajib diisi.');
    });
  }, 60000);

  test('logs in with the demo credentials', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      await login(page);
      expect(await page.text('[data-testid=session-badge]')).toBe(`login sebagai ${EMAIL}`);
      expect(await page.eval<boolean>(`document.querySelector('[data-testid=login-view]').classList.contains('hidden')`)).toBe(true);
    });
  }, 60000);

  test('rejects a record without a name', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      await login(page);
      await page.fill('[data-testid=data-city]', 'Bandung');
      await page.click('[data-testid=data-submit]');
      expect(await page.text('[data-testid=data-message]')).toBe('Nama wajib diisi.');
    });
  }, 60000);

  test('adds a record and renders it in the table', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      await login(page);

      expect(await page.text('[data-testid=record-count]')).toBe('0');
      expect(await page.eval<boolean>(`document.querySelector('[data-testid=record-table]').classList.contains('hidden')`)).toBe(true);

      await addRecord(page, { name: 'Budi Santoso', role: 'engineer', city: 'Jakarta' });

      expect(await page.text('[data-testid=record-count]')).toBe('1');
      expect(await page.text('[data-testid=record-name]')).toBe('Budi Santoso');
      expect(await page.text('[data-testid=record-city]')).toBe('Jakarta');
      expect(await page.text('[data-testid=data-message]')).toBe('Data "Budi Santoso" tersimpan.');
      expect(await page.eval<boolean>(`document.querySelector('[data-testid=empty-state]').classList.contains('hidden')`)).toBe(true);
    });
  }, 60000);

  test('keeps records across several submissions', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      await login(page);

      await addRecord(page, { name: 'Siti Aminah', role: 'designer', city: 'Bandung' });
      await addRecord(page, { name: 'Rizky Pratama', role: 'qa', city: 'Surabaya' });

      expect(await page.text('[data-testid=record-count]')).toBe('2');
      const rows = await page.eval<string[]>(
        `Array.from(document.querySelectorAll('[data-testid=record-name]')).map(function (n) { return n.textContent; })`,
      );
      expect(rows).toEqual(['Siti Aminah', 'Rizky Pratama']);
    });
  }, 60000);

  test('logout returns to the login view and hides records', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      await login(page);
      await addRecord(page, { name: 'Dewi Lestari', role: 'pm', city: 'Yogyakarta' });

      await page.click('[data-testid=logout]');
      await page.waitFor('[data-testid=login-form]');

      expect(await page.text('[data-testid=session-badge]')).toBe('belum login');
      expect(await page.eval<boolean>(`document.querySelector('[data-testid=app-view]').classList.contains('hidden')`)).toBe(true);
    });
  }, 60000);

  test('reset clears the form without adding a record', async () => {
    await shared.withPage(async (page) => {
      await openDemo(page);
      await login(page);
      await page.fill('[data-testid=data-name]', 'Tidak Jadi');
      await page.fill('[data-testid=data-city]', 'Medan');
      await page.click('[data-testid=data-reset]');

      expect(await page.eval<string>(`document.querySelector('[data-testid=data-name]').value`)).toBe('');
      expect(await page.text('[data-testid=record-count]')).toBe('0');
    });
  }, 60000);
});
