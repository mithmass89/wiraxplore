// plugins/opencode/src/index.ts
import { Plugin } from '@opencode/plugin';

export default Plugin.define({
  id: 'webnix',
  async setup(ctx) {
    await ctx.storage.set('loaded', true);
    await ctx.tool.namespace({ name: 'panda', description: 'Webnix testing helpers' });

    await ctx.tool.transform((editor: any) => {
      editor.add({
        name: 'status',
        description: 'Show webnix / Lightpanda status',
        input: { type: 'object', properties: {}, additionalProperties: false },
        options: { namespace: 'panda', codemode: true },
        execute: async () => ({ content: 'webnix ready. Run `webnix status` for details.' })
      });
      editor.add({
        name: 'serve',
        description: 'Start Lightpanda serve (detached)',
        input: { type: 'object', properties: { protocol: { type: 'string' } }, additionalProperties: false },
        options: { namespace: 'panda', codemode: true },
        execute: async (input: any) => {
          const proto = input?.protocol ?? 'cdp';
          return { content: `run: webnix serve --protocol ${proto}` };
        }
      });
      editor.add({
        name: 'test',
        description: 'Run E2E tests',
        input: { type: 'object', properties: { dir: { type: 'string' } }, additionalProperties: false },
        options: { namespace: 'panda', codemode: true },
        execute: async () => ({ content: 'run: webnix test' })
      });
    });

    // register MCP server if supported
    try {
      await (ctx as any).mcp?.register?.({ name: 'webnix', command: ['webnix', 'mcp'] });
    } catch {}

    await ctx.command.transform((editor: any) => {
      editor.add({
        name: 'panda-status',
        description: 'Show webnix status',
        execute: async ({ sessionID, prompt, delivery }: any) => {
          await ctx.session.prompt({ ...prompt, sessionID, text: 'webnix status: run `webnix status`', delivery });
        }
      });
    });

    return () => {};
  }
});
