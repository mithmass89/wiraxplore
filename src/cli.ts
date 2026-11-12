// src/cli.ts
import { Command } from 'commander';
import { loadConfig, writeDefaultConfig, configPath } from './config.js';
import { findLightpanda, installHint } from './binary.js';
import { startServer, stopServer, statusWithProbe, logFile } from './server.js';
import { runMcpServer } from './mcp/server.js';
import { engineReport, planEngine, resolveExecutable, ENGINE_NAMES, DRIVER_NAMES } from './adapters/engine.js';
import { pm2Available, writeEcosystem, requirePm2, runPm2, resolveCliCommand, ECOSYSTEM_FILE, PM2_APP_NAME } from './pm2.js';
import { log } from './utils/logger.js';
import { detectPlatform } from './utils/platform.js';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const program = new Command();
program.name('wiraxplore').description('E2E testing harness for Lightpanda, Playwright and Puppeteer').version('0.2.0');

const DEMO_HTML = `<!doctype html>
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
`;

const DEMO_SPEC = `import { test, expect } from 'vitest';
import { withPage } from 'wiraxplore';
import { loadConfig } from 'wiraxplore';

const demo = \`${DEMO_HTML.replace(/`/g, '\\`')}\`;

test('demo greet flow', async () => {
  const cfg = loadConfig(process.cwd());
  await withPage(cfg, async (page) => {
    await page.setContent(demo);
    expect(await page.text('#title')).toBe('Hello Panda');
    await page.fill('#name', 'Panda');
    await page.click('#greet');
    expect(await page.text('#out')).toBe('Hello, Panda');
  });
}, 60000);
`;

const OPENCODE_PLUGIN_ENTRY = './plugins/wiraxplore';

/**
 * Adds the plugin to opencode.json/jsonc without disturbing JSONC comments.
 * OpenCode 1.x uses `plugin: []`; 2.x renamed it to `plugins: []`.
 */
function registerOpencodePlugin(configDir: string): { file: string; key: string } | null {
  for (const name of ['opencode.jsonc', 'opencode.json']) {
    const file = join(configDir, name);
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, 'utf8');
    if (raw.includes(OPENCODE_PLUGIN_ENTRY)) return { file, key: 'existing' };

    for (const key of ['plugin', 'plugins']) {
      const match = raw.match(new RegExp(`"${key}"\\s*:\\s*\\[`));
      if (!match) continue;
      const insertAt = (match.index ?? 0) + match[0].length;
      const rest = raw.slice(insertAt).replace(/^\s+/, '');
      const closing = rest.startsWith(']');
      const body = closing
        ? `\n    ${JSON.stringify(OPENCODE_PLUGIN_ENTRY)}\n  `
        : `\n    ${JSON.stringify(OPENCODE_PLUGIN_ENTRY)},\n    ${rest}`;
      const updated = raw.slice(0, insertAt) + body;
      writeFileSync(file, updated, 'utf8');
      return { file, key };
    }
  }
  return null;
}

/**
 * Registers the WiraXplore MCP server in opencode.json(c).
 * OpenCode 2.x nests servers under `mcp.servers`; 1.x uses a flat `mcp` map.
 * Returns the shape used, or null when the file has no `mcp` block to extend.
 */
