# Command Code integration

Command Code (and any MCP-capable agent) can use WiraXplore via its MCP server.

Start the MCP server:
  WiraXplore mcp

Add to your agent MCP config:
{
  "mcpServers": {
    "WiraXplore": {
      "command": "WiraXplore",
      "args": ["mcp"]
    }
  }
}

Tools exposed: panda_status, panda_serve_start, panda_serve_stop, panda_navigate,
panda_extract, panda_click, panda_fill, panda_eval.
