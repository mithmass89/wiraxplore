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

export function findLightpanda(): BinaryInfo | null {
  // 1. env
  const envBin = process.env.LIGHTPANDA_BIN || process.env.LIGHTPANDA_PATH;
  if (envBin && (envBin.startsWith('wsl:') || existsSync(envBin))) return { path: envBin, source: 'env' };

  // 2. PATH
  const names = process.platform === 'win32' ? ['lightpanda.exe', 'lightpanda'] : ['lightpanda'];
  for (const n of names) {
    try {
      const out = spawnSync(process.platform === 'win32' ? 'where' : 'which', [n], { encoding: 'utf8' });
      const p = (out.stdout || '').trim().split(/\r?\n/)[0];
      if (p && existsSync(p)) return { path: p, source: 'path' };
    } catch {}
  }

  // 3. common locations
  const common = [
    join(homedir(), '.local', 'bin', 'lightpanda'),
    join(homedir(), 'bin', 'lightpanda'),
    '/usr/local/bin/lightpanda',
    '/usr/bin/lightpanda',
    '/opt/lightpanda/lightpanda',
  ];
  for (const p of common) if (existsSync(p)) return { path: p, source: 'common' };

  // 4. WSL on Windows
  if (process.platform === 'win32') {
    // try which
    for (const shellArgs of [['which', 'lightpanda'], ['bash', '-lc', 'which lightpanda']]) {
      try {
        const out = spawnSync('wsl', shellArgs, { encoding: 'utf8' });
        const p = (out.stdout || '').trim().split(/\\r?\\n/).pop() || '';
        if (p && p.startsWith('/')) return { path: `wsl:${p}`, source: 'wsl' };
      } catch {}
    }
    // try common wsl paths
    for (const p of ['/home/' + (process.env.WSL_USER || 'thinkpad') + '/.local/bin/lightpanda', '/usr/local/bin/lightpanda', '/usr/bin/lightpanda']) {
      try {
        const out = spawnSync('wsl', ['test', '-x', p], { encoding: 'utf8' });
        if (out.status === 0) return { path: `wsl:${p}`, source: 'wsl' };
      } catch {}
    }
  }

  return null;
}

export function binaryVersion(info: BinaryInfo): string | undefined {
  try {
    const cmd = info.path.startsWith('wsl:') ? 'wsl' : info.path;
    const args = info.path.startsWith('wsl:') ? [info.path.slice(4), 'version'] : ['version'];
    const out = execFileSync(cmd, args, { encoding: 'utf8', timeout: 10000 });
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
    ].join('\n');
  }
  if (asset) {
    return [
      `Download nightly binary (${asset}):`,
      `  curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/${asset} && chmod a+x ./lightpanda && sudo mv lightpanda /usr/local/bin/`,
      'Or via Homebrew: brew install lightpanda-io/browser/lightpanda',
    ].join('\n');
  }
  return 'See https://github.com/lightpanda-io/browser#install';
}

export function spawnLightpanda(args: string[], opts?: { detached?: boolean }): { pid?: number; kill: () => void } {
  const info = findLightpanda();
  if (!info) throw new Error('Lightpanda binary not found. Run `WiraXplore doctor`.');
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
