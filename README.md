# @pipeworx/wiktionary

Wiktionary MCP — multilingual dictionary content via the MediaWiki REST API. ~6M entries across hundreds of languages. No auth.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `definition(word, lang?)` — parsed definitions grouped by language section (uses Wikimedia's `rest_v1/page/definition`)
- `summary(word, lang?)` — page summary
- `search(query, lang?, limit?)` — title-prefix + fulltext search
- `etymology(word, lang?)` — extracts the Etymology section
- `pronunciations(word, lang?)` — extracts IPA pronunciation rows

## Languages

`lang` is the Wiktionary subdomain code: `en` (default), `fr`, `de`, `ja`, `zh`, `es`, ...

## Data source

- `https://<lang>.wiktionary.org/api/rest_v1/`
- `https://<lang>.wiktionary.org/w/api.php` (for search + wikitext extraction)

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "wiktionary": {
      "url": "https://gateway.pipeworx.io/wiktionary/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Wiktionary data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
