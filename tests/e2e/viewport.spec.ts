import { test, expect, describe } from 'vitest';
import { withPage } from '../../src/adapters/engine.ts';
import { loadConfig } from '../../src/config.ts';

/**
 * The bug this guards: Puppeteer ran at ~800x600 (defaultViewport: null) while
 * Playwright used 1280x720, so a sidebar hidden under 1024px passed on one engine
 * and failed on the other.
 */
const BREAKPOINT_HTML = `<!doctype html><html><head><style>
  #sidebar { display: block; }
  @media (max-width: 1023px) { #sidebar { display: none; } }
</style></head><body>
  <aside id="sidebar">navigation</aside>
  <main id="content">content</main>
</body></html>`;

describe.each(['playwright', 'puppeteer'] as const)('viewport parity on %s', (engine) => {
  test('uses the configured viewport, not the driver default', async () => {
    const cfg = loadConfig(process.cwd());
    await withPage(cfg, async (page) => {
      await page.setContent(BREAKPOINT_HTML);
      const width = await page.eval<number>('window.innerWidth');
      expect(width).toBe(cfg.browser?.viewport?.width ?? 1280);
      // 1280 wide: sidebar visible on both engines.
      await page.waitFor('#sidebar', { state: 'visible', timeout: 3000 });
    }, { engine });
  }, 60000);

  test('the same spec behaves the same after resizing below the breakpoint', async () => {
    const cfg = loadConfig(process.cwd());
    await withPage(cfg, async (page) => {
      await page.setContent(BREAKPOINT_HTML);
      await page.setViewport({ width: 900, height: 700 });
      expect(await page.eval<number>('window.innerWidth')).toBe(900);
      // 900 wide: sidebar hidden on both engines, identically.
      await page.waitFor('#sidebar', { state: 'hidden', timeout: 3000 });
    }, { engine });
  }, 60000);
});
