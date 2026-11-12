import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import type {
  FillOptions, NavigateOptions, PandaPage, ScreenshotOptions, TypeOptions, Viewport, WaitOptions,
} from './page.js';
import { resolveExecutable, type EngineOptions } from './engine.js';
import { asBrowserFunction } from './browser-fn.js';

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

  async fill(selector: string, value: string, opts?: FillOptions): Promise<void> {
    await this.page.fill(selector, value);
    if (opts?.blur) await this.page.locator(selector).blur();
  }

  async type(selector: string, text: string, opts?: TypeOptions): Promise<void> {
    const locator = this.page.locator(selector);
    if (opts?.clear !== false) await locator.fill('');
    await locator.pressSequentially(text, { delay: opts?.delay ?? 0 });
  }

  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async text(selector: string): Promise<string> {
    return (await this.page.locator(selector).textContent()) ?? '';
  }

  async value(selector: string): Promise<string> {
    return this.page.locator(selector).inputValue();
  }

  async html(selector?: string): Promise<string> {
    if (selector) return this.page.locator(selector).innerHTML();
    return this.page.content();
  }

  async eval<T>(fnOrExpression: string | ((arg: unknown) => T), arg?: unknown): Promise<T> {
    const fn = typeof fnOrExpression === 'string' ? fnOrExpression : fnOrExpression.toString();
    return this.page.evaluate(fn as never, arg) as Promise<T>;
  }

  async waitFor(selector: string, opts?: WaitOptions): Promise<void> {
    await this.page.waitForSelector(selector, { timeout: opts?.timeout, state: opts?.state ?? 'visible' });
  }

  async waitForFunction<T>(fnOrExpression: string | ((arg: unknown) => T), arg?: unknown, opts?: { timeout?: number; polling?: number }): Promise<T> {
    const fn = asBrowserFunction(fnOrExpression as never);
    const handle = await this.page.waitForFunction(fn as never, arg, {
      timeout: opts?.timeout ?? 30000,
      polling: opts?.polling ?? 100,
    });
    return (await handle.jsonValue()) as T;
  }

  async setViewport(viewport: Viewport): Promise<void> {
    await this.page.setViewportSize(viewport);
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  url(): string {
    return this.page.url();
  }

  async screenshot(opts?: ScreenshotOptions): Promise<Uint8Array | string> {
    if (opts?.selector) {
      const element = this.page.locator(opts.selector);
      if (opts.path) await element.screenshot({ path: opts.path, type: opts.type });
      return new Uint8Array(await element.screenshot({ type: opts.type }));
    }
    if (opts?.path) return this.page.screenshot({ path: opts.path, fullPage: opts.fullPage, type: opts.type });
    const buf = await this.page.screenshot({ fullPage: opts?.fullPage, type: opts?.type });
    return new Uint8Array(buf);
  }

  async close(): Promise<void> {
    await this.page.close();
  }
}

export async function connectPlaywright(
  opts: EngineOptions,
  shared?: () => Promise<Browser>,
): Promise<{ page: PandaPage; browser: Browser; close: () => Promise<void> }> {
  let browser: Browser;
  if (opts.cdpUrl) {
    browser = await chromium.connectOverCDP(opts.cdpUrl);
  } else if (shared) {
    browser = await shared();
  } else {
    browser = await chromium.launch({
      executablePath: resolveExecutable(opts),
      headless: opts.headless,
      ...(opts.slowMo ? { slowMo: opts.slowMo } : {}),
    });
  }
  // A shared browser still gets a fresh context per session, so localStorage,
  // cookies and history never leak from one test into the next.
  const context: BrowserContext = shared
    ? await browser.newContext({ viewport: opts.viewport ?? null })
    : (browser.contexts()[0] ?? (await browser.newContext({ viewport: opts.viewport ?? null })));
  const page = await context.newPage();
  const close = async () => {
    if (shared) {
      try { await context.close(); } catch {}
      return;
    }
    try { await page.close(); } catch {}
    try { await browser.close(); } catch {}
  };
  return { page: new PlaywrightPage(page), browser, close };
}

export function launchPlaywrightBrowser(opts: EngineOptions): Promise<Browser> {
  return chromium.launch({
    executablePath: resolveExecutable(opts),
    headless: opts.headless,
    ...(opts.slowMo ? { slowMo: opts.slowMo } : {}),
  });
}
