import { test, expect } from 'vitest';
import { loadConfig } from '../../src/config.ts';

test('loadConfig returns defaults when no file', () => {
  const cfg = loadConfig(process.cwd() + '/__nonexistent__');
  expect(cfg.browser?.port).toBe(9222);
  expect(cfg.tests?.dir).toBe('tests/e2e');
});
