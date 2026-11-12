// src/server.ts
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, unlinkSync, openSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { findLightpanda } from './binary.js';
import { log } from './utils/logger.js';
import type { ProjectConfig } from './config.js';

const PIDFILE = '.wiraxplore.pid';
const LOGFILE = '.wiraxplore.log';
const MAX_LOG_BYTES = 2 * 1024 * 1024;

/** Keep one previous log; an endless append is a leak on long-lived servers. */
function rotateLog(): void {
  try {
    if (!existsSync(LOGFILE)) return;
    if (statSync(LOGFILE).size < MAX_LOG_BYTES) return;
    renameSync(LOGFILE, `${LOGFILE}.1`);
  } catch {}
}

export interface ServerHandle {
  pid: number;
  host: string;
  port: number;
  protocol: string;
  stop: () => void;
}

export function cdpUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}

export async function probeCdp(url: string, timeoutMs = 1500): Promise<{ ok: boolean; version?: Record<string, unknown> }> {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/json/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false };
    return { ok: true, version: (await res.json()) as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}

async function waitForCdp(url: string, timeoutMs = 15000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await probeCdp(url, 1000)).ok) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

export async function startServer(cfg: ProjectConfig, opts?: { protocol?: string; detached?: boolean }): Promise<ServerHandle> {
  const host = cfg.browser?.host ?? '127.0.0.1';
  const port = cfg.browser?.port ?? 9222;
  const protocol = opts?.protocol ?? 'cdp';
  const url = cdpUrl(host, port);

  const existing = await probeCdp(url);
  if (existing.ok) {
    log.dim(`Lightpanda already listening on ${host}:${port}`);
    return { pid: 0, host, port, protocol, stop: () => {} };
  }

  const info = findLightpanda();
  if (!info) throw new Error('Lightpanda binary not found. Run `wiraxplore doctor`.');

  const args: string[] = ['serve'];
  if (cfg.browser?.obeyRobots) args.push('--obey-robots');
  args.push('--host', host, '--port', String(port));
  if (protocol === 'bidi' || protocol === 'both') args.push('--protocol', 'webdriver');
  if (protocol === 'both') args.push('--protocol', 'cdp');
  if (protocol === 'cdp') args.push('--protocol', 'cdp');

  let cmd = info.path;
  let fullArgs = args;
  const viaWsl = info.path.startsWith('wsl:');
  if (viaWsl) {
    cmd = 'wsl';
    fullArgs = [info.path.slice(4), ...args];
  }

  rotateLog();
  const out = openSync(LOGFILE, 'a');
  const child = spawn(cmd, fullArgs, { detached: true, stdio: ['ignore', out, out] });
  child.unref();
  const pid = child.pid ?? 0;

  writeFileSync(PIDFILE, JSON.stringify({ pid, host, port, protocol, cmd, args: fullArgs, engine: 'lightpanda', viaWsl }), 'utf8');

  const ready = await waitForCdp(url);
  if (!ready) {
    log.warn(`CDP endpoint did not answer within 15s — see ${LOGFILE}`);
  }
  log.ok(`Lightpanda serve started (pid ${pid}) at ${host}:${port} [${protocol}]`);

  const stop = () => {
    killServerProcess({ pid, viaWsl, port });
    try { if (existsSync(PIDFILE)) unlinkSync(PIDFILE); } catch {}
  };
  return { pid, host, port, protocol, stop };
}

/**
 * Killing wsl.exe leaves the Lightpanda child running inside the VM, so for WSL we
 * ask the VM to terminate its own process; TCP and a probe confirm it is really gone.
 */
function killServerProcess(info: { pid: number; viaWsl?: boolean; port?: number }): void {
  if (info.viaWsl) {
    spawnSync('wsl', ['-e', 'sh', '-lc', "pkill -f 'lightpanda serve' || true"], { timeout: 10000 });
  }
  try { process.kill(info.pid); } catch {}
  if (info.port) {
    spawnSync(process.platform === 'win32' ? 'powershell' : 'sh', process.platform === 'win32'
      ? ['-NoProfile', '-Command', `Get-NetTCPConnection -LocalPort ${info.port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`]
      : ['-c', `command -v fuser >/dev/null && fuser -k ${info.port}/tcp || true`],
    { timeout: 10000 });
  }
}

export function stopServer(): boolean {
  if (!existsSync(PIDFILE)) {
    // No pidfile, but a stale listener may still hold the port.
    spawnSync('wsl', ['-e', 'sh', '-lc', "pkill -f 'lightpanda serve' || true"], { timeout: 10000 });
    return false;
  }
  try {
    const data = JSON.parse(readFileSync(PIDFILE, 'utf8'));
    killServerProcess({ pid: data.pid, viaWsl: data.viaWsl, port: data.port });
    unlinkSync(PIDFILE);
    log.ok('Lightpanda serve stopped');
    return true;
  } catch {
    return false;
  }
}

export function serverStatus(): { running: boolean; pid?: number; host?: string; port?: number; protocol?: string } {
  if (!existsSync(PIDFILE)) return { running: false };
  try {
    const data = JSON.parse(readFileSync(PIDFILE, 'utf8'));
    try {
      process.kill(data.pid, 0);
      return { running: true, pid: data.pid, host: data.host, port: data.port, protocol: data.protocol };
    } catch {
      return { running: false, host: data.host, port: data.port };
    }
  } catch {
    return { running: false };
  }
}

export async function statusWithProbe(): Promise<{ running: boolean; pid?: number; host?: string; port?: number; protocol?: string; cdp: boolean; version?: Record<string, unknown> }> {
  const st = serverStatus();
  const host = st.host ?? '127.0.0.1';
  const port = st.port ?? 9222;
  const probe = await probeCdp(cdpUrl(host, port));
  return { ...st, cdp: probe.ok, version: probe.version };
}

export function logFile(cwd: string = process.cwd()): string {
  return join(cwd, LOGFILE);
}