function registerOpencodeMcp(configDir: string, command: string[]): string | null {
  for (const name of ['opencode.jsonc', 'opencode.json']) {
    const file = join(configDir, name);
    if (!existsSync(file)) continue;
    let raw = readFileSync(file, 'utf8');
    if (raw.includes('"wiraxplore"')) return 'existing';

    const nested = /"mcp"\s*:\s*\{[\s\S]*?"servers"\s*:\s*\{/.test(raw);
    const server = JSON.stringify({ type: 'local', command }, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? line : `      ${line}`))
      .join('\n');

    const anchor = nested ? /"servers"\s*:\s*\{/ : /"mcp"\s*:\s*\{/;
    const match = raw.match(anchor);
    if (!match) return null;
    const insertAt = (match.index ?? 0) + match[0].length;
    const rest = raw.slice(insertAt).replace(/^\s+/, '');
    const entry = `\n      "wiraxplore": ${server}${rest.startsWith('}') ? '\n    ' : ','}`;
    raw = raw.slice(0, insertAt) + entry + rest;
    writeFileSync(file, raw, 'utf8');
    return nested ? 'mcp.servers' : 'mcp';
  }
  return null;
}

program
  .command('init')
  .description('Scaffold config, demo spec, and agent instructions for the target project')
  .option('--force', 'overwrite existing files')
  .option('--no-agent', 'skip the .agents/skills instructions')
  .action((opts) => {
    const cwd = process.cwd();
    const cfgFile = join(cwd, 'wiraxplore.config.yaml');
    if (existsSync(cfgFile) && !opts.force) {
      log.warn(`${cfgFile} already exists (use --force to overwrite)`);
    } else {
      log.ok(`config written: ${writeDefaultConfig(cwd)}`);
    }

    const webDir = join(cwd, 'examples', 'webapp');
    mkdirSync(webDir, { recursive: true });
    writeFileSync(join(webDir, 'index.html'), DEMO_HTML, 'utf8');

    const testDir = join(cwd, 'tests', 'e2e');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'demo.spec.ts'), DEMO_SPEC, 'utf8');

    log.ok('scaffolded examples/webapp/index.html and tests/e2e/demo.spec.ts');

    if (opts.agent !== false) {
      const here = dirname(fileURLToPath(import.meta.url));
      const skillFile = join(here, '..', 'skills', 'wiraxplore', 'SKILL.md');
      const skillDir = join(cwd, '.agents', 'skills', 'wiraxplore');
      if (existsSync(skillFile)) {
        mkdirSync(skillDir, { recursive: true });
        cpSync(skillFile, join(skillDir, 'SKILL.md'));
        log.ok(`agent instructions written to ${join(skillDir, 'SKILL.md')}`);
        log.dim('.agents/skills is read by Command Code and OpenCode; commit it.');
      } else {
        log.warn('skill template not found; run `wiraxplore plugin:commandcode` instead');
      }
    }

    log.info('Next: `wiraxplore doctor`, then `wiraxplore test`');
  });

program
  .command('doctor')
  .description('Check platform, browser engines and server readiness')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const cfg = loadConfig();
    const plan = planEngine(cfg);
    const bin = findLightpanda();
    const wslOut = process.platform === 'win32' ? spawnSync('wsl', ['--status'], { encoding: 'utf8' }) : null;
    const engineInfo = engineReport(cfg);
    const lp = engineInfo.lightpanda as { path: string; source: string; version?: string } | null;
    const serverInfo = await statusWithProbe();
    const report = {
      ...engineInfo,
      node: process.version,
      configFile: configPath(),
      wsl: wslOut ? wslOut.status === 0 : null,
      server: serverInfo,
    };

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    log.step(`platform: ${detectPlatform()} (${process.arch})`);
    log.step(`config: ${report.configFile ?? 'none (defaults)'}`);
    log.ok(`node ${process.version}`);

    if (lp) log.ok(`lightpanda: ${lp.path} (${lp.source}) version=${lp.version ?? 'unknown'}`);
    else {
      log.warn('lightpanda not found — engines "playwright"/"puppeteer" still work');
      log.dim(installHint());
    }

    if (plan.mode === 'launch') {
      const exe = resolveExecutable({ executablePath: cfg.browser?.executablePath, channel: cfg.browser?.channel });
      if (exe) log.ok(`${plan.driver} browser: ${exe}`);
      else log.warn(`${plan.driver} needs Chrome/Edge — set browser.channel or browser.executablePath`);
    }

    if (serverInfo.cdp) {
      log.ok(`CDP ready at ${serverInfo.host ?? '127.0.0.1'}:${serverInfo.port ?? 9222} (${String(serverInfo.version?.Browser ?? 'unknown')})`);
    } else if (plan.engine === 'lightpanda') {
      // The active engine cannot talk to a browser without this endpoint, so say it
      // as a failure instead of a note next to a reassuring "lightpanda ✓".
      log.error(`CDP not reachable at ${serverInfo.host ?? '127.0.0.1'}:${serverInfo.port ?? 9222} — the "lightpanda" engine will fail every test`);
      log.dim('Fix: run `wiraxplore serve`, or switch to --engine playwright / puppeteer.');
    } else {
      log.ok('CDP not needed — the active engine launches its own browser');
    }

    log.step(`active engine: ${plan.engine} via ${plan.driver} (${plan.mode})`);

    if (process.platform === 'win32') {
      log.ok(wslOut?.status === 0 ? 'WSL available' : 'WSL not available (needed for lightpanda on Windows)');
      if (lp?.source === 'wsl') {
        log.warn('Lightpanda runs inside WSL: "localhost" in the browser is WSL, not Windows.');
        log.dim('If baseUrl points at an app on Windows, use the WSL gateway IP instead of localhost:');
        log.dim('  WIRAXPLORE_BASE_URL=http://<gateway-ip>:<port> (see `ip route show default` inside WSL)');
      }
    }
  });

