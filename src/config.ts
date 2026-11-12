// src/config.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export type Engine = 'lightpanda' | 'playwright' | 'puppeteer';
export type Driver = 'playwright' | 'puppeteer';

export interface ProjectConfig {
  name?: string;
  baseUrl?: string;
  browser?: {
    /** Which browser binary runs the page. */
    engine?: Engine;
    /** Which automation client drives it. */
    driver?: Driver;
    mode?: 'cdp' | 'bidi' | 'mcp';
    host?: string;
    port?: number;
    debugPort?: number;
    channel?: 'chrome' | 'msedge';
    executablePath?: string;
    lightpandaBin?: string;
    headless?: boolean;
    /** Delay between driver actions in ms, to make a headed run watchable. */
    slowMo?: number;
    obeyRobots?: boolean;
  };
  tests?: {
    dir?: string;
    pattern?: string;
    timeoutMs?: number;
    /** Extra vitest args appended to the run, e.g. ["--reporter=verbose"]. */
    args?: string[];
  };
  flutter?: {
    enabled?: boolean;
    deviceId?: string;
    driverPort?: number;
  };
  agents?: {
    opencode?: boolean;
    commandcode?: boolean;
  };
}

export const CONFIG_FILES = [
  'wiraxplore.config.yaml',
  'wiraxplore.config.yml',
  'wiraxplore.config.json',
  '.wiraxplore.json',
  'WiraXplore.config.yaml',
  'WiraXplore.config.yml',
  'WiraXplore.config.json',
  '.WiraXplore.json',
];

const DEFAULTS: ProjectConfig = {
  browser: {
    engine: 'lightpanda',
    driver: 'playwright',
    mode: 'cdp',
    host: '127.0.0.1',
    port: 9222,
    debugPort: 9333,
    headless: true,
    obeyRobots: false,
  },
  tests: { dir: 'tests/e2e', pattern: '**/*.spec.ts', timeoutMs: 30000 },
  flutter: { enabled: false, driverPort: 4444 },
  agents: { opencode: true, commandcode: true },
};

export function loadConfig(cwd: string = process.cwd()): ProjectConfig {
  let cfg: ProjectConfig = structuredClone(DEFAULTS);
  for (const c of CONFIG_FILES) {
    const p = join(cwd, c);
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf8');
      const parsed = c.endsWith('.json') ? JSON.parse(raw) : (parseYaml(raw) as ProjectConfig);
      cfg = merge(DEFAULTS, parsed ?? {});
      break;
    }
  }
  return applyEnvOverrides(cfg);
}

function applyEnvOverrides(cfg: ProjectConfig): ProjectConfig {
  const engine = process.env.WIRAXPLORE_ENGINE as Engine | undefined;
  const driver = process.env.WIRAXPLORE_DRIVER as Driver | undefined;
  const cdpUrl = process.env.WIRAXPLORE_CDP_URL;
  const baseUrl = process.env.WIRAXPLORE_BASE_URL;
  const headed = process.env.WIRAXPLORE_HEADED;
  const slowMo = process.env.WIRAXPLORE_SLOWMO;
  if (engine) cfg.browser = { ...cfg.browser, engine };
  if (driver) cfg.browser = { ...cfg.browser, driver };
  if (cdpUrl) {
    try {
      const u = new URL(cdpUrl);
      cfg.browser = { ...cfg.browser, host: u.hostname, port: Number(u.port || 9222) };
    } catch {}
  }
  if (baseUrl) cfg.baseUrl = baseUrl;
  if (headed !== undefined) cfg.browser = { ...cfg.browser, headless: !isTruthy(headed) };
  if (slowMo !== undefined && slowMo !== '') {
    const n = Number(slowMo);
    if (Number.isFinite(n) && n >= 0) cfg.browser = { ...cfg.browser, slowMo: n };
  }
  return cfg;
}

function isTruthy(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function merge(base: ProjectConfig, over: ProjectConfig): ProjectConfig {
  return {
    ...base,
    ...over,
    browser: { ...base.browser, ...over.browser },
    tests: { ...base.tests, ...over.tests },
    flutter: { ...base.flutter, ...over.flutter },
    agents: { ...base.agents, ...over.agents },
  };
}

export function configPath(cwd: string = process.cwd()): string | null {
  for (const c of CONFIG_FILES) {
    const p = join(cwd, c);
    if (existsSync(p)) return resolve(p);
  }
  return null;
}

export function writeDefaultConfig(cwd: string = process.cwd()): string {
  const p = join(cwd, 'wiraxplore.config.yaml');
  const content = `# WiraXplore configuration
name: my-app
baseUrl: http://localhost:3000

browser:
  # lightpanda | playwright | puppeteer
  #   lightpanda: headless Zig browser, Playwright/Puppeteer connect over CDP
  #   playwright: local Chrome/Edge driven by playwright-core
  #   puppeteer:  local Chrome/Edge driven by puppeteer-core
  engine: lightpanda
  # playwright | puppeteer  (puppeteer engine always uses the puppeteer driver)
  driver: playwright
  mode: cdp            # cdp | bidi | mcp
  host: 127.0.0.1
  port: 9222
  debugPort: 9333      # used when the engine drives Chrome itself
  # channel: chrome    # or msedge; omit to auto-detect
  # executablePath: "" # explicit browser binary
  headless: true
  # slowMo: 250        # delay between actions (ms) when headless is false
  obeyRobots: false

tests:
  dir: tests/e2e
  pattern: "**/*.spec.ts"
  timeoutMs: 30000

flutter:
  enabled: false
  deviceId: ""
  driverPort: 4444

agents:
  opencode: true
  commandcode: true
`;
  writeFileSync(p, content, 'utf8');
  return p;
}
