import { test, expect, describe } from 'vitest';
import { withPage } from '../../src/adapters/engine.ts';
import { loadConfig } from '../../src/config.ts';
import type { PandaPage } from '../../src/adapters/page.ts';

/**
 * These tests encode the contract `PandaPage` promises and run it on every engine.
 * A divergence here is a harness bug, not an app bug: the same spec must behave the
 * same on lightpanda, playwright and puppeteer.
 */
const ENGINES = ['playwright', 'puppeteer'] as const;

const FIXTURE = `<!doctype html><html><body>
  <div id="shown">visible text</div>
  <div id="gone" style="display:none">hidden text</div>
  <input id="plain" />
  <input id="masked" />
  <button id="add">add</button>
  <ul id="list"></ul>
  <script>
    // Rejects any non-digit keystroke, the way a mask library would.
    var masked = document.getElementById('masked');
    masked.addEventListener('keydown', function (event) {
      if (event.key.length === 1 && !/[0-9]/.test(event.key)) event.preventDefault();
    });
    var n = 0;
    document.getElementById('add').addEventListener('click', function () {
      n += 1;
      var li = document.createElement('li');
      li.textContent = 'item ' + n;
      document.getElementById('list').appendChild(li);
    });
  </script>
</body></html>`;

async function open(page: PandaPage) {
  await page.setContent(FIXTURE);
  await page.waitFor('#shown');
}

describe.each(ENGINES)('PandaPage contract on %s', (engine) => {
  const cfg = () => loadConfig(process.cwd());

  test('waitFor: visible fails on a hidden element', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await expect(page.waitFor('#gone', { state: 'visible', timeout: 700 })).rejects.toThrow();
    }, { engine });
  }, 60000);

  test('waitFor: attached succeeds on a hidden element', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await page.waitFor('#gone', { state: 'attached', timeout: 3000 });
      expect(await page.text('#gone')).toBe('hidden text');
    }, { engine });
  }, 60000);

  test('waitFor: hidden succeeds on a hidden element', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await page.waitFor('#gone', { state: 'hidden', timeout: 3000 });
    }, { engine });
  }, 60000);

  test('waitFor: detached succeeds only after removal', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await expect(page.waitFor('#shown', { state: 'detached', timeout: 700 })).rejects.toThrow();
      await page.eval(`document.getElementById('shown').remove()`);
      await page.waitFor('#shown', { state: 'detached', timeout: 3000 });
    }, { engine });
  }, 60000);

  test('fill sets the value without key events (mask stays intact)', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await page.fill('#masked', 'abc123');
      expect(await page.value('#masked')).toBe('abc123');
    }, { engine });
  }, 60000);

  test('type uses real keystrokes (mask filters letters out)', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await page.type('#masked', 'abc123', { delay: 5 });
      expect(await page.value('#masked')).toBe('123');
    }, { engine });
  }, 60000);

  test('fill ignores key handlers and fires input', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await page.eval(`window.seen = []; document.getElementById('plain').addEventListener('input', function (e) { window.seen.push(e.target.value); })`);
      await page.fill('#plain', 'hello');
      expect(await page.value('#plain')).toBe('hello');
      expect(await page.eval<string[]>('window.seen')).toEqual(['hello']);
    }, { engine });
  }, 60000);

  test('waitForFunction resolves a non-selector condition', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await page.click('#add');
      await page.click('#add');
      const count = await page.waitForFunction<number>(
        `() => document.querySelectorAll('#list li').length >= 2 ? document.querySelectorAll('#list li').length : false`,
        undefined,
        { timeout: 5000, polling: 50 },
      );
      expect(count).toBe(2);
    }, { engine });
  }, 60000);

  test('setViewport changes the layout width', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await page.setViewport({ width: 420, height: 700 });
      expect(await page.eval<number>('window.innerWidth')).toBe(420);
      await page.setViewport({ width: 1280, height: 720 });
      expect(await page.eval<number>('window.innerWidth')).toBe(1280);
    }, { engine });
  }, 60000);

  test('press sends a real key event', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      await page.eval(`window.keys = []; document.addEventListener('keydown', function (e) { window.keys.push(e.key); })`);
      await page.press('Enter');
      expect(await page.eval<string[]>('window.keys')).toContain('Enter');
    }, { engine });
  }, 60000);

  test('screenshot of a single element returns bytes', async () => {
    await withPage(cfg(), async (page) => {
      await open(page);
      const shot = await page.screenshot({ selector: '#shown' });
      expect(shot instanceof Uint8Array ? shot.length : 0).toBeGreaterThan(100);
    }, { engine });
  }, 60000);
});
