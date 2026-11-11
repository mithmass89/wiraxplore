// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { findLightpanda, binaryVersion } from '../binary.js';
import { loadConfig } from '../config.js';
import { startServer, stopServer, serverStatus } from '../server.js';
import { chromium } from 'playwright-core';
import { log } from '../utils/logger.js';

const cfg = loadConfig(process.cwd());

const tools = [
  {
    name: 'panda_status',
    description: 'Report Lightpanda binary + serve status for this project.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'panda_serve_start',
    description: 'Start Lightpanda CDP server for the project.',
    inputSchema: { type: 'object', properties: { protocol: { type: 'string', enum: ['cdp', 'bidi', 'both'] } }, additionalProperties: false },
  },
  {
    name: 'panda_serve_stop',
    description: 'Stop Lightpanda CDP server.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'panda_navigate',
    description: 'Navigate the browser to a URL and return page title + url.',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string' }, waitUntil: { type: 'string' } },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'panda_extract',
    description: 'Extract text content from the current page (optionally scoped by CSS selector).',
    inputSchema: {
      type: 'object',
      properties: { selector: { type: 'string' } },
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
    description: 'Fill an input by CSS selector.',
    inputSchema: {
      type: 'object',
      properties: { selector: { type: 'string' }, value: { type: 'string' } },
      required: ['selector', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'panda_eval',
    description: 'Evaluate JavaScript in the page and return the result.',
    inputSchema: {
      type: 'object',
      properties: { expression: { type: 'string' } },
      required: ['expression'],
      additionalProperties: false,
    },
  },
];

const server = new Server({ name: 'webnix', version: '0.1.0' }, { capabilities: { tools: {} } });

// persistent browser page across calls
let sessionPromise: Promise<{ browser: any; page: any }> | null = null;
async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const host = cfg.browser?.host ?? '127.0.0.1';
      const port = cfg.browser?.port ?? 9222;
      const browser = await chromium.connectOverCDP(`http://${host}:${port}`);
      const context = browser.contexts()[0] ?? await browser.newContext();
      const page = await context.newPage();
      return { browser, page };
    })();
  }
  return sessionPromise;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

let lock = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = lock;
  let resolveLock!: () => void;
  lock = new Promise<void>((r) => { resolveLock = r; });
  return prev.then(fn).finally(() => resolveLock());
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  return withLock(async () => {
  try {
    if (name === 'panda_status') {
      const bin = findLightpanda();
      const ver = bin ? binaryVersion(bin) : undefined;
      const st = serverStatus();
      return { content: [{ type: 'text', text: JSON.stringify({ binary: bin, version: ver, server: st, config: cfg }, null, 2) }] };
    }
    if (name === 'panda_serve_start') {
      const handle = await startServer(cfg, { protocol: (args.protocol as string) ?? 'cdp' });
      return { content: [{ type: 'text', text: `started pid=${handle.pid} ${handle.host}:${handle.port}` }] };
    }
    if (name === 'panda_serve_stop') {
      const ok = stopServer();
      // reset session
      sessionPromise = null;
      return { content: [{ type: 'text', text: ok ? 'stopped' : 'not running' }] };
    }

    const { page } = await getSession();

    if (name === 'panda_navigate') {
      await page.goto(String(args.url), { waitUntil: (args.waitUntil as any) ?? 'domcontentloaded' });
      return { content: [{ type: 'text', text: JSON.stringify({ url: page.url(), title: await page.title() }) }] };
    }
    if (name === 'panda_extract') {
      const sel = args.selector ? String(args.selector) : null;
      const text = sel ? await page.locator(sel).innerText().catch(() => '') : await page.evaluate('var b=document.body||document.documentElement; b? (b.innerText||"") : ""');
      return { content: [{ type: 'text', text: String(text ?? '') }] };
    }
    if (name === 'panda_click') {
      await page.click(String(args.selector));
      return { content: [{ type: 'text', text: 'clicked' }] };
    }
    if (name === 'panda_fill') {
      await page.fill(String(args.selector), String(args.value));
      return { content: [{ type: 'text', text: 'filled' }] };
    }
    if (name === 'panda_eval') {
      const r = await page.evaluate(String(args.expression));
      return { content: [{ type: 'text', text: JSON.stringify(r) }] };
    }
    return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error(msg);
    return { content: [{ type: 'text', text: msg }], isError: true };
  }
  });
});

export async function runMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on('exit', () => { /* best effort */ });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMcpServer().catch((e) => { console.error(e); process.exit(1); });
}
