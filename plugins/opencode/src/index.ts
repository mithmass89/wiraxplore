// OpenCode V2 entrypoint for WiraXplore ("./v2" in package exports).
//
// OpenCode >= 1.18.29 loads plugins with `Plugin.define({ id, setup })`. Older hosts
// use the "./server" entrypoint instead.
import { Plugin } from '@opencode/plugin';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_COMMAND = ['npx', '-y', 'wiraxplore'];
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

export default Plugin.define({
  id: 'wiraxplore',

  async setup(ctx) {
    const command = resolveCommand();
    const dir = ctx.location.directory;

    await ctx.tool.namespace({
      name: 'panda',
      description: 'WiraXplore browser E2E testing (Lightpanda / Playwright / Puppeteer)',
    });

    await ctx.tool.transform((editor) => {
      editor.add({
        name: 'status',
        description: 'Report the configured browser engine, Lightpanda binary and CDP readiness',
        input: { type: 'object', properties: {}, additionalProperties: false },
        options: { namespace: 'panda', codemode: true },
        execute: async () => ({ content: runCli(['doctor', '--json'], dir) }),
      });

      editor.add({
        name: 'test',
        description: 'Run the project E2E specs against the configured browser engine',
        input: {
          type: 'object',
          properties: {
            engine: { type: 'string', enum: ENGINE_ENUM },
            filter: { type: 'string' },
          },
          additionalProperties: false,
        },
        options: { namespace: 'panda', codemode: true },
        execute: async (input) => {
          const args = ['test'];
          if (input?.engine) args.push('--engine', String(input.engine));
          if (input?.filter) args.push('--filter', String(input.filter));
          return { content: runCli(args, dir) };
        },
      });

      editor.add({
        name: 'server',
        description: 'Start, stop or inspect the Lightpanda CDP server',
        input: {
          type: 'object',
          properties: { action: { type: 'string', enum: ['start', 'stop', 'status'] } },
          required: ['action'],
          additionalProperties: false,
        },
        options: { namespace: 'panda', codemode: true },
        execute: async (input) => ({
          content: runCli([input.action === 'start' ? 'serve' : String(input.action)], dir),
        }),
      });
    });

    try {
      await ctx.mcp?.transform((editor) => {
        if (editor.get('wiraxplore')) return;
        editor.set('wiraxplore', { type: 'local', command: [...command, 'mcp'] });
      });
    } catch {}

    return () => {};
  },
});
