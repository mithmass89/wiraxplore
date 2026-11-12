// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { findLightpanda, binaryVersion } from '../binary.js';
import { loadConfig } from '../config.js';
import { startServer, stopServer, statusWithProbe } from '../server.js';
import { engineOptions, launchSession, planEngine, resolveExecutable, ENGINE_NAMES, type BrowserSession } from '../adapters/engine.js';
import { log } from '../utils/logger.js';
import { pathToFileURL } from 'node:url';

const cfg = loadConfig(process.cwd());

const engineProp = { type: 'string', enum: ENGINE_NAMES };

const tools = [
  {
    name: 'panda_status',
    description: 'Report platform, configured browser engine, engine readiness, and server status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'panda_serve_start',
    description: 'Start the Lightpanda CDP server for this project.',
    inputSchema: {
      type: 'object',
      properties: { protocol: { type: 'string', enum: ['cdp', 'bidi', 'both'] } },
      additionalProperties: false,
    },
  },
  {
    name: 'panda_serve_stop',
    description: 'Stop the Lightpanda CDP server.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'panda_navigate',
    description: 'Open a URL and return the page title, final URL and visible text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'] },
        engine: engineProp,
        includeText: { type: 'boolean', description: 'Include visible body text (default true).' },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'panda_extract',
    description: 'Read text or HTML from the current page, optionally scoped by a CSS selector.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        format: { type: 'string', enum: ['text', 'html'] },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'panda_click',
    description: 'Click an element by CSS selector.',
    inputSchema: {
      type: 'object',
      properties: { selector: { type: 'string' } },
      required: ['selector'],
      additionalProperties: false,
    },
  },
  {
    name: 'panda_fill',
    description: 'Type a value into an input by CSS selector.',
    inputSchema: {
      type: 'object',
      properties: { selector: { type: 'string' }, value: { type: 'string' } },
      required: ['selector', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'panda_eval',
    description: 'Evaluate a JavaScript expression in the page and return the result.',
    inputSchema: {
      type: 'object',
      properties: { expression: { type: 'string' } },
      required: ['expression'],
      additionalProperties: false,
    },
  },
  {
    name: 'panda_wait',
    description: 'Wait until a CSS selector is present (or hidden) on the current page.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        state: { type: 'string', enum: ['attached', 'visible', 'hidden', 'detached'] },
        timeoutMs: { type: 'number' },
      },
      required: ['selector'],
      additionalProperties: false,
    },
  },
  {
    name: 'panda_screenshot',
    description: 'Capture a PNG screenshot of the current page and return it as an image.',
    inputSchema: {
      type: 'object',
      properties: { fullPage: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
  {
    name: 'panda_close',
    description: 'Close the shared browser session (reconnects on the next tool call).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

const server = new Server({ name: 'wiraxplore', version: '0.2.0' }, { capabilities: { tools: {} } });

let sessionPromise: Promise<BrowserSession> | null = null;
let sessionEngine: string | undefined;

async function getSession(engine?: string): Promise<BrowserSession> {
  if (sessionPromise && engine && sessionEngine && engine !== sessionEngine) {
    await resetSession();
  }
  if (!sessionPromise) {
    sessionEngine = planEngine(cfg, { engine }).engine;
    sessionPromise = launchSession(engineOptions(cfg, { engine })).catch((e) => {
      sessionPromise = null;
      sessionEngine = undefined;
      throw e;
    });
  }
  return sessionPromise;
}

async function resetSession(): Promise<void> {
  const current = sessionPromise;
  sessionPromise = null;
  sessionEngine = undefined;
  if (!current) return;
  try { const s = await current; await s.close(); } catch {}
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}

function text(value: string) {
  return { content: [{ type: 'text' as const, text: value }] };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  return withLock(async () => {
    try {
      if (name === 'panda_status') {
        const plan = planEngine(cfg);
        const bin = findLightpanda();
        const exe = plan.mode === 'launch' ? resolveExecutable({ executablePath: cfg.browser?.executablePath, channel: cfg.browser?.channel }) : undefined;
        const st = await statusWithProbe();
        return text(JSON.stringify({
          engine: plan.engine,
          driver: plan.driver,
          mode: plan.mode,
          cdpUrl: plan.cdpUrl,
          executablePath: exe ?? null,
          lightpanda: bin ? { path: bin.path, source: bin.source, version: binaryVersion(bin) } : null,
          server: st,
        }, null, 2));
      }

      if (name === 'panda_serve_start') {
        const handle = await startServer(cfg, { protocol: (args.protocol as string) ?? 'cdp' });
        return text(`started pid=${handle.pid} ${handle.host}:${handle.port}`);
      }

      if (name === 'panda_serve_stop') {
        const ok = stopServer();
        await resetSession();
        return text(ok ? 'stopped' : 'not running');
      }

      if (name === 'panda_close') {
        await resetSession();
        return text('session closed');
      }

      const session = await getSession(args.engine as string | undefined);
      const page = session.page;

      if (name === 'panda_navigate') {
        await page.goto(String(args.url), {
          waitUntil: (args.waitUntil as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2') ?? 'domcontentloaded',
        });
        const includeText = args.includeText !== false;
        const bodyText = includeText ? await page.eval<string>('document.body ? document.body.innerText : ""').catch(() => '') : undefined;
        return text(JSON.stringify({
          url: page.url(),
          title: await page.title(),
          engine: session.engine,
          ...(includeText ? { text: String(bodyText ?? '').slice(0, 8000) } : {}),
        }, null, 2));
      }

      if (name === 'panda_extract') {
        const sel = args.selector ? String(args.selector) : undefined;
        const format = args.format === 'html' ? 'html' : 'text';
        const value = format === 'html'
          ? await page.html(sel)
          : sel
            ? await page.text(sel)
            : await page.eval<string>('document.body ? document.body.innerText : ""');
        return text(String(value ?? ''));
      }

      if (name === 'panda_click') {
        await page.click(String(args.selector));
        return text('clicked');
      }

      if (name === 'panda_fill') {
        await page.fill(String(args.selector), String(args.value));
        return text('filled');
      }

      if (name === 'panda_eval') {
        const result = await page.eval(String(args.expression));
        return text(typeof result === 'string' ? result : JSON.stringify(result));
      }

      if (name === 'panda_wait') {
        await page.waitFor(String(args.selector), {
          timeout: typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined,
          state: args.state as 'attached' | 'visible' | 'hidden' | 'detached' | undefined,
        });
        return text('found');
      }

      if (name === 'panda_screenshot') {
        const shot = await page.screenshot({ fullPage: args.fullPage === true });
        const base64 = typeof shot === 'string' ? shot : Buffer.from(shot).toString('base64');
        return { content: [{ type: 'image' as const, data: base64, mimeType: 'image/png' }] };
      }

      return { content: [{ type: 'text' as const, text: `unknown tool: ${name}` }], isError: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error(msg);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  });
});

export async function runMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = async () => { await resetSession(); };
  process.on('SIGINT', () => { void shutdown().finally(() => process.exit(0)); });
  process.on('SIGTERM', () => { void shutdown().finally(() => process.exit(0)); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMcpServer().catch((e) => { console.error(e); process.exit(1); });
}
