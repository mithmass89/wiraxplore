import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import { withPage, planEngine, ENGINE_NAMES, DRIVER_NAMES } from '../../src/adapters/engine.ts';
import { loadConfig } from '../../src/config.ts';
import { startServer, stopServer, statusWithProbe } from '../../src/server.ts';
import { findLightpanda } from '../../src/binary.ts';
import type { PandaPage } from '../../src/adapters/page.ts';

const DEMO = `<!doctype html><html><body>
  <h1 id="title">Hello Panda</h1>
  <input id="name" placeholder="Your name" />
  <button id="greet">Greet</button>
  <p id="out"></p>
  <script>
    document.getElementById('greet').addEventListener('click', () => {
      const v = document.getElementById('name').value;
      document.getElementById('out').textContent = 'Hello, ' + (v || 'stranger');
    });
  </script>
</body></html>`;

async function greetFlow(page: PandaPage) {
  await page.setContent(DEMO);
  expect(await page.text('#title')).toBe('Hello Panda');
  await page.fill('#name', 'Panda');
  await page.click('#greet');
  expect(await page.text('#out')).toBe('Hello, Panda');
}

let startedHere = false;
let lightpandaAvailable = false;

beforeAll(async () => {
  lightpandaAvailable = findLightpanda() !== null;
  if (!lightpandaAvailable) return;
  const st = await statusWithProbe();
  if (!st.cdp) {
    await startServer(loadConfig(process.cwd()));
    startedHere = true;
  }
}, 60000);

afterAll(() => {
  if (startedHere) stopServer();
});

describe('engine plan', () => {
  test('defaults to lightpanda over playwright CDP', () => {
    const plan = planEngine(loadConfig(process.cwd()));
    expect(plan.engine).toBe('lightpanda');
    expect(plan.driver).toBe('playwright');
    expect(plan.mode).toBe('cdp');
    expect(plan.cdpUrl).toBe('http://127.0.0.1:9222');
  });

  test('puppeteer engine uses the puppeteer driver and launches Chrome', () => {
    const plan = planEngine(loadConfig(process.cwd()), { engine: 'puppeteer' });
    expect(plan.engine).toBe('puppeteer');
    expect(plan.driver).toBe('puppeteer');
    expect(plan.mode).toBe('launch');
  });

  test('playwright engine drives local Chrome', () => {
    const plan = planEngine(loadConfig(process.cwd()), { engine: 'playwright' });
    expect(plan.engine).toBe('playwright');
    expect(plan.driver).toBe('playwright');
    expect(plan.mode).toBe('launch');
  });

  test('lightpanda can be driven by puppeteer over CDP', () => {
    const plan = planEngine(loadConfig(process.cwd()), { engine: 'lightpanda', driver: 'puppeteer' });
    expect(plan.engine).toBe('lightpanda');
    expect(plan.driver).toBe('puppeteer');
    expect(plan.mode).toBe('cdp');
  });

  test('rejects unknown engine and driver', () => {
    expect(() => planEngine(loadConfig(process.cwd()), { engine: 'netscape' })).toThrow(/unknown browser.engine/);
    expect(() => planEngine(loadConfig(process.cwd()), { driver: 'selenium' })).toThrow(/unknown browser.driver/);
  });

  test('exposes engine and driver names', () => {
    expect(ENGINE_NAMES).toEqual(['lightpanda', 'playwright', 'puppeteer']);
    expect(DRIVER_NAMES).toEqual(['playwright', 'puppeteer']);
  });
});

describe('browser engines', () => {
  const cfg = () => loadConfig(process.cwd());

  test('lightpanda via playwright CDP', async () => {
    if (!lightpandaAvailable) return;
    await withPage(cfg(), greetFlow, { engine: 'lightpanda', driver: 'playwright' });
  }, 60000);

  test('lightpanda via puppeteer CDP', async () => {
    if (!lightpandaAvailable) return;
    await withPage(cfg(), greetFlow, { engine: 'lightpanda', driver: 'puppeteer' });
  }, 60000);

  test('local chrome via playwright', async () => {
    await withPage(cfg(), greetFlow, { engine: 'playwright' });
  }, 60000);

  test('local chrome via puppeteer', async () => {
    await withPage(cfg(), greetFlow, { engine: 'puppeteer' });
  }, 60000);
});
