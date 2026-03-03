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

// --- Disclaimer ---

const DISCLAIMER =
  "\n\n---\n_Disclaimer: This data is gathered periodically from official sources and is provided for informational purposes only. No guarantee is offered as to its accuracy or completeness. Always verify shelter locations with official municipal sources and follow instructions from local authorities during emergencies._";

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
          `Found ${matches.length} shelter(s) matching "${query}" in ${city}:\n\n${lines.join("\n\n---\n\n")}${DISCLAIMER}`
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
          `${nearest.length} nearest shelter(s) in ${city}:\n\n${lines.join("\n\n---\n\n")}${DISCLAIMER}`
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

        return textResult(formatShelter(feature) + DISCLAIMER);
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
${typeLines.join("\n")}${DISCLAIMER}`
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

    // --- get_directions_link ---
    this.server.tool(
      "get_directions_link",
      "Generate Google Maps and/or Waze navigation links from your current location to a shelter",
      {
        city: z
          .string()
          .describe(
            `City the shelter is in. Supported: ${SUPPORTED_CITIES.join(", ")}`
          ),
        shelter_id: z.number().int().describe("Shelter feature ID"),
        origin_latitude: z.number().describe("Your current latitude"),
        origin_longitude: z.number().describe("Your current longitude"),
        app: z
          .enum(["google_maps", "waze", "both"])
          .optional()
          .describe(
            'Which navigation app links to generate (default "both")'
          ),
      },
      async ({ city, shelter_id, origin_latitude, origin_longitude, app }) => {
        const data = getCityData(city);
        if (!data) return cityNotFound(city);

        const feature = data.features.find((f) => f.id === shelter_id);
        if (!feature) {
          return textResult(
            `No shelter with ID ${shelter_id} found in ${city}. IDs range from ${data.features[0]?.id} to ${data.features[data.features.length - 1]?.id}.`
          );
        }

        const [lng, lat] = feature.geometry.coordinates;
        const dist = haversineKm(origin_latitude, origin_longitude, lat, lng);
        const distStr =
          dist < 1
            ? `${Math.round(dist * 1000)}m`
            : `${dist.toFixed(2)}km`;

        const navApp = app ?? "both";
        const links: string[] = [];

        if (navApp === "google_maps" || navApp === "both") {
          links.push(
            `Google Maps: https://www.google.com/maps/dir/?api=1&origin=${origin_latitude},${origin_longitude}&destination=${lat},${lng}&travelmode=walking`
          );
        }
        if (navApp === "waze" || navApp === "both") {
          links.push(`Waze: https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
        }

        return textResult(
          `Directions to **${feature.properties.name}** (ID: ${feature.id})
Address: ${feature.properties.address}
Walking distance: ~${distStr}

${links.join("\n")}${DISCLAIMER}`
        );
      }
    );

    // --- filter_shelters ---
    this.server.tool(
      "filter_shelters",
      "Filter shelters by type, minimum capacity, and/or accessibility",
      {
        city: z
          .string()
          .describe(
            `City to filter in. Supported: ${SUPPORTED_CITIES.join(", ")}`
          ),
        shelter_type: z
          .string()
          .optional()
          .describe(
            'Filter by shelter type, e.g. "Public Shelter", "Protected Parking"'
          ),
        min_capacity: z
          .number()
          .int()
          .optional()
          .describe("Minimum capacity (shelters with null capacity are excluded)"),
        accessible: z
          .boolean()
          .optional()
          .describe("Filter to only accessible shelters"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max results to return (default 20)"),
      },
      async ({ city, shelter_type, min_capacity, accessible, limit }) => {
        const data = getCityData(city);
        if (!data) return cityNotFound(city);

        const max = limit ?? 20;
        const matches = data.features.filter((f) => {
          const p = f.properties;
          if (shelter_type && p.shelterType !== shelter_type) return false;
          if (min_capacity != null) {
            if (p.capacity == null || p.capacity < min_capacity) return false;
          }
          if (accessible != null && p.accessible !== accessible) return false;
          return true;
        });

        if (matches.length === 0) {
          return textResult(`No shelters match the given filters in ${city}.`);
        }

        const results = matches.slice(0, max);
        const lines = results.map((f) => formatShelter(f));

        return textResult(
          `Found ${matches.length} shelter(s) matching filters in ${city} (showing ${results.length}):\n\n${lines.join("\n\n---\n\n")}${DISCLAIMER}`
        );
      }
    );

    // --- list_shelters_in_neighborhood ---
    this.server.tool(
      "list_shelters_in_neighborhood",
      "Get all shelters in a specific neighborhood with full details",
      {
        city: z
          .string()
          .describe(
            `City to search in. Supported: ${SUPPORTED_CITIES.join(", ")}`
          ),
        neighborhood: z.string().describe("Neighborhood name"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Max results to return (default 20)"),
      },
      async ({ city, neighborhood, limit }) => {
        const data = getCityData(city);
        if (!data) return cityNotFound(city);

        const max = limit ?? 20;
        const matches = data.features.filter(
          (f) =>
            f.properties.neighborhood.toLowerCase() ===
            neighborhood.toLowerCase()
        );

        if (matches.length === 0) {
          return textResult(
            `No shelters found in neighborhood "${neighborhood}" in ${city}. Use the list_neighborhoods tool to see available neighborhoods.`
          );
        }

        const results = matches.slice(0, max);
        const lines = results.map((f) => formatShelter(f));

        return textResult(
          `${matches.length} shelter(s) in ${neighborhood}, ${city} (showing ${results.length}):\n\n${lines.join("\n\n---\n\n")}${DISCLAIMER}`
        );
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
