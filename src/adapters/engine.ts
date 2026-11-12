import { connectPlaywright } from './playwright.js';
import { connectPuppeteer } from './puppeteer.js';
import { findLightpanda, binaryVersion } from '../binary.js';
import { loadConfig, type ProjectConfig } from '../config.js';
import { detectPlatform } from '../utils/platform.js';
import { existsSync } from 'node:fs';
import type { PandaPage } from './page.js';
import type { DriverName, EngineName, EnginePlan } from './types.js';

export type { EngineName, DriverName, EnginePlan } from './types.js';

export const ENGINE_NAMES: EngineName[] = ['lightpanda', 'playwright', 'puppeteer'];
export const DRIVER_NAMES: DriverName[] = ['playwright', 'puppeteer'];

export interface EngineOptions {
  engine: EngineName;
  driver: DriverName;
  mode: 'cdp' | 'launch';
  cdpUrl?: string;
  executablePath?: string;
  baseUrl?: string;
}

export interface BrowserSession {
  page: PandaPage;
  engine: EngineName;
  driver: DriverName;
  close: () => Promise<void>;
}

function asEngine(value: string): EngineName {
  if (!ENGINE_NAMES.includes(value as EngineName)) {
    throw new Error(`unknown browser.engine "${value}" (expected ${ENGINE_NAMES.join('|')})`);
  }
  return value as EngineName;
}

function asDriver(value: string): DriverName {
  if (!DRIVER_NAMES.includes(value as DriverName)) {
    throw new Error(`unknown browser.driver "${value}" (expected ${DRIVER_NAMES.join('|')})`);
  }
  return value as DriverName;
}

function channelExecutable(channel: string): string | undefined {
  if (process.platform === 'win32') {
    const roots = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean) as string[];
    const rel = channel === 'msedge'
      ? ['Microsoft', 'Edge', 'Application', 'msedge.exe']
      : ['Google', 'Chrome', 'Application', 'chrome.exe'];
    for (const root of roots) {
      const p = [root, ...rel].join('\\');
      if (existsSync(p)) return p;
    }
    return undefined;
  }
  if (process.platform === 'darwin') {
    const p = channel === 'msedge'
      ? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
      : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    return existsSync(p) ? p : undefined;
  }
  const names = channel === 'msedge'
    ? ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const p of names) if (existsSync(p)) return p;
  return undefined;
}

export function resolveExecutable(opts: { executablePath?: string; channel?: string }): string | undefined {
  if (opts.executablePath) return opts.executablePath;
  if (opts.channel) {
    const p = channelExecutable(opts.channel);
    if (!p) throw new Error(`browser channel "${opts.channel}" not found on this machine`);
    return p;
  }
  return channelExecutable('chrome') ?? channelExecutable('msedge');
}

export function planEngine(cfg: ProjectConfig, override?: { engine?: string; driver?: string; cdpUrl?: string }): EnginePlan {
  const engine = asEngine(override?.engine ?? cfg.browser?.engine ?? 'lightpanda');
  const driver = asDriver(
    override?.driver
    ?? (engine === 'lightpanda' ? cfg.browser?.driver ?? 'playwright' : engine),
  );

  if (engine === 'lightpanda') {
    const host = cfg.browser?.host ?? '127.0.0.1';
    const port = cfg.browser?.port ?? 9222;
    return { engine, driver, mode: 'cdp', cdpUrl: override?.cdpUrl ?? `http://${host}:${port}` };
  }

  return {
    engine,
    driver,
    mode: 'launch',
    executablePath: cfg.browser?.executablePath ?? cfg.browser?.channel,
  };
}

export function engineOptions(cfg: ProjectConfig, override?: { engine?: string; driver?: string; cdpUrl?: string }): EngineOptions {
  const plan = planEngine(cfg, override);
  const executablePath = plan.mode === 'launch'
    ? resolveExecutable({ executablePath: cfg.browser?.executablePath, channel: cfg.browser?.channel })
    : undefined;
  return {
    engine: plan.engine,
    driver: plan.driver,
    mode: plan.mode,
    cdpUrl: plan.cdpUrl,
    executablePath,
    baseUrl: cfg.baseUrl,
  };
}

export async function launchSession(opts: EngineOptions): Promise<BrowserSession> {
  if (opts.driver === 'puppeteer') {
    const s = await connectPuppeteer(opts);
    return { page: s.page, engine: opts.engine, driver: opts.driver, close: s.close };
  }
  const s = await connectPlaywright(opts);
  return { page: s.page, engine: opts.engine, driver: opts.driver, close: s.close };
}

export async function withPage<T>(
  cfg: ProjectConfig = loadConfig(),
  fn: (page: PandaPage) => Promise<T>,
  override?: { engine?: string; driver?: string; cdpUrl?: string },
): Promise<T> {
  const session = await launchSession(engineOptions(cfg, override));
  try {
    return await fn(session.page);
  } finally {
    await session.close();
  }
}

export function engineReport(cfg: ProjectConfig = loadConfig()): Record<string, unknown> {
  const plan = planEngine(cfg);
  const exe = plan.mode === 'launch'
    ? resolveExecutable({ executablePath: cfg.browser?.executablePath, channel: cfg.browser?.channel })
    : undefined;
  const bin = findLightpanda();
  return {
    platform: detectPlatform(),
    engine: plan.engine,
    driver: plan.driver,
    mode: plan.mode,
    cdpUrl: plan.cdpUrl,
    executablePath: exe,
    lightpanda: bin ? { path: bin.path, source: bin.source, version: binaryVersion(bin) } : null,
  };
}
