<p align="center">
  <img src="images/logo.png" alt="Miklat MCP" width="500">
</p>

# Miklat MCP

An MCP (Model Context Protocol) server that helps AI agents find public shelters (miklatim tziburim) in Israel. Currently supports Jerusalem with 198 shelters.

## MCP Endpoint

```
https://mcp.jlmshelters.com/mcp
```

Connect to this URL using any MCP-compatible client with streamable HTTP transport.

## Available Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `search_shelters` | `city`, `query`, `limit?` | Free-text search across name, address, neighborhood |
| `find_nearest_shelters` | `city`, `latitude`, `longitude`, `limit?` | Find nearest shelters by distance |
| `list_neighborhoods` | `city` | List all neighborhoods with shelter counts |
| `get_shelter_by_id` | `city`, `id` | Get a single shelter by its feature ID |
| `get_stats` | `city` | Summary stats: total count, breakdown by type, capacity totals |
| `list_cities` | *(none)* | List all supported cities |

### Supported Cities

- `jerusalem` — 198 public shelters

## Adding New Cities

Place a GeoJSON file at `src/data/<city>/shelters.json` following the same schema as the Jerusalem data, then register it in the `cityData` map in `src/index.ts`.

## Development

```bash
npm install
npm run dev          # Start local dev server at http://localhost:8787
npm run deploy       # Deploy to Cloudflare Workers
```

### Testing

```bash
npx @anthropic-ai/mcp-inspector
# Point it at http://localhost:8787/mcp
```

## Cloudflare Configuration

The parent domain `jlmshelters.com` has a WAF custom rule ("Israel Only") that blocks non-Israeli traffic. The MCP subdomain is excluded so it can be accessed globally:

```
(ip.src.country ne "IL" and http.host ne "mcp.jlmshelters.com")
```

## Data Source

Shelter data is sourced from the [JLM-Shelters-Dot-Com](https://github.com/danielrosehill/JLM-Shelters-Dot-Com) project. Licensed under ODbL (Open Database License).

## Disclaimer

This tool is provided for informational purposes only. **Do not rely on this data for personal safety or emergency preparedness.** Always verify shelter locations with official municipal sources and follow instructions from local authorities during emergencies.