program
  .command('serve')
  .description('Start the Lightpanda CDP server')
  .option('-p, --protocol <p>', 'cdp|bidi|both', 'cdp')
  .option('--host <host>', 'listen address (default: config or 127.0.0.1)')
  .option('--port <port>', 'listen port (default: config or 9222)', Number)
  .action(async (opts) => {
    const base = loadConfig();
    const cfg: typeof base = {
      ...base,
      browser: {
        ...base.browser,
        ...(opts.host ? { host: opts.host } : {}),
        ...(Number.isFinite(opts.port) ? { port: opts.port } : {}),
      },
    };
    const h = await startServer(cfg, { protocol: opts.protocol });
    log.ok(`serving at ${h.host}:${h.port} (pid ${h.pid}) — log: ${logFile()}`);
    log.dim('Press Ctrl+C to stop.');
    process.on('SIGINT', () => { h.stop(); process.exit(0); });
    await new Promise(() => {});
  });

program.command('stop').description('Stop the Lightpanda CDP server').action(async () => {
  const ok = stopServer();
  if (ok) log.ok('stopped');
  else log.warn('not running');
});

program.command('status').description('Show server and engine status').action(async () => {
  const cfg = loadConfig();
  const st = await statusWithProbe();
  console.log(JSON.stringify(st, null, 2));
  const plan = planEngine(cfg);
  const bin = findLightpanda();
  console.log('engine:', `${plan.engine} via ${plan.driver}`);
  console.log('binary:', bin ? bin.path : 'NOT FOUND');
});

