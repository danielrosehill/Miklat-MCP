import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import jerusalemData from "./data/jerusalem/shelters.json";

// --- Types ---

interface ShelterProperties {
  name: string;
  neighborhood: string;
  address: string;
  shelterType: string;
  capacity: number;
  accessible: boolean;
  mapAddress: string;
}

interface ShelterFeature {
  type: "Feature";
  id: number;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: ShelterProperties;
}

interface ShelterCollection {
  type: "FeatureCollection";
  features: ShelterFeature[];
}

// --- City registry ---

const cityData: Record<string, ShelterCollection> = {
  jerusalem: jerusalemData as unknown as ShelterCollection,
};

const SUPPORTED_CITIES = Object.keys(cityData);

function getCityData(city: string): ShelterCollection | null {
  return cityData[city.toLowerCase()] ?? null;
}

// --- Helpers ---

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatShelter(f: ShelterFeature, extra?: string): string {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  let text = `**${p.name}** (ID: ${f.id})
Address: ${p.address}
Neighborhood: ${p.neighborhood}
Type: ${p.shelterType}
Capacity: ${p.capacity}
Accessible: ${p.accessible ? "Yes" : "No"}
Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  if (extra) text += `\n${extra}`;
  return text;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function cityNotFound(city: string) {
  return textResult(
    `City "${city}" is not supported. Available cities: ${SUPPORTED_CITIES.join(", ")}`
  );
}

// --- MCP Agent ---

export class MiklatMCP extends McpAgent<Env, {}, {}> {
  server = new McpServer({
    name: "Miklat MCP",
    version: "1.0.0",
  });

  async init() {
    // --- search_shelters ---
    this.server.tool(
      "search_shelters",
      "Free-text search across shelter name, address, and neighborhood",
      {
        city: z
          .string()
          .describe(
            `City to search in. Supported: ${SUPPORTED_CITIES.join(", ")}`
          ),
        query: z.string().describe("Search text"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max results to return (default 10)"),
      },
      async ({ city, query, limit }) => {
        const data = getCityData(city);
        if (!data) return cityNotFound(city);

        const q = query.toLowerCase();
        const max = limit ?? 10;
        const matches = data.features
          .filter((f) => {
            const p = f.properties;
            return (
              p.name.toLowerCase().includes(q) ||
              p.address.toLowerCase().includes(q) ||
              p.neighborhood.toLowerCase().includes(q)
            );
          })
          .slice(0, max);

        if (matches.length === 0) {
          return textResult(`No shelters found matching "${query}" in ${city}.`);
        }

        const lines = matches.map((f) => formatShelter(f));
        return textResult(
          `Found ${matches.length} shelter(s) matching "${query}" in ${city}:\n\n${lines.join("\n\n---\n\n")}`
        );
      }
    );

    // --- find_nearest_shelters ---
    this.server.tool(
      "find_nearest_shelters",
      "Find the nearest shelters to a given latitude/longitude",
      {
        city: z
          .string()
          .describe(
            `City to search in. Supported: ${SUPPORTED_CITIES.join(", ")}`
          ),
        latitude: z.number().describe("Latitude of the location"),
        longitude: z.number().describe("Longitude of the location"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Number of nearest shelters to return (default 5)"),
      },
      async ({ city, latitude, longitude, limit }) => {
        const data = getCityData(city);
        if (!data) return cityNotFound(city);

        const max = limit ?? 5;
        const withDist = data.features.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const dist = haversineKm(latitude, longitude, lat, lng);
          return { feature: f, dist };
        });

        withDist.sort((a, b) => a.dist - b.dist);
        const nearest = withDist.slice(0, max);

        const lines = nearest.map(({ feature, dist }) => {
          const distStr =
            dist < 1
              ? `${Math.round(dist * 1000)}m away`
              : `${dist.toFixed(2)}km away`;
          return formatShelter(feature, `Distance: ${distStr}`);
        });

        return textResult(
          `${nearest.length} nearest shelter(s) in ${city}:\n\n${lines.join("\n\n---\n\n")}`
        );
      }
    );

    // --- list_neighborhoods ---
    this.server.tool(
      "list_neighborhoods",
      "List all neighborhoods that have shelters, with counts",
      {
        city: z
          .string()
          .describe(
            `City to list neighborhoods for. Supported: ${SUPPORTED_CITIES.join(", ")}`
          ),
      },
      async ({ city }) => {
        const data = getCityData(city);
        if (!data) return cityNotFound(city);

        const counts: Record<string, number> = {};
        for (const f of data.features) {
          const n = f.properties.neighborhood;
          counts[n] = (counts[n] || 0) + 1;
        }

        const sorted = Object.entries(counts).sort((a, b) =>
          a[0].localeCompare(b[0])
        );

        const lines = sorted.map(([name, count]) => `- ${name}: ${count}`);
        return textResult(
          `Neighborhoods with shelters in ${city} (${sorted.length} total):\n\n${lines.join("\n")}`
        );
      }
    );

    // --- get_shelter_by_id ---
    this.server.tool(
      "get_shelter_by_id",
      "Get details of a specific shelter by its ID",
      {
        city: z
          .string()
          .describe(
            `City the shelter is in. Supported: ${SUPPORTED_CITIES.join(", ")}`
          ),
        id: z.number().int().describe("Shelter feature ID"),
      },
      async ({ city, id }) => {
        const data = getCityData(city);
        if (!data) return cityNotFound(city);

        const feature = data.features.find((f) => f.id === id);
        if (!feature) {
          return textResult(
            `No shelter with ID ${id} found in ${city}. IDs range from ${data.features[0]?.id} to ${data.features[data.features.length - 1]?.id}.`
          );
        }

        return textResult(formatShelter(feature));
      }
    );

    // --- get_stats ---
    this.server.tool(
      "get_stats",
      "Get summary statistics about shelters: total count, breakdown by type, capacity totals",
      {
        city: z
          .string()
          .describe(
            `City to get stats for. Supported: ${SUPPORTED_CITIES.join(", ")}`
          ),
      },
      async ({ city }) => {
        const data = getCityData(city);
        if (!data) return cityNotFound(city);

        const total = data.features.length;
        let totalCapacity = 0;
        let accessibleCount = 0;
        const byType: Record<string, { count: number; capacity: number }> = {};

        for (const f of data.features) {
          const p = f.properties;
          totalCapacity += p.capacity;
          if (p.accessible) accessibleCount++;
          if (!byType[p.shelterType]) {
            byType[p.shelterType] = { count: 0, capacity: 0 };
          }
          byType[p.shelterType].count++;
          byType[p.shelterType].capacity += p.capacity;
        }

        const typeLines = Object.entries(byType)
          .sort((a, b) => b[1].count - a[1].count)
          .map(
            ([type, { count, capacity }]) =>
              `- ${type}: ${count} shelters, total capacity ${capacity}`
          );

        return textResult(
          `Shelter statistics for ${city}:

Total shelters: ${total}
Total capacity: ${totalCapacity}
Accessible shelters: ${accessibleCount}
Neighborhoods: ${new Set(data.features.map((f) => f.properties.neighborhood)).size}

By type:
${typeLines.join("\n")}`
        );
      }
    );

    // --- list_cities ---
    this.server.tool(
      "list_cities",
      "List all cities with available shelter data",
      {},
      async () => {
        const lines = SUPPORTED_CITIES.map((c) => {
          const data = cityData[c];
          return `- ${c}: ${data.features.length} shelters`;
        });
        return textResult(`Available cities:\n\n${lines.join("\n")}`);
      }
    );
  }
}

// --- Worker entrypoint ---

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      // Route to MCP Durable Object
      const id = env.MCP_OBJECT.idFromName("mcp");
      const stub = env.MCP_OBJECT.get(id);
      return stub.fetch(request);
    }

    // Health / info endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        name: "Miklat MCP",
        version: "1.0.0",
        description:
          "MCP server for finding public shelters (miklatim) in Israel",
        mcp_endpoint: "/mcp",
        supported_cities: SUPPORTED_CITIES,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
