import { test, expect } from 'vitest';
import { withPage } from '../../src/adapters/playwright.ts';
import { loadConfig } from '../../src/config.ts';

test('demo greet flow', async () => {
  const cfg = loadConfig(process.cwd());
  await withPage(cfg, async (page) => {
    await page.setContent(`<!doctype html><html><body>
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
    </body></html>`);
    const title = await page.locator('#title').textContent();
    expect(title).toBe('Hello Panda');
    await page.fill('#name', 'Panda');
    await page.click('#greet');
    const out = await page.locator('#out').textContent();
    expect(out).toBe('Hello, Panda');
  });
}, 60000);
