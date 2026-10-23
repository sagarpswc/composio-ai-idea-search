import { readFile } from "node:fs/promises";
import path from "node:path";

const CACHE_FILE = path.join(process.cwd(), ".data", "composio-cache.json");

export type ComposioSuggestion = {
  slug: string;
  name: string;
  score: number;
  scopeCount: number;
  scopes: string[];
  toolsCount: number;
  actions: { slug: string; name: string; score: number }[];
  minimalCode: string;
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function collectScopes(authConfigDetails: unknown): string[] {
  const scopes = new Set<string>();

  if (!Array.isArray(authConfigDetails)) return [];

  for (const config of authConfigDetails) {
    if (!config || typeof config !== "object") continue;
    const required = (config as { requiredScopes?: unknown }).requiredScopes;
    if (Array.isArray(required)) {
      for (const scope of required) {
        if (typeof scope === "string" && scope.trim()) scopes.add(scope.trim());
      }
    }

    const fields = (config as { fields?: { authConfigCreation?: { optional?: unknown[]; required?: unknown[] } } }).fields;
    for (const group of [fields?.authConfigCreation?.optional, fields?.authConfigCreation?.required]) {
      if (!Array.isArray(group)) continue;
      for (const field of group) {
        if (!field || typeof field !== "object") continue;
        const name = (field as { name?: unknown }).name;
        const defaultValue = (field as { default?: unknown }).default;
        if (typeof name === "string" && name.toLowerCase().includes("scope") && typeof defaultValue === "string") {
          for (const scope of defaultValue.split(/[,\s]+/)) {
            if (scope.trim()) scopes.add(scope.trim());
          }
        }
      }
    }
  }

  return [...scopes];
}

export async function suggestComposioCombinations(
  requirement: string,
  limit = 10
): Promise<ComposioSuggestion[]> {
  const tokens = tokenize(requirement);
  if (tokens.length === 0) return [];

  let cache: { toolkits?: Record<string, { value?: any }>; tools?: Record<string, { value?: any[] }> } = {};
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    return [];
  }

  const suggestions: ComposioSuggestion[] = [];

  for (const [slug, entry] of Object.entries(cache.toolkits ?? {})) {
    const toolkit = entry?.value;
    if (!toolkit) continue;

    const scopes = collectScopes(toolkit.authConfigDetails);
    const actions = cache.tools?.[slug]?.value ?? [];
    const actionMatches = actions
      .map((action) => {
        const text = `${action.name ?? ""} ${action.description ?? ""} ${action.slug ?? ""}`.toLowerCase();
        const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
        return { slug: action.slug, name: action.name, score };
      })
      .filter((action) => action.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const toolkitText = [
      toolkit.name,
      toolkit.description,
      ...(toolkit.categories ?? []),
      ...scopes,
      ...actions.map((action) => `${action.name} ${action.description}`),
    ]
      .join(" ")
      .toLowerCase();

    const score = tokens.reduce((sum, token) => sum + (toolkitText.includes(token) ? 1 : 0), 0);
    if (score === 0 && actionMatches.length === 0) continue;

    const bestAction = actionMatches[0]?.slug ?? actions[0]?.slug ?? `${slug.toUpperCase()}_...`;
    suggestions.push({
      slug,
      name: toolkit.name,
      score: score + actionMatches.reduce((sum, action) => sum + action.score, 0),
      scopeCount: scopes.length,
      scopes,
      toolsCount: toolkit.toolsCount ?? actions.length,
      actions: actionMatches,
      minimalCode: `const result = await session.execute("${bestAction}", { /* minimal args */ });`,
    });
  }

  return suggestions
    .sort((a, b) => b.score - a.score || a.scopeCount - b.scopeCount || b.toolsCount - a.toolsCount)
    .slice(0, limit);
}