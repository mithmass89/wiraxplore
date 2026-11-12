import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import type { NavigateOptions, PandaPage, ScreenshotOptions, WaitOptions } from './page.js';
import { resolveExecutable, type EngineOptions } from './engine.js';

class PlaywrightPage implements PandaPage {
  constructor(private page: Page) {}

  get raw(): Page { return this.page; }

  async goto(url: string, opts?: NavigateOptions): Promise<void> {
    const waitUntil = opts?.waitUntil === 'networkidle0' || opts?.waitUntil === 'networkidle2'
      ? 'networkidle'
      : opts?.waitUntil ?? 'domcontentloaded';
    await this.page.goto(url, { waitUntil, timeout: opts?.timeout });
  }

  async setContent(html: string): Promise<void> {
    await this.page.setContent(html);
  }

  async click(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  async text(selector: string): Promise<string> {
    return (await this.page.locator(selector).textContent()) ?? '';
  }

  async html(selector?: string): Promise<string> {
    if (selector) return (await this.page.locator(selector).innerHTML());
    return this.page.content();
  }

  async eval<T>(fnOrExpression: string | ((arg: unknown) => T), arg?: unknown): Promise<T> {
    const fn = typeof fnOrExpression === 'string' ? fnOrExpression : fnOrExpression.toString();
    return this.page.evaluate(fn as never, arg) as Promise<T>;
  }

  async waitFor(selector: string, opts?: WaitOptions): Promise<void> {
    await this.page.waitForSelector(selector, { timeout: opts?.timeout, state: opts?.state ?? 'visible' });
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  url(): string {
    return this.page.url();
  }

  async screenshot(opts?: ScreenshotOptions): Promise<Uint8Array | string> {
    if (opts?.path) return this.page.screenshot({ path: opts.path, fullPage: opts.fullPage, type: opts.type });
    const buf = await this.page.screenshot({ fullPage: opts?.fullPage, type: opts?.type });
    return new Uint8Array(buf);
  }

  async close(): Promise<void> {
    await this.page.close();
  }
}

export async function connectPlaywright(opts: EngineOptions): Promise<{ page: PandaPage; browser: Browser; close: () => Promise<void> }> {
  let browser: Browser;
  if (opts.cdpUrl) {
    browser = await chromium.connectOverCDP(opts.cdpUrl);
  } else {
    browser = await chromium.launch({
      executablePath: resolveExecutable(opts),
      headless: opts.headless,
      ...(opts.slowMo ? { slowMo: opts.slowMo } : {}),
    });
  }
  const context: BrowserContext = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();
  const close = async () => {
    try { await page.close(); } catch {}
    try { await browser.close(); } catch {}
  };
  return { page: new PlaywrightPage(page), browser, close };
}
