// OpenCode server entrypoint for WiraXplore.
//
// Loaded by OpenCode 1.x through the package `exports` map ("./server"). It returns
// a tool map that shells out to the WiraXplore CLI. The same package also ships a
// V2 entrypoint ("./v2") for newer hosts.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_COMMAND = ['wiraxplore']; // resolved from PATH; see wiraxplore.bin.json
const ENGINE_ENUM = ['lightpanda', 'playwright', 'puppeteer'];

function resolveCommand() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const candidate of [join(here, 'wiraxplore.bin.json'), join(here, '..', 'wiraxplore.bin.json')]) {
      if (!existsSync(candidate)) continue;
      const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
      if (Array.isArray(parsed.command) && parsed.command.length > 0) return parsed.command;
    }
  } catch {}
  return DEFAULT_COMMAND;
}

function runCli(args, cwd) {
  const command = resolveCommand();
  const result = spawnSync(command[0], [...command.slice(1), ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 15 * 60 * 1000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return output.slice(-12000) || `exit ${result.status}`;
}

export const server = async ({ directory = process.cwd() } = {}) => ({
  tool: {
    panda_status: {
      description: 'Report the configured browser engine, Lightpanda binary and CDP readiness',
      args: {},
      execute: async () => runCli(['doctor', '--json'], directory),
    },
    panda_test: {
      description: 'Run the project E2E specs against the configured browser engine',
      args: {
        engine: { type: 'string', enum: ENGINE_ENUM, description: 'Override the browser engine' },
        filter: { type: 'string', description: 'Spec file or substring filter' },
      },
      execute: async (args = {}) => {
        const cli = ['test'];
        if (args.engine) cli.push('--engine', String(args.engine));
        if (args.filter) cli.push('--filter', String(args.filter));
        return runCli(cli, directory);
      },
    },
    panda_server: {
      description: 'Start, stop or inspect the Lightpanda CDP server',
      args: { action: { type: 'string', enum: ['start', 'stop', 'status'] } },
      execute: async (args = {}) => runCli([args.action === 'start' ? 'serve' : String(args.action)], directory),
    },
  },
  mcp: {
    wiraxplore: { type: 'local', command: [...resolveCommand(), 'mcp'] },
  },
});
