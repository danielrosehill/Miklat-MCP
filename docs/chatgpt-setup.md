# Using Miklat MCP with ChatGPT

ChatGPT supports connecting to remote MCP servers via **Developer Mode**. Since Miklat MCP is deployed as a public Cloudflare Worker with streamable HTTP transport, it works directly with ChatGPT — no tunneling or local setup required.

## Requirements

- ChatGPT **Pro**, **Plus**, **Business**, **Enterprise**, or **Education** account
- Web browser (Developer Mode is available on the web client)

## Setup Steps

1. Open **ChatGPT** in your browser
2. Go to **Settings > Apps**
3. Under **Advanced settings**, enable **Developer Mode**
4. Click **"Create app"**
5. Enter the MCP server URL:
   ```
   https://mcp.jlmshelters.com/mcp
   ```
6. Set authentication to **No Authentication** (this is a public server)
7. Click **Save** — ChatGPT will fetch the available tools automatically

The Miklat MCP app will now appear in the composer under "Developer Mode" tools when you start a new conversation.

## Available Tools

Once connected, ChatGPT will have access to these tools:

| Tool | What it does |
|------|-------------|
| `search_shelters` | Free-text search by name, address, or neighborhood |
| `find_nearest_shelters` | Find closest shelters to a given lat/lng |
| `list_neighborhoods` | List all neighborhoods with shelter counts |
| `get_shelter_by_id` | Get full details for a specific shelter |
| `get_stats` | Summary statistics (counts, capacity, types) |
| `list_cities` | List supported cities |
| `get_directions_link` | Google Maps / Waze navigation links to a shelter |
| `filter_shelters` | Filter by type, capacity, accessibility |
| `list_shelters_in_neighborhood` | List all shelters in a neighborhood |

## Example Prompts

Once the MCP is connected, try these prompts in ChatGPT:

- *"Find shelters near the Old City of Jerusalem"*
- *"What accessible shelters are available in Baka?"*
- *"Show me the 3 nearest shelters to latitude 31.77, longitude 35.21"*
- *"How many shelters are there in Jerusalem and what's the total capacity?"*
- *"Give me directions to shelter 15 from my current location at 31.76, 35.22"*
- *"List all neighborhoods in Jerusalem that have public shelters"*

## Tips

- **Be specific with the city name.** Currently only `jerusalem` is supported. ChatGPT will pass this parameter automatically if you mention Jerusalem in your prompt.
- **Provide coordinates for location-based queries.** ChatGPT does not have access to your GPS location, so you'll need to provide latitude/longitude or describe a known location.
- **Refresh tools if the server is updated.** Go to Settings > Apps, find the Miklat MCP app, and click the refresh button to pull updated tool definitions.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tools not appearing | Verify the URL is exactly `https://mcp.jlmshelters.com/mcp` and refresh |
| "Server not reachable" | Check https://mcp.jlmshelters.com/health for server status |
| ChatGPT not using the tools | Be explicit in your prompt, e.g. *"Use the Miklat MCP to find shelters in Baka, Jerusalem"* |

---

# Using Miklat MCP with Other AI Tools

Miklat MCP uses the standard **Model Context Protocol** with streamable HTTP transport, making it compatible with any MCP client. Below are suggested platforms and use cases, particularly those that can combine **live geolocation** with natural language shelter queries.

## Claude (Anthropic)

**Setup:** Add as a remote MCP server in Claude Desktop, Claude Code, or any Claude-powered application.

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

**Use case:** Natural language queries like *"Find the nearest shelter to my office in Rehavia"* — Claude can call `search_shelters` or `find_nearest_shelters` and present results conversationally.

## Cursor / Windsurf / VS Code with MCP Extensions

**Setup:** Add the MCP endpoint in your editor's MCP configuration.

**Use case:** Developers building shelter-related applications can query the live dataset directly from their IDE. Useful for testing, prototyping, or building frontends that consume shelter data.

## Custom AI Agents & Chatbots

Any agent framework that supports MCP tool use can integrate Miklat MCP:

- **LangChain / LangGraph** — Use an MCP tool adapter to give your agent shelter search capabilities
- **CrewAI** — Add as a tool for emergency-preparedness research agents
- **AutoGen** — Include in multi-agent workflows that handle location-aware queries

**Use case:** Build a Telegram/WhatsApp bot that accepts a shared location and responds with the nearest shelters and navigation links.

## Mobile Apps with Geolocation

The most powerful use case combines a user's **live GPS coordinates** with the `find_nearest_shelters` and `get_directions_link` tools:

1. App obtains user's location via GPS
2. Sends coordinates to an AI agent with Miklat MCP connected
3. Agent calls `find_nearest_shelters` with the user's lat/lng
4. Agent calls `get_directions_link` to generate walking navigation
5. User receives shelter info + one-tap navigation link

This pattern works for:
- **Emergency alert apps** that push shelter locations during sirens
- **Accessibility-focused apps** that filter for accessible shelters only (`filter_shelters` with `accessible: true`)
- **Tourist/visitor apps** that help newcomers find shelters in unfamiliar neighborhoods

## Voice Assistants

MCP-enabled voice interfaces could allow hands-free shelter lookup:

- *"Hey, where's the nearest shelter?"*
- The assistant obtains location from the device, queries `find_nearest_shelters`, and reads back the result with walking distance

## Integration Architecture

```
User Device (GPS) ──> AI Agent / Chatbot ──> Miklat MCP Server
                                                   │
                                              Shelter Data
                                            (GeoJSON on CF)
                                                   │
                                          ┌────────┴────────┐
                                          │  Tool Response   │
                                          │  + Navigation    │
                                          │  Links (GMaps/   │
                                          │  Waze)           │
                                          └─────────────────┘
```

## Data Disclaimer

Shelter data served by this MCP is gathered periodically from official sources and is provided for informational purposes only. No guarantee is offered as to its accuracy or completeness. Always verify shelter locations with official municipal sources and follow instructions from local authorities during emergencies.