program
  .command('test')
  .description('Run E2E specs with the configured engine')
  .option('--no-serve', 'do not auto-start the Lightpanda server')
  .option('-e, --engine <engine>', `override engine (${ENGINE_NAMES.join('|')})`)
  .option('-d, --driver <driver>', `override driver (${DRIVER_NAMES.join('|')})`)
  .option('-f, --filter <pattern>', 'only run specs matching this filter')
  .option('--headed', 'show the browser window (playwright/puppeteer engines only)')
  .option('--slow-mo <ms>', 'delay between driver actions, to watch a headed run', Number)
  .option('--ui', 'run vitest in watch UI mode')
  .action(async (opts) => {
    const cfg = loadConfig();
    const requestedEngine = opts.engine ?? cfg.browser?.engine ?? 'lightpanda';

    // --headed asks for a visible window. Lightpanda has none, so pick a real
    // browser instead of silently running headless with no window on screen.
    let engine = requestedEngine;
    if (opts.headed === true && requestedEngine === 'lightpanda') {
      engine = 'playwright';
      log.warn('lightpanda has no window — --headed switched to the "playwright" engine (local Chrome/Edge)');
    }

    const plan = planEngine(cfg, {
      engine,
      driver: opts.driver,
      headed: opts.headed === true,
      slowMo: Number.isFinite(opts.slowMo) ? opts.slowMo : undefined,
    });
    let started = false;

    if (plan.engine === 'lightpanda' && opts.serve !== false) {
      const st = await statusWithProbe();
      if (!st.cdp) {
        await startServer(cfg, { protocol: cfg.browser?.mode === 'bidi' ? 'bidi' : 'cdp' });
        started = true;
      }
    }

    if (plan.engine === 'lightpanda') {
      // Fail once, here, instead of letting fifteen specs each report ECONNREFUSED.
      const st = await statusWithProbe();
      if (!st.cdp) {
        log.error(`CDP not reachable at ${plan.cdpUrl} — refusing to run ${plan.engine} tests`);
        log.dim('Run `wiraxplore serve` first, or use --engine playwright / puppeteer.');
        process.exit(1);
      }
    }

    const env = {
      ...process.env,
      WIRAXPLORE_ENGINE: plan.engine,
      WIRAXPLORE_DRIVER: plan.driver,
      ...(plan.cdpUrl ? { WIRAXPLORE_CDP_URL: plan.cdpUrl } : {}),
      ...(plan.headless ? {} : { WIRAXPLORE_HEADED: '1' }),
      ...(plan.slowMo ? { WIRAXPLORE_SLOWMO: String(plan.slowMo) } : {}),
    };
    const testDir = cfg.tests?.dir ?? 'tests/e2e';
    const timeoutMs = cfg.tests?.timeoutMs ?? 30000;
    const vitest = join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
    const common = [
      opts.ui ? '' : 'run',
      opts.filter ?? testDir,
      '--testTimeout',
      String(timeoutMs),
      ...(cfg.tests?.args ?? []),
    ].filter(Boolean);
    const args = existsSync(vitest) ? [vitest, ...common] : ['-y', 'vitest', ...common];
    const cmd = existsSync(vitest) ? process.execPath : 'npx';

    const visual = plan.headless ? 'headless' : `headed${plan.slowMo ? ` slowMo=${plan.slowMo}ms` : ''}`;
    log.step(`running vitest [${plan.engine} via ${plan.driver}, ${visual}] in ${testDir}`);
    const r = spawnSync(cmd, args, { stdio: 'inherit', env });
    if (started) stopServer();
    process.exit(r.status ?? 1);
  });

program.command('mcp').description('Run the MCP server (stdio) for coding agents').action(async () => {
  await runMcpServer();
});

const pm2 = program.command('pm2').description(`Keep the Lightpanda server running under pm2`);

pm2
  .command('init')
  .description(`Write ${ECOSYSTEM_FILE} for the current project`)
  .option('--host <host>', 'CDP host', '127.0.0.1')
  .option('--port <port>', 'CDP port', '9222')
  .option('--protocol <p>', 'cdp|bidi|both', 'cdp')
  .option('--force', 'overwrite an existing ecosystem file')
  .action((opts) => {
    const cwd = process.cwd();
    const file = join(cwd, ECOSYSTEM_FILE);
    if (existsSync(file) && !opts.force) {
      log.warn(`${ECOSYSTEM_FILE} already exists (use --force to overwrite)`);
      return;
    }
    const written = writeEcosystem(cwd, { host: opts.host, port: Number(opts.port), protocol: opts.protocol });
    log.ok(`wrote ${written}`);
    log.dim(`Next: pm2 start ${ECOSYSTEM_FILE} && pm2 save`);
    if (!pm2Available()) {
      log.warn('pm2 is not installed yet — npm i -g pm2');
      log.dim(`Command the file runs: ${resolveCliCommand(cwd).join(' ')} serve`);
    }
  });

