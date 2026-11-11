// src/cli.ts
import { Command } from 'commander';
import { loadConfig, writeDefaultConfig } from './config.js';
import { findLightpanda, binaryVersion, installHint } from './binary.js';
import { startServer, stopServer, serverStatus } from './server.js';
import { runMcpServer } from './mcp/server.js';
import { log } from './utils/logger.js';
import { detectPlatform } from './utils/platform.js';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const program = new Command();
program.name('webnix').description('E2E testing harness on Lightpanda browser').version('0.1.0');

program.command('init').description('Scaffold config + example test + example web app').action(() => {
  const cwd = process.cwd();
  const p = writeDefaultConfig(cwd);
  log.ok(`config written: ${p}`);
  // example webapp
  const webDir = join(cwd, 'examples', 'webapp');
  mkdirSync(webDir, { recursive: true });
  writeFileSync(join(webDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Panda E2E Demo</title></head>
<body>
  <h1 id="title">Hello Panda</h1>
  <input id="name" placeholder="Your name" />
  <button id="greet">Greet</button>
  <p id="out"></p>
  <script>
    document.getElementById('greet').addEventListener('click', () => {
      const v = document.getElementById('name').value;
      document.getElementById('out').textContent = 'Hello, ' + (v || 'stranger');
    });
  </script>
</body></html>
`, 'utf8');
  // example spec
  const testDir = join(cwd, 'tests', 'e2e');
  mkdirSync(testDir, { recursive: true });
  writeFileSync(join(testDir, 'demo.spec.ts'), `import { test, expect } from 'vitest';
import { withPage } from 'webnix';
import { loadConfig } from 'webnix';

test('demo greet flow', async () => {
  const cfg = loadConfig(process.cwd());
  await withPage(cfg, async (page) => {
    await page.setContent(\`<!doctype html><html><body>
      <h1 id="title">Hello Panda</h1>
      <input id="name" placeholder="Your name" />
      <button id="greet">Greet</button>
      <p id="out"></p>
      <script>
        document.getElementById('greet').addEventListener('click', () => {
          const v = document.getElementById('name').value;
          document.getElementById('out').textContent = 'Hello, ' + (v || 'stranger');
        });
      </script>
    </body></html>\`);
    const title = await page.locator('#title').textContent();
    expect(title).toBe('Hello Panda');
    await page.fill('#name', 'Panda');
    await page.click('#greet');
    const out = await page.locator('#out').textContent();
    expect(out).toBe('Hello, Panda');
  });
});
`, 'utf8');
  log.ok('scaffolded examples/webapp and tests/e2e/demo.spec.ts');
  log.info('Next: webnix doctor, then webnix serve, then webnix test');
});

program.command('doctor').description('Check environment & Lightpanda availability').action(async () => {
  log.step(`platform: ${detectPlatform()} (${process.arch})`);
  const bin = findLightpanda();
  if (bin) {
    log.ok(`lightpanda found: ${bin.path} (${bin.source}) version=${binaryVersion(bin) ?? 'unknown'}`);
  } else {
    log.error('lightpanda NOT found');
    console.log(installHint());
  }
  // node
  log.ok(`node ${process.version}`);
  // check playwright-core
  try { const { createRequire } = await import('node:module'); const r = createRequire(import.meta.url); r.resolve('playwright-core'); log.ok('playwright-core installed'); } catch { log.warn('playwright-core not resolved (run pnpm install)'); }
  // wsl/docker hints
  if (process.platform === 'win32') {
    const wsl = spawnSync('wsl', ['--status'], { encoding: 'utf8' });
    if (wsl.status === 0) log.ok('WSL available'); else log.warn('WSL not available (needed on Windows for lightpanda)');
    const docker = spawnSync('docker', ['--version'], { encoding: 'utf8' });
    if (docker.status === 0) log.ok('Docker available'); else log.warn('Docker not available');
  }
});

program.command('serve').description('Start Lightpanda CDP server').option('-p, --protocol <p>', 'cdp|bidi|both', 'cdp').action(async (opts) => {
  const cfg = loadConfig();
  const h = await startServer(cfg, { protocol: opts.protocol });
  log.ok(`serving at ${h.host}:${h.port} (pid ${h.pid})`);
  log.dim('Press Ctrl+C to stop.');
  process.on('SIGINT', () => { h.stop(); process.exit(0); });
  // keep alive
  await new Promise(() => {});
});

program.command('stop').description('Stop Lightpanda CDP server').action(() => {
  const ok = stopServer();
  if (ok) log.ok('stopped'); else log.warn('not running');
});

program.command('status').description('Show server status').action(() => {
  const st = serverStatus();
  console.log(JSON.stringify(st, null, 2));
  const bin = findLightpanda();
  console.log('binary:', bin ? bin.path : 'NOT FOUND');
});

program.command('test').description('Run E2E tests against Lightpanda').option('--no-serve', 'do not auto-start server').action(async (opts) => {
  const cfg = loadConfig();
  // ensure server
  const st = serverStatus();
  let started = false;
  if (!st.running && opts.serve !== false) {
    await startServer(cfg, { protocol: cfg.browser?.mode === 'bidi' ? 'bidi' : 'cdp' });
    started = true;
  }
  // run vitest
  const testDir = cfg.tests?.dir ?? 'tests/e2e';
  const r = spawnSync('npx', ['vitest', 'run', testDir], { stdio: 'inherit', shell: true });
  if (started) stopServer();
  process.exit(r.status ?? 0);
});

program.command('mcp').description('Run MCP server (stdio) for coding agents').action(async () => {
  await runMcpServer();
});

program.command('plugin:opencode').description('Install OpenCode plugin + register MCP').action(async () => {
  const home = homedir();
  const pluginDir = join(home, '.config', 'opencode', 'plugins', 'webnix');
  mkdirSync(pluginDir, { recursive: true });
  // copy template from repo if present
  const templateDir = resolve(process.cwd(), 'plugins', 'opencode');
  if (existsSync(templateDir)) {
    const { cpSync } = await import('node:fs');
    cpSync(templateDir, pluginDir, { recursive: true });
  } else {
    // write minimal plugin
    mkdirSync(join(pluginDir, 'src'), { recursive: true });
    writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({
      name: 'webnix-opencode',
      version: '0.1.0',
      private: true,
      type: 'module',
      main: './src/index.ts',
      dependencies: { '@opencode/plugin': 'latest' }
    }, null, 2));
    writeFileSync(join(pluginDir, 'src', 'index.ts'), `import { Plugin } from '@opencode/plugin';
export default Plugin.define({
  id: 'webnix',
  async setup(ctx) {
    await ctx.tool.namespace({ name: 'panda', description: 'Webnix testing' });
    await ctx.tool.transform(editor => {
      editor.add({ name: 'status', description: 'Show webnix status', input: { type:'object', properties:{}, additionalProperties:false }, options:{namespace:'panda', codemode:true}, execute: async () => ({ content: 'webnix ready' }) });
    });
    await ctx.mcp?.register?.({ name: 'webnix', command: ['webnix','mcp'] }).catch(()=>{});
  }
});
`);
  }
  log.ok(`plugin installed at ${pluginDir}`);
  log.info('Register MCP server in opencode.jsonc mcp.servers if not already:');
  console.log(JSON.stringify({ 'webnix': { type: 'local', command: ['webnix', 'mcp'] } }, null, 2));
});

program.command('flutter').description('Flutter E2E helpers (placeholder)').action(() => {
  log.info('Flutter support is planned. See docs/FLUTTER.md');
  log.info('For now, run flutter driver separately and point tests at the device.');
});

program.parseAsync(process.argv).catch((e) => { console.error(e); process.exit(1); });
