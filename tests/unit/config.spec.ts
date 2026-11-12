import { test, expect } from 'vitest';
import { loadConfig, CONFIG_FILES, configPath } from '../../src/config.ts';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('loadConfig returns defaults when no config file exists', () => {
  const cfg = loadConfig(process.cwd() + '/__nonexistent__');
  expect(cfg.browser?.port).toBe(9222);
  expect(cfg.browser?.engine).toBe('lightpanda');
  expect(cfg.browser?.driver).toBe('playwright');
  expect(cfg.tests?.dir).toBe('tests/e2e');
});

test('loadConfig merges a yaml config over defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wiraxplore-'));
  writeFileSync(join(dir, 'wiraxplore.config.yaml'), 'baseUrl: http://localhost:4000\nbrowser:\n  engine: puppeteer\n', 'utf8');
  const cfg = loadConfig(dir);
  expect(cfg.baseUrl).toBe('http://localhost:4000');
  expect(cfg.browser?.engine).toBe('puppeteer');
  expect(cfg.browser?.port).toBe(9222);
  expect(configPath(dir)?.endsWith('wiraxplore.config.yaml')).toBe(true);
});

test('config discovery covers legacy and current file names', () => {
  expect(CONFIG_FILES).toContain('wiraxplore.config.yaml');
  expect(CONFIG_FILES).toContain('WiraXplore.config.yaml');
  expect(CONFIG_FILES).toContain('.wiraxplore.json');
});
