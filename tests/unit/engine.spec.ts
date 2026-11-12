import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planEngine } from '../../src/adapters/engine.ts';
import { loadConfig } from '../../src/config.ts';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'wiraxplore-engine-'));
}

test('engine override beats config', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'wiraxplore.config.yaml'), 'browser:\n  engine: lightpanda\n', 'utf8');
  const cfg = loadConfig(dir);
  expect(planEngine(cfg).engine).toBe('lightpanda');
  expect(planEngine(cfg, { engine: 'puppeteer' }).engine).toBe('puppeteer');
});

test('playwright and puppeteer engines launch Chrome without CDP', () => {
  const cfg = loadConfig(tmp());
  for (const engine of ['playwright', 'puppeteer']) {
    const plan = planEngine(cfg, { engine });
    expect(plan.mode).toBe('launch');
    expect(plan.cdpUrl).toBeUndefined();
  }
});

test('lightpanda honours configured host and port', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'wiraxplore.config.yaml'), 'browser:\n  host: 10.0.0.5\n  port: 9999\n', 'utf8');
  const plan = planEngine(loadConfig(dir));
  expect(plan.cdpUrl).toBe('http://10.0.0.5:9999');
});

test('env overrides reach the plan', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'wiraxplore.config.yaml'), 'baseUrl: http://localhost:1111\n', 'utf8');
  process.env.WIRAXPLORE_ENGINE = 'puppeteer';
  process.env.WIRAXPLORE_BASE_URL = 'http://localhost:2222';
  try {
    const cfg = loadConfig(dir);
    expect(cfg.browser?.engine).toBe('puppeteer');
    expect(cfg.baseUrl).toBe('http://localhost:2222');
  } finally {
    delete process.env.WIRAXPLORE_ENGINE;
    delete process.env.WIRAXPLORE_BASE_URL;
  }
});

test('legacy config file names are still discovered', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'WiraXplore.config.yaml'), 'baseUrl: http://legacy:3000\n', 'utf8');
  expect(loadConfig(dir).baseUrl).toBe('http://legacy:3000');
  expect(readFileSync(join(dir, 'WiraXplore.config.yaml'), 'utf8')).toContain('legacy');
});
