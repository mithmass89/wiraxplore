import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import type { NavigateOptions, PandaPage, ScreenshotOptions, WaitOptions } from './page.js';
import type { EngineOptions } from './engine.js';

class PuppeteerPage implements PandaPage {
  constructor(private page: Page) {}

  get raw(): Page { return this.page; }

  async goto(url: string, opts?: NavigateOptions): Promise<void> {
    const waitUntil = opts?.waitUntil === 'networkidle0' || opts?.waitUntil === 'networkidle2'
      ? 'networkidle0'
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
    await this.page.$eval(selector, (el) => {
      (el as unknown as { value: string }).value = '';
    });
    await this.page.type(selector, value);
  }

  async text(selector: string): Promise<string> {
    return (await this.page.$eval(selector, (el) => el.textContent ?? '')) as string;
  }

  async html(selector?: string): Promise<string> {
    if (selector) return (await this.page.$eval(selector, (el) => el.innerHTML)) as string;
    return this.page.content();
  }

  async eval<T>(fnOrExpression: string | ((arg: unknown) => T), arg?: unknown): Promise<T> {
    if (typeof fnOrExpression === 'string') return this.page.evaluate(fnOrExpression) as Promise<T>;
    return this.page.evaluate(fnOrExpression as never, arg as never) as Promise<T>;
  }

  async waitFor(selector: string, opts?: WaitOptions): Promise<void> {
    await this.page.waitForSelector(selector, { timeout: opts?.timeout, visible: opts?.state !== 'hidden' });
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  url(): string {
    return this.page.url();
  }

  async screenshot(opts?: ScreenshotOptions): Promise<Uint8Array | string> {
    return this.page.screenshot({
      path: opts?.path,
      fullPage: opts?.fullPage,
      type: opts?.type ?? 'png',
      encoding: opts?.path ? 'binary' : 'binary',
    }) as Promise<Uint8Array>;
  }

  async close(): Promise<void> {
    await this.page.close();
  }
}

async function canReach(cdpUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${cdpUrl.replace(/\/$/, '')}/json/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function connectPuppeteer(opts: EngineOptions): Promise<{ page: PandaPage; browser: Browser; close: () => Promise<void> }> {
  let browser: Browser;
  let detach = false;

  if (opts.mode === 'cdp') {
    const url = opts.cdpUrl ?? 'http://127.0.0.1:9222';
    if (!(await canReach(url))) {
      throw new Error(`no CDP endpoint at ${url} — run \`wiraxplore serve\` first`);
    }
    browser = await puppeteer.connect({ browserURL: url, defaultViewport: null });
    detach = true;
  } else {
    browser = await puppeteer.launch({
      executablePath: opts.executablePath,
      headless: true,
      defaultViewport: null,
    });
  }

  const page = await browser.newPage();
  const close = async () => {
    try { await page.close(); } catch {}
    try { detach ? await browser.disconnect() : await browser.close(); } catch {}
  };
  return { page: new PuppeteerPage(page), browser, close };
}
