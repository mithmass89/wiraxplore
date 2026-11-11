// src/server.ts
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { findLightpanda } from './binary.js';
import { log } from './utils/logger.js';
import type { ProjectConfig } from './config.js';

const PIDFILE = '.WiraXplore.pid';

export interface ServerHandle {
  pid: number;
  host: string;
  port: number;
  protocol: string;
  stop: () => void;
}

export async function startServer(cfg: ProjectConfig, opts?: { protocol?: string; detached?: boolean }): Promise<ServerHandle> {
  const info = findLightpanda();
  if (!info) throw new Error('Lightpanda binary not found. Run `WiraXplore doctor`.');
  const host = cfg.browser?.host ?? '127.0.0.1';
  const port = cfg.browser?.port ?? 9222;
  const protocol = opts?.protocol ?? 'cdp';
  const args: string[] = ['serve'];
  if (cfg.browser?.obeyRobots) args.push('--obey-robots');
  args.push('--host', host, '--port', String(port));
  if (protocol === 'bidi' || protocol === 'both') args.push('--protocol', 'webdriver');
  if (protocol === 'both') args.push('--protocol', 'cdp');
  if (protocol === 'cdp') args.push('--protocol', 'cdp');

  let cmd = info.path;
  let fullArgs = args;
  if (info.path.startsWith('wsl:')) {
    cmd = 'wsl';
    fullArgs = [info.path.slice(4), ...args];
  }

  const child = spawn(cmd, fullArgs, { detached: true, stdio: 'ignore' });
  child.unref();
  const pid = child.pid ?? 0;
  writeFileSync(PIDFILE, JSON.stringify({ pid, host, port, protocol, cmd, args: fullArgs }), 'utf8');

  // wait a bit for readiness
  await new Promise(r => setTimeout(r, 1500));
  log.ok(`Lightpanda serve started (pid ${pid}) at ${host}:${port} [${protocol}]`);

  const stop = () => {
    try { process.kill(pid); } catch {}
    try { if (existsSync(PIDFILE)) unlinkSync(PIDFILE); } catch {}
  };
  return { pid, host, port, protocol, stop };
}

export function stopServer(): boolean {
  if (!existsSync(PIDFILE)) return false;
  try {
    const data = JSON.parse(readFileSync(PIDFILE, 'utf8'));
    try { process.kill(data.pid); } catch {}
    unlinkSync(PIDFILE);
    log.ok('Lightpanda serve stopped');
    return true;
  } catch {
    return false;
  }
}

export function serverStatus(): { running: boolean; pid?: number; host?: string; port?: number } {
  if (!existsSync(PIDFILE)) return { running: false };
  try {
    const data = JSON.parse(readFileSync(PIDFILE, 'utf8'));
    // check alive
    try { process.kill(data.pid, 0); return { running: true, ...data }; }
    catch { return { running: false }; }
  } catch {
    return { running: false };
  }
}
