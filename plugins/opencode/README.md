# OpenCode integration

WiraXplore ships an OpenCode plugin (tools + MCP registration) and a skill.

## Install

```bash
wiraxplore plugin:opencode            # default: ~/.config/opencode
wiraxplore plugin:opencode --dir /path/to/opencode-config
```

It does four things:

1. Copies the plugin to `<config>/plugins/wiraxplore`.
2. Pins the CLI command in `wiraxplore.bin.json`, so the plugin never guesses.
3. Copies the skill to `<config>/skills/wiraxplore/SKILL.md`.
4. Registers both the plugin and the MCP server in `opencode.json(c)`.

Restart OpenCode afterwards.

## Version differences

OpenCode changed its plugin API and config keys between releases. The plugin and
installer handle both shapes.

| | OpenCode 1.x (e.g. 1.14.x) | OpenCode 2.x (>= 1.18.29) |
| --- | --- | --- |
| Config key | `"plugin": []` | `"plugins": []` |
| MCP block | `"mcp": { "<name>": {...} }` | `"mcp": { "servers": { "<name>": {...} } }` |
| Entrypoint | package export `./server` returning `{ tool, mcp }` | package export `./v2`, `Plugin.define({ id, setup })` |

`wiraxplore plugin:opencode` detects which keys your config already uses and
inserts into the right place. It reports what it did:

```
✓ registered "./plugins/wiraxplore" under "plugin" in .../opencode.json
✓ MCP server "wiraxplore" registered under "mcp"
```

If the plugin was already present, it says so instead of adding a duplicate.

## Verify

```bash
opencode mcp list        # wiraxplore should show ✓ connected
```

The plugin exposes three tools:

| tool | purpose |
| --- | --- |
| `panda_status` | engine, Lightpanda binary, CDP readiness (`doctor --json`) |
| `panda_test` | run the E2E suite, optional `engine` and `filter` |
| `panda_server` | `start` / `stop` / `status` the Lightpanda server |

The full browser surface (`panda_navigate`, `panda_click`, `panda_screenshot`,
…) comes from the MCP server, which exposes eleven tools.

## Manual setup

If you prefer to wire it by hand, add to `opencode.json`:

```json
{
  "plugin": ["./plugins/wiraxplore"],
  "mcp": {
    "wiraxplore": {
      "type": "local",
      "command": ["npx", "-y", "wiraxplore", "mcp"]
    }
  }
}
```

For OpenCode 2.x, use `"plugins"` and nest the server under `"mcp": { "servers": { ... } }`.

## Troubleshooting

- **`Plugin does not expose a server entrypoint`** — the installed copy is missing
  `src/server.ts`. Re-run `wiraxplore plugin:opencode`.
- **Plugin loaded but no tools** — check `wiraxplore.bin.json` points at an
  existing `wiraxplore.js`; otherwise the plugin falls back to `npx -y wiraxplore`.
- **MCP shows failed** — run the command from `opencode mcp list` manually; a
  missing Lightpanda binary only breaks the `lightpanda` engine, not the MCP server.
