// src/config.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface ProjectConfig {
  name?: string;
  baseUrl?: string;
  browser?: {
    mode?: 'cdp' | 'bidi' | 'mcp';
    host?: string;
    port?: number;
    lightpandaBin?: string;
    headless?: boolean;
    obeyRobots?: boolean;
  };
  tests?: {
    dir?: string;
    pattern?: string;
    timeoutMs?: number;
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

const DEFAULTS: ProjectConfig = {
  browser: { mode: 'cdp', host: '127.0.0.1', port: 9222, headless: true, obeyRobots: false },
  tests: { dir: 'tests/e2e', pattern: '**/*.spec.ts', timeoutMs: 30000 },
  flutter: { enabled: false, driverPort: 4444 },
  agents: { opencode: true, commandcode: true },
};

export function loadConfig(cwd: string = process.cwd()): ProjectConfig {
  const candidates = ['WiraXplore.config.yaml', 'WiraXplore.config.yml', 'WiraXplore.config.json', '.WiraXplore.json'];
  for (const c of candidates) {
    const p = join(cwd, c);
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf8');
      const parsed = c.endsWith('.json') ? JSON.parse(raw) : (parseYaml(raw) as ProjectConfig);
      return merge(DEFAULTS, parsed ?? {});
    }
  }
  return { ...DEFAULTS };
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
  const candidates = ['WiraXplore.config.yaml', 'WiraXplore.config.yml', 'WiraXplore.config.json', '.WiraXplore.json'];
  for (const c of candidates) {
    const p = join(cwd, c);
    if (existsSync(p)) return resolve(p);
  }
  return null;
}

export function writeDefaultConfig(cwd: string = process.cwd()): string {
  const p = join(cwd, 'WiraXplore.config.yaml');
  const content = `# WiraXplore configuration
name: my-app
baseUrl: http://localhost:3000

browser:
  mode: cdp            # cdp | bidi | mcp
  host: 127.0.0.1
  port: 9222
  headless: true
  obeyRobots: false

tests:
  dir: tests/e2e
  pattern: "**/*.spec.ts"
  timeoutMs: 30000

flutter:
  enabled: false
  deviceId: ""         # e.g. emulator-5554
  driverPort: 4444

agents:
  opencode: true
  commandcode: true
`;
  writeFileSync(p, content, 'utf8');
  return p;
}
