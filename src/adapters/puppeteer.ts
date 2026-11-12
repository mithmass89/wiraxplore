import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import type {
  FillOptions, NavigateOptions, PandaPage, ScreenshotOptions, TypeOptions, Viewport, WaitOptions,
} from './page.js';
import type { EngineOptions } from './engine.js';
import { asBrowserFunction } from './browser-fn.js';

/**
 * Puppeteer's waitForSelector only exposes a boolean `visible`, which collapses
 * attached/detached into "visible". This predicate implements all four states the
 * same way Playwright does, so a spec cannot pass on one engine and hang on the other.
 *
 * It is a string on purpose: this file compiles without the DOM lib, so the body is
 * evaluated inside the page where `document` exists.
 */
function waitPredicate(selector: string, state: string): string {
  return `() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (${JSON.stringify(state)} === 'attached') return !!el;
    if (${JSON.stringify(state)} === 'detached') return !el;
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const shown = style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.visibility !== 'collapse'
      && Number(style.opacity) !== 0
      && rect.width > 0
      && rect.height > 0;
    return ${JSON.stringify(state)} === 'visible' ? shown : !shown;
  }`;
}

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

  /** Same contract as Playwright: set the value, dispatch input + change, no key events. */
  async fill(selector: string, value: string, opts?: FillOptions): Promise<void> {
    await this.page.$eval(selector, (el, v) => {
      const target = el as unknown as { value: string; dispatchEvent: (e: Event) => boolean; tagName: string };
      const win = el.ownerDocument.defaultView as unknown as {
        HTMLTextAreaElement: { prototype: object };
        HTMLInputElement: { prototype: object };
      };
      const proto = target.tagName === 'TEXTAREA'
        ? win.HTMLTextAreaElement.prototype
        : win.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, v);
      else target.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    if (opts?.blur) await this.page.$eval(selector, (el) => (el as unknown as { blur: () => void }).blur());
  }

  /** Real keystrokes, matching Playwright's pressSequentially. */
  async type(selector: string, text: string, opts?: TypeOptions): Promise<void> {
    if (opts?.clear !== false) {
      await this.page.$eval(selector, (el) => {
        (el as unknown as { value: string }).value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await this.page.focus(selector);
    }
    await this.page.type(selector, text, { delay: opts?.delay ?? 0 });
  }

  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key as never);
  }

  async text(selector: string): Promise<string> {
    return (await this.page.$eval(selector, (el) => el.textContent ?? '')) as string;
  }

  async value(selector: string): Promise<string> {
    return (await this.page.$eval(selector, (el) => (el as unknown as { value: string }).value)) as string;
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
    const state = opts?.state ?? 'visible';
    const timeout = opts?.timeout ?? 30000;
    const failure = () => new Error(`waitFor("${selector}", state: "${state}") timed out after ${timeout}ms`);

    let handle: { jsonValue: () => Promise<boolean> };
    try {
      handle = await this.page.waitForFunction(asBrowserFunction(waitPredicate(selector, state)) as never, {
        timeout,
        polling: 100,
      }) as unknown as { jsonValue: () => Promise<boolean> };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/timeout|timed out/i.test(message)) throw failure();
      throw error;
    }

    const ok = await handle.jsonValue();
    if (!ok) throw failure();
  }

  async waitForFunction<T>(fnOrExpression: string | ((arg: unknown) => T), arg?: unknown, opts?: { timeout?: number; polling?: number }): Promise<T> {
    const fn = asBrowserFunction(fnOrExpression as never);
    const handle = await this.page.waitForFunction(fn as never, {
      timeout: opts?.timeout ?? 30000,
      polling: opts?.polling ?? 100,
    }, arg) as unknown as { jsonValue: () => Promise<T> };
    return handle.jsonValue();
  }

  async setViewport(viewport: Viewport): Promise<void> {
    await this.page.setViewport(viewport);
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  url(): string {
    return this.page.url();
  }

  async screenshot(opts?: ScreenshotOptions): Promise<Uint8Array | string> {
    if (opts?.selector) {
      const element = await this.page.$(opts.selector);
      if (!element) throw new Error(`screenshot: selector "${opts.selector}" not found`);
      const buf = await element.screenshot({ path: opts.path, type: opts.type ?? 'png' });
      return buf as Uint8Array;
    }
    const buf = await this.page.screenshot({
      path: opts?.path,
      fullPage: opts?.fullPage,
      type: opts?.type ?? 'png',
    });
    return buf as Uint8Array;
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

export async function connectPuppeteer(
  opts: EngineOptions,
  shared?: () => Promise<Browser>,
): Promise<{ page: PandaPage; browser: Browser; close: () => Promise<void> }> {
  let browser: Browser;
  let detach = false;

  if (opts.mode === 'cdp') {
    const url = opts.cdpUrl ?? 'http://127.0.0.1:9222';
    if (!(await canReach(url))) {
      throw new Error(`no CDP endpoint at ${url} — run \`wiraxplore serve\` first`);
    }
    browser = await puppeteer.connect({ browserURL: url, defaultViewport: null });
    detach = true;
  } else if (shared) {
    browser = await shared();
  } else {
    browser = await puppeteer.launch({
      executablePath: opts.executablePath,
      headless: opts.headless,
      defaultViewport: opts.viewport ?? null,
      args: opts.headless ? [] : ['--start-maximized'],
      ...(opts.slowMo ? { slowMo: opts.slowMo } : {}),
      ...(opts.debugPort
        ? { debuggingPort: opts.debugPort, args: [...(opts.headless ? [] : ['--start-maximized']), `--remote-debugging-port=${opts.debugPort}`] }
        : {}),
    });
  }

  // A shared browser still gets a fresh incognito context per session, so
  // localStorage and cookies never leak from one test into the next.
  const context = shared ? await browser.createBrowserContext() : null;
  const page = context ? await context.newPage() : await browser.newPage();
  if (opts.viewport) await page.setViewport(opts.viewport);
  const close = async () => {
    if (context) {
      try { await context.close(); } catch {}
      return;
    }
    try { await page.close(); } catch {}
    if (detach) { try { await browser.disconnect(); } catch {} }
    else { try { await browser.close(); } catch {} }
  };
  return { page: new PuppeteerPage(page), browser, close };
}

export function launchPuppeteerBrowser(opts: EngineOptions): Promise<Browser> {
  return puppeteer.launch({
    executablePath: opts.executablePath,
    headless: opts.headless,
    defaultViewport: opts.viewport ?? null,
    ...(opts.headless ? {} : { args: ['--start-maximized'] }),
    ...(opts.slowMo ? { slowMo: opts.slowMo } : {}),
  });
}