pm2
  .command('start')
  .description('Start the ecosystem file, then run `pm2 save` so it survives reboot')
  .option('--host <host>', 'CDP host', '127.0.0.1')
  .option('--port <port>', 'CDP port', '9222')
  .action((opts) => {
    requirePm2();
    const cwd = process.cwd();
    if (!existsSync(join(cwd, ECOSYSTEM_FILE))) {
      const written = writeEcosystem(cwd, { host: opts.host, port: Number(opts.port) });
      log.ok(`wrote ${written}`);
    }
    const start = runPm2(['start', ECOSYSTEM_FILE, '--update-env'], cwd);
    if (!start.ok) {
      log.error('pm2 start failed');
      process.exit(1);
    }
    const save = runPm2(['save'], cwd);
    log.ok(save.ok ? 'started and saved — `pm2 resurrect` will restore it after reboot' : 'started, but `pm2 save` failed');
    log.dim('Check with: pm2 status');
  });

pm2
  .command('save')
  .description('Persist the running process list (`pm2 save`)')
  .action(() => {
    requirePm2();
    const result = runPm2(['save'], process.cwd());
    if (!result.ok) {
      log.error('pm2 save failed');
      process.exit(1);
    }
    log.ok('pm2 save — process list persisted');
    log.dim(`After reboot: pm2 resurrect (or install startup with pm2 startup)`);
  });

pm2
  .command('status')
  .description('Show the WiraXplore process as pm2 sees it')
  .action(() => {
    requirePm2();
    runPm2(['describe', PM2_APP_NAME], process.cwd());
  });

pm2
  .command('stop')
  .description('Stop and remove the WiraXplore process from pm2')
  .action(() => {
    requirePm2();
    runPm2(['delete', PM2_APP_NAME], process.cwd());
    runPm2(['save'], process.cwd());
    log.ok(`pm2 process ${PM2_APP_NAME} removed and saved`);
  });

program
  .command('plugin:opencode')
  .description('Install the OpenCode plugin + skill and register it in opencode.jsonc')
  .option('--dir <path>', 'OpenCode config directory', join(homedir(), '.config', 'opencode'))
  .action((opts) => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = join(here, '..');
    const templateDir = join(pkgRoot, 'plugins', 'opencode');
    const skillFile = join(pkgRoot, 'skills', 'wiraxplore', 'SKILL.md');
    const configDir = opts.dir as string;
    const pluginDir = join(configDir, 'plugins', 'wiraxplore');
    const skillDir = join(configDir, 'skills', 'wiraxplore');

    if (!existsSync(join(templateDir, 'src', 'server.ts'))) {
      log.error(`plugin template missing at ${templateDir}`);
      process.exit(1);
    }

    mkdirSync(configDir, { recursive: true });
    const configFile = ['opencode.jsonc', 'opencode.json'].map((n) => join(configDir, n)).find(existsSync);
    if (!configFile) {
      writeFileSync(
        join(configDir, 'opencode.json'),
        `${JSON.stringify({ $schema: 'https://opencode.ai/config.json', plugin: [], mcp: {} }, null, 2)}\n`,
        'utf8',
      );
      log.ok(`created ${join(configDir, 'opencode.json')}`);
    }

    mkdirSync(pluginDir, { recursive: true });
    cpSync(join(templateDir, 'src'), join(pluginDir, 'src'), { recursive: true });
    cpSync(join(templateDir, 'package.json'), join(pluginDir, 'package.json'));
    log.ok(`plugin installed at ${pluginDir}`);

    const command = [process.execPath, join(pkgRoot, 'bin', 'wiraxplore.js')];
    writeFileSync(join(pluginDir, 'wiraxplore.bin.json'), JSON.stringify({ command }, null, 2), 'utf8');
    log.ok(`CLI command pinned: ${command.join(' ')}`);

    if (existsSync(skillFile)) {
      mkdirSync(skillDir, { recursive: true });
      cpSync(skillFile, join(skillDir, 'SKILL.md'));
      log.ok(`skill installed at ${skillDir}`);
    }

    const registered = registerOpencodePlugin(configDir);
    if (registered?.key === 'existing') log.ok(`plugin already registered in ${registered.file}`);
    else if (registered) log.ok(`registered "${OPENCODE_PLUGIN_ENTRY}" under "${registered.key}" in ${registered.file}`);
    else {
      log.warn(`could not update ${join(configDir, 'opencode.jsonc')} automatically — add this to its "plugin" array:`);
      console.log(`  ${JSON.stringify(OPENCODE_PLUGIN_ENTRY)}`);
    }

    const mcpShape = registerOpencodeMcp(configDir, ['npx', '-y', 'wiraxplore', 'mcp']);
    if (mcpShape === 'existing') log.ok('MCP server "wiraxplore" already configured');
    else if (mcpShape) log.ok(`MCP server "wiraxplore" registered under "${mcpShape}"`);
    else {
      log.warn('could not register the MCP server automatically — add this to your OpenCode config:');
      console.log(`  "mcp": { "wiraxplore": { "type": "local", "command": ["npx", "-y", "wiraxplore", "mcp"] } }`);
    }

    log.dim('Restart OpenCode to load the plugin and MCP tools.');
  });

