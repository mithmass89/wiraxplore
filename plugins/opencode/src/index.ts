// plugins/opencode/src/index.ts
import { Plugin } from '@opencode/plugin';

export default Plugin.define({
  id: 'wiraxplore',
  async setup(ctx) {
    await ctx.storage.set('loaded', true);
    await ctx.tool.namespace({ name: 'panda', description: 'WiraXplore testing helpers' });

    await ctx.tool.transform((editor: any) => {
      editor.add({
        name: 'status',
        description: 'Show WiraXplore / Lightpanda status',
        input: { type: 'object', properties: {}, additionalProperties: false },
        options: { namespace: 'panda', codemode: true },
        execute: async () => ({ content: 'WiraXplore ready. Run `WiraXplore status` for details.' })
      });
      editor.add({
        name: 'serve',
        description: 'Start Lightpanda serve (detached)',
        input: { type: 'object', properties: { protocol: { type: 'string' } }, additionalProperties: false },
        options: { namespace: 'panda', codemode: true },
        execute: async (input: any) => {
          const proto = input?.protocol ?? 'cdp';
          return { content: `run: WiraXplore serve --protocol ${proto}` };
        }
      });
      editor.add({
        name: 'test',
        description: 'Run E2E tests',
        input: { type: 'object', properties: { dir: { type: 'string' } }, additionalProperties: false },
        options: { namespace: 'panda', codemode: true },
        execute: async () => ({ content: 'run: WiraXplore test' })
      });
    });

    // register MCP server if supported
    try {
      await (ctx as any).mcp?.register?.({ name: 'WiraXplore', command: ['WiraXplore', 'mcp'] });
    } catch {}

    await ctx.command.transform((editor: any) => {
      editor.add({
        name: 'panda-status',
        description: 'Show WiraXplore status',
        execute: async ({ sessionID, prompt, delivery }: any) => {
          await ctx.session.prompt({ ...prompt, sessionID, text: 'WiraXplore status: run `WiraXplore status`', delivery });
        }
      });
    });

    return () => {};
  }
});
