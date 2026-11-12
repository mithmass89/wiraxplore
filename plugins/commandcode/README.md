# Command Code integration

Command Code speaks MCP, so WiraXplore plugs in as an MCP server. There is also a
skill so the agent knows how to use it.

## 1. Register the MCP server

From the project that contains your app:

```bash
cmd mcp add wiraxplore -- wiraxplore mcp
```

Local checkout, without publishing:

```bash
cmd mcp add wiraxplore -- node "D:/path/to/wiraxplore/bin/wiraxplore.js" mcp
```

`wiraxplore plugin:commandcode` prints the exact local command for you.

Verify:

```bash
cmd mcp list
cmd mcp get wiraxplore
```

Inside a session, `/mcp` shows the connection and the `panda_*` tools.

## 2. Install the skill

```bash
mkdir -p ~/.commandcode/skills/wiraxplore
cp skills/wiraxplore/SKILL.md ~/.commandcode/skills/wiraxplore/SKILL.md
```

Or, for one project only, copy it to `.commandcode/skills/wiraxplore/SKILL.md`.

Command Code picks up `.agents/skills/` too, so the same file works there.

## 3. Tools exposed

| tool | purpose |
| --- | --- |
| `panda_status` | platform, engine, Lightpanda binary, CDP probe |
| `panda_serve_start` / `panda_serve_stop` | Lightpanda lifecycle |
| `panda_navigate` | open a URL, return title/URL/text; accepts `engine` |
| `panda_extract` | text or HTML, optionally scoped by selector |
| `panda_click` / `panda_fill` | interaction |
| `panda_eval` | run JavaScript in the page |
| `panda_wait` | wait for a selector |
| `panda_screenshot` | PNG of the page |
| `panda_close` | drop the shared browser session |

Tools keep one shared session; passing `engine` to `panda_navigate` switches it.

## 4. Test an app from the agent

```
Use wiraxplore to check that http://localhost:3000 renders the dashboard,
then screenshot it.
```

The agent calls `panda_navigate`, `panda_extract` and `panda_screenshot`. If the
app needs real rendering (charts, canvas), tell it to pass `engine: "playwright"`.
