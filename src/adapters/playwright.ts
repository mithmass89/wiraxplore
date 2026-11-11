// src/adapters/playwright.ts
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import type { ProjectConfig } from '../config.js';

export async function connectPlaywright(cfg: ProjectConfig): Promise<{ browser: Browser; context: BrowserContext; page: Page; close: () => Promise<void> }> {
  const host = cfg.browser?.host ?? '127.0.0.1';
  const port = cfg.browser?.port ?? 9222;
  const browser = await chromium.connectOverCDP(`http://${host}:${port}`);
  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = await context.newPage();
  const close = async () => {
    try { await page.close(); } catch {}
    try { await browser.close(); } catch {}
  };
  return { browser, context, page, close };
}

export async function withPage<T>(cfg: ProjectConfig, fn: (page: Page) => Promise<T>): Promise<T> {
  const { page, close } = await connectPlaywright(cfg);
  try { return await fn(page); }
  finally { await close(); }
}
