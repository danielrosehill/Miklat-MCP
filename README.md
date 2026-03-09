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

### Client Configuration

Add this to your MCP client config (e.g. Claude Desktop, Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "miklat": {
      "type": "streamableHttp",
      "url": "https://mcp.jlmshelters.com/mcp"
    }
  }
}
```

For ChatGPT and other platform-specific setup, see the [Integration Guide](docs/chatgpt-setup.md).

## Available Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `search_shelters` | `city`, `query`, `limit?` | Free-text search across name, address, neighborhood |
| `find_nearest_shelters` | `city`, `latitude`, `longitude`, `limit?` | Find nearest shelters by distance |
| `list_neighborhoods` | `city` | List all neighborhoods with shelter counts |
| `get_shelter_by_id` | `city`, `id` | Get a single shelter by its feature ID |
| `get_stats` | `city` | Summary stats: total count, breakdown by type, capacity totals |
| `list_cities` | *(none)* | List all supported cities |
| `get_directions_link` | `city`, `shelter_id`, `origin_latitude`, `origin_longitude`, `app?` | Google Maps / Waze navigation links to a shelter |
| `filter_shelters` | `city`, `shelter_type?`, `min_capacity?`, `accessible?`, `limit?` | Filter shelters by type, capacity, accessibility |
| `list_shelters_in_neighborhood` | `city`, `neighborhood`, `limit?` | List all shelters in a specific neighborhood |

### Supported Cities

- `jerusalem` — 198 public shelters

## Adding New Cities

To contribute shelter data for a new city, submit a pull request to the upstream [Miklat-MCP-Data](https://github.com/danielrosehill/Miklat-MCP-Data) repository with a GeoJSON file at `data/<city>/shelters.json` following the documented schema.

For MCP server development: place the GeoJSON file at `src/data/<city>/shelters.json` and register it in the `cityData` map in `src/index.ts`.

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

Shelter geodata is maintained in the [Miklat-MCP-Data](https://github.com/danielrosehill/Miklat-MCP-Data) repository, which serves as the upstream data source for this MCP server. Data is periodically pulled from that repository and integrated here.

**Want to contribute shelter data?** Submit a pull request to [Miklat-MCP-Data](https://github.com/danielrosehill/Miklat-MCP-Data) with new or corrected shelter locations. See the contributing guidelines there for the required GeoJSON schema and data quality standards.

Original Jerusalem data sourced from the [JLM-Shelters-Dot-Com](https://github.com/danielrosehill/JLM-Shelters-Dot-Com) project. Licensed under ODbL (Open Database License).

## Disclaimer

This tool is provided for informational purposes only. Shelter data is gathered **periodically** from official sources and **no guarantee is offered as to its accuracy or completeness**. Shelters may be added, removed, or changed between updates. **Do not rely solely on this data for personal safety or emergency preparedness.** Always verify shelter locations with official municipal sources and follow instructions from local authorities during emergencies.

All MCP tool responses include a short disclaimer reminding users of these limitations.
