// src/cli.ts
import { Command } from 'commander';
import { loadConfig, writeDefaultConfig, configPath } from './config.js';
import { findLightpanda, installHint } from './binary.js';
import { startServer, stopServer, statusWithProbe, logFile } from './server.js';
import { runMcpServer } from './mcp/server.js';
import { engineReport, planEngine, resolveExecutable, ENGINE_NAMES, DRIVER_NAMES } from './adapters/engine.js';
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

    if (serverInfo.cdp) log.ok(`CDP ready at ${serverInfo.host ?? '127.0.0.1'}:${serverInfo.port ?? 9222} (${String(serverInfo.version?.Browser ?? 'unknown')})`);
    else log.warn('CDP server not answering — run `wiraxplore serve` (not needed for playwright/puppeteer engines)');

    log.step(`active engine: ${plan.engine} via ${plan.driver} (${plan.mode})`);
    if (process.platform === 'win32') {
      log.ok(wslOut?.status === 0 ? 'WSL available' : 'WSL not available (needed for lightpanda on Windows)');
    }
  });

program
  .command('serve')
  .description('Start the Lightpanda CDP server')
  .option('-p, --protocol <p>', 'cdp|bidi|both', 'cdp')
  .action(async (opts) => {
    const cfg = loadConfig();
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
  .option('--ui', 'run vitest in watch UI mode')
  .action(async (opts) => {
    const cfg = loadConfig();
    const plan = planEngine(cfg, { engine: opts.engine, driver: opts.driver });
    let started = false;

    if (plan.engine === 'lightpanda' && opts.serve !== false) {
      const st = await statusWithProbe();
      if (!st.cdp) {
        await startServer(cfg, { protocol: cfg.browser?.mode === 'bidi' ? 'bidi' : 'cdp' });
        started = true;
      }
    }

    const env = {
      ...process.env,
      WIRAXPLORE_ENGINE: plan.engine,
      WIRAXPLORE_DRIVER: plan.driver,
      ...(plan.cdpUrl ? { WIRAXPLORE_CDP_URL: plan.cdpUrl } : {}),
    };
    const testDir = cfg.tests?.dir ?? 'tests/e2e';
    const vitest = join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
    const args = existsSync(vitest)
      ? [vitest, opts.ui ? '' : 'run', opts.filter ?? testDir, ...(cfg.tests?.args ?? [])].filter(Boolean)
      : ['-y', 'vitest', opts.ui ? '' : 'run', opts.filter ?? testDir, ...(cfg.tests?.args ?? [])].filter(Boolean);
    const cmd = existsSync(vitest) ? process.execPath : 'npx';

    log.step(`running vitest [${plan.engine} via ${plan.driver}] in ${testDir}`);
    const r = spawnSync(cmd, args, { stdio: 'inherit', env });
    if (started) stopServer();
    process.exit(r.status ?? 1);
  });

program.command('mcp').description('Run the MCP server (stdio) for coding agents').action(async () => {
  await runMcpServer();
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
        'npx wiraxplore doctor    # or: node ../wiraxplore/bin/wiraxplore.js doctor',
        'npx wiraxplore test',
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
    log.dim('Or, once published: cmd mcp add wiraxplore -- npx -y wiraxplore mcp');
    log.dim('Then check it with: cmd mcp list');
  });

program.command('flutter').description('Flutter E2E helpers (placeholder)').action(() => {
  log.info('Flutter support is planned. See docs/FLUTTER.md');
});

program.parseAsync(process.argv).catch((e) => { console.error(e); process.exit(1); });
