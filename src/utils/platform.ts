// src/utils/platform.ts
import { platform, arch } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';

export type Platform = 'linux' | 'macos' | 'windows' | 'wsl' | 'unknown';

export function detectPlatform(): Platform {
  const p = platform();
  if (p === 'linux') {
    try {
      if (existsSync('/proc/version')) {
        const v = readFileSync('/proc/version', 'utf8').toLowerCase();
        if (v.includes('microsoft') || v.includes('wsl')) return 'wsl';
      }
    } catch {}
    return 'linux';
  }
  if (p === 'darwin') return 'macos';
  if (p === 'win32') return 'windows';
  return 'unknown';
}

export function archSuffix(): string {
  const a = arch();
  if (a === 'x64') return 'x86_64';
  if (a === 'arm64') return 'aarch64';
  return a;
}

export function lightpandaReleaseAsset(): string | null {
  const pl = detectPlatform();
  const arch = archSuffix();
  if (pl === 'windows') return null;
  const os = pl === 'macos' ? 'macos' : 'linux';
  return `lightpanda-${arch}-${os}`;
}

export function isWindows(): boolean {
  return platform() === 'win32';
}
