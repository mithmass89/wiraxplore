// src/binary.ts
import { existsSync } from 'node:fs';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { detectPlatform, lightpandaReleaseAsset } from './utils/platform.js';
import { log } from './utils/logger.js';

export interface BinaryInfo {
  path: string;
  source: 'env' | 'path' | 'wsl' | 'common';
  version?: string;
}

const WSL_CANDIDATES = [
  '/usr/local/bin/lightpanda',
  '/usr/bin/lightpanda',
  '/opt/lightpanda/lightpanda',
];

function wslUserHome(): string | null {
  const out = spawnSync('wsl', ['-e', 'sh', '-lc', 'echo $HOME'], { encoding: 'utf8', timeout: 10000 });
  if (out.status !== 0) return null;
  const home = (out.stdout || '').trim().split(/\r?\n/).pop();
  return home && home.startsWith('/') ? home : null;
}

function findInWsl(): string | null {
  const probes: string[][] = [
    ['-e', 'sh', '-lc', 'command -v lightpanda'],
    ['-e', 'bash', '-lc', 'command -v lightpanda'],
  ];
  for (const args of probes) {
    const out = spawnSync('wsl', args, { encoding: 'utf8', timeout: 15000 });
    if (out.status !== 0) continue;
    const p = (out.stdout || '').trim().split(/\r?\n/).pop() || '';
    if (p.startsWith('/')) return p;
  }
  const home = wslUserHome();
  const candidates = home ? [`${home}/.local/bin/lightpanda`, ...WSL_CANDIDATES] : WSL_CANDIDATES;
  for (const p of candidates) {
    const out = spawnSync('wsl', ['-e', 'test', '-x', p], { timeout: 10000 });
    if (out.status === 0) return p;
  }
  return null;
}

export function findLightpanda(): BinaryInfo | null {
  const envBin = process.env.LIGHTPANDA_BIN || process.env.LIGHTPANDA_PATH;
  if (envBin) {
    if (envBin.startsWith('wsl:')) return { path: envBin, source: 'env' };
    if (existsSync(envBin)) return { path: envBin, source: 'env' };
  }

  if (process.platform !== 'win32') {
    const names = ['lightpanda'];
    for (const n of names) {
      try {
        const out = spawnSync('which', [n], { encoding: 'utf8' });
        const p = (out.stdout || '').trim().split(/\r?\n/)[0];
        if (p && existsSync(p)) return { path: p, source: 'path' };
      } catch {}
    }
    const common = [
      join(homedir(), '.local', 'bin', 'lightpanda'),
      join(homedir(), 'bin', 'lightpanda'),
      ...WSL_CANDIDATES,
    ];
    for (const p of common) if (existsSync(p)) return { path: p, source: 'common' };
    return null;
  }

  for (const n of ['lightpanda.exe', 'lightpanda']) {
    try {
      const out = spawnSync('where', [n], { encoding: 'utf8' });
      const p = (out.stdout || '').trim().split(/\r?\n/)[0];
      if (p && existsSync(p)) return { path: p, source: 'path' };
    } catch {}
  }

  const wslPath = findInWsl();
  if (wslPath) return { path: `wsl:${wslPath}`, source: 'wsl' };

  return null;
}

export function binaryVersion(info: BinaryInfo): string | undefined {
  try {
    if (info.path.startsWith('wsl:')) {
      const out = execFileSync('wsl', ['-e', info.path.slice(4), 'version'], { encoding: 'utf8', timeout: 20000 });
      return out.trim().split(/\r?\n/)[0];
    }
    const out = execFileSync(info.path, ['version'], { encoding: 'utf8', timeout: 10000 });
    return out.trim().split(/\r?\n/)[0];
  } catch {
    return undefined;
  }
}

export function installHint(): string {
  const asset = lightpandaReleaseAsset();
  const pl = detectPlatform();
  if (pl === 'windows') {
    return [
      'Lightpanda has no native Windows binary.',
      'Install via WSL2: wsl --install, then inside WSL run:',
      '  curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux && chmod a+x ./lightpanda && sudo mv lightpanda /usr/local/bin/',
      'Or use Docker: docker run -d -p 127.0.0.1:9222:9222 lightpanda/browser:latest',
      'Or switch engine: set browser.engine to "playwright" or "puppeteer" to use local Chrome/Edge.',
    ].join('\n');
  }
  if (asset) {
    return [
      `Download nightly binary (${asset}):`,
      `  curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/${asset} && chmod a+x ./lightpanda && sudo mv ./lightpanda /usr/local/bin/`,
      'Or via Homebrew: brew install lightpanda-io/browser/lightpanda',
    ].join('\n');
  }
  return 'See https://github.com/lightpanda-io/browser#install';
}

export function spawnLightpanda(args: string[], opts?: { detached?: boolean }): { pid?: number; kill: () => void } {
  const info = findLightpanda();
  if (!info) throw new Error('Lightpanda binary not found. Run `wiraxplore doctor`.');
  let cmd = info.path;
  let fullArgs = args;
  if (info.path.startsWith('wsl:')) {
    cmd = 'wsl';
    fullArgs = [info.path.slice(4), ...args];
  }
  const child = spawn(cmd, fullArgs, { detached: !!opts?.detached, stdio: 'ignore' });
  if (opts?.detached) child.unref();
  return { pid: child.pid, kill: () => { try { child.kill(); } catch {} } };
}