program
  .command('agent:init')
  .description('Add WiraXplore instructions for AI agents to this project')
  .option('--dir <path>', 'project root', process.cwd())
  .option('--agents-md', 'also append a pointer to AGENTS.md')
  .action((opts) => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = join(here, '..');
    const skillFile = join(pkgRoot, 'skills', 'wiraxplore', 'SKILL.md');
    const projectDir = opts.dir as string;
    const skillDir = join(projectDir, '.agents', 'skills', 'wiraxplore');

    if (!existsSync(skillFile)) {
      log.error(`skill template missing at ${skillFile}`);
      process.exit(1);
    }

    mkdirSync(skillDir, { recursive: true });
    cpSync(skillFile, join(skillDir, 'SKILL.md'));
    log.ok(`skill written to ${join(skillDir, 'SKILL.md')}`);
    log.dim('Read by Command Code and OpenCode. Commit it with the project.');

    if (opts.agentsMd) {
      const agentsFile = join(projectDir, 'AGENTS.md');
      const pointer = [
        '## Browser E2E tests',
        '',
        'This project uses WiraXplore for browser E2E tests.',
        'Read @.agents/skills/wiraxplore/SKILL.md before writing or running specs.',
        '',
        'Quick check:',
        '',
        '```bash',
        'pnpm exec wiraxplore doctor',
        'pnpm exec wiraxplore test',
        '```',
        '',
      ].join('\n');
      const existing = existsSync(agentsFile) ? readFileSync(agentsFile, 'utf8') : '';
      if (existing.includes('.agents/skills/wiraxplore')) {
        log.ok('AGENTS.md already points at the skill');
      } else {
        writeFileSync(agentsFile, existing ? `${existing.trimEnd()}\n\n${pointer}` : `# AGENTS.md\n\n${pointer}`, 'utf8');
        log.ok(`pointer appended to ${agentsFile}`);
      }
    }
  });

program
  .command('plugin:commandcode')
  .description('Install the skill and print the Command Code MCP setup')
  .option('--dir <path>', 'Command Code config directory', join(homedir(), '.commandcode'))
  .action((opts) => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = join(here, '..');
    const skillFile = join(pkgRoot, 'skills', 'wiraxplore', 'SKILL.md');
    const skillDir = join(opts.dir as string, 'skills', 'wiraxplore');

    if (existsSync(skillFile)) {
      mkdirSync(skillDir, { recursive: true });
      cpSync(skillFile, join(skillDir, 'SKILL.md'));
      log.ok(`skill installed at ${skillDir}`);
    }

    const local = `cmd mcp add wiraxplore -- node "${join(pkgRoot, 'bin', 'wiraxplore.js')}" mcp`;
    log.info('Register the MCP server with Command Code:');
    console.log(`  ${local}`);
    log.dim('This package is not on npm yet, so use the path above, not npx.');
    log.dim('Then check it with: cmd mcp list');
  });

program.command('flutter').description('Flutter E2E helpers (placeholder)').action(() => {
  log.info('Flutter support is planned. See docs/FLUTTER.md');
});

program.parseAsync(process.argv).catch((e) => { console.error(e); process.exit(1); });
