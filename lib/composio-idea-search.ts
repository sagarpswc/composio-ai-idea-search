import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateLlmSteps } from "@/lib/llm-settings";

const CACHE_FILE = path.join(process.cwd(), ".data", "composio-cache.json");

export type IdeaAction = {
  slug: string;
  name: string;
  score: number;
};

export type IdeaApp = {
  slug: string;
  name: string;
  score: number;
  scopeCount: number;
  scopes: string[];
  actions: IdeaAction[];
};

export type IdeaCombination = {
  rank: number;
  score: number;
  totalScopes: number;
  apps: IdeaApp[];
  steps: string[];
};

const STOP_WORDS = new Set(["and", "the", "for", "with", "from", "into", "using", "then", "that", "this"]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
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

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const result: T[][] = [];
  for (let index = 0; index <= items.length - size; index += 1) {
    const rest = combinations(items.slice(index + 1), size - 1);
    for (const item of rest) {
      result.push([items[index], ...item]);
    }
  }
  return result;
}

export async function searchComposioIdeas(requirement: string, limit = 8): Promise<{
  requirement: string;
  combinations: IdeaCombination[];
  candidates: IdeaApp[];
}> {
  const tokens = tokenize(requirement);
  if (tokens.length === 0) {
    return { requirement, combinations: [], candidates: [] };
  }

  let cache: { toolkits?: Record<string, { value?: any }>; tools?: Record<string, { value?: any[] }> } = {};
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    return { requirement, combinations: [], candidates: [] };
  }

  const candidates: IdeaApp[] = [];

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
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 4);

    const toolkitText = [
      toolkit.name,
      toolkit.description,
      ...(toolkit.categories ?? []),
      ...scopes,
      ...actions.map((action) => `${action.name} ${action.description}`),
    ]
      .join(" ")
      .toLowerCase();

    const nameBoost = tokens.reduce((sum, token) => {
      const normalized = toolkit.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (normalized === token || slug === token) return sum + 16;
      if (normalized.includes(token) || slug.includes(token)) return sum + 8;
      return sum;
    }, 0);
    const score = tokens.reduce((sum, token) => sum + (toolkitText.includes(token) ? 1 : 0), 0) + nameBoost;
    if (score === 0 && actionMatches.length === 0) continue;

    candidates.push({
      slug,
      name: toolkit.name,
      score: score + actionMatches.reduce((sum, action) => sum + action.score, 0),
      scopeCount: scopes.length,
      scopes,
      actions: actionMatches.length > 0 ? actionMatches : actions.slice(0, 2).map((action) => ({ slug: action.slug, name: action.name, score: 0 })),
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.scopeCount - b.scopeCount || a.name.localeCompare(b.name));
  const topApps = candidates.slice(0, 8);
  const directApps = tokens
    .map((token) => {
      const matches = topApps.filter((app) => {
        const normalized = app.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
        return normalized.includes(token) || app.slug.includes(token);
      });
      return matches.sort((a, b) => {
        const aExact = a.slug === token || a.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === token ? 1 : 0;
        const bExact = b.slug === token || b.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === token ? 1 : 0;
        if (bExact !== aExact) return bExact - aExact;
        if (b.score !== a.score) return b.score - a.score;
        return a.scopeCount - b.scopeCount;
      })[0];
    })
    .filter((app): app is IdeaApp => Boolean(app))
    .filter((app, index, apps) => apps.findIndex((candidate) => candidate.slug === app.slug) === index);
  const requiredApps = directApps;

  const combinationList: IdeaCombination[] = [];
  for (let size = 1; size <= Math.min(3, topApps.length); size += 1) {
    for (const combo of combinations(topApps, size)) {
      if (requiredApps.length > 0 && requiredApps.length <= size && !requiredApps.every((app) => combo.includes(app))) {
        continue;
      }

      const covered = new Set<string>();
      const addsNewCoverage = combo.every((app) => {
        const appTokens = tokens.filter((token) => {
          const text = [app.name, ...app.actions.map((action) => action.name)].join(" ").toLowerCase();
          return text.includes(token);
        });
        const newTokens = appTokens.filter((token) => !covered.has(token));
        if (newTokens.length === 0) return false;
        newTokens.forEach((token) => covered.add(token));
        return true;
      });
      if (!addsNewCoverage) continue;
      const score = combo.reduce((sum, app) => sum + app.score, 0);
      const totalScopes = combo.reduce((sum, app) => sum + app.scopeCount, 0);
      const steps: string[] = [];

      for (const app of combo) {
        steps.push(`Connect ${app.name} if this account does not already have an active connection.`);
        const action = app.actions[0];
        if (action) {
          steps.push(`Run ${action.name} (${action.slug}) for the ${app.name} part of the workflow.`);
        }
        if (app.scopeCount > 0) {
          steps.push(`Review and approve the ${app.scopeCount} requested ${app.name} scopes before connecting.`);
        }
      }

      if (combo.length > 1) {
        steps.push("Chain the tool results in order, passing only the fields needed by the next step.");
      }

      combinationList.push({
        rank: 0,
        score,
        totalScopes,
        apps: combo,
        steps,
      });
    }
  }

  const exactDirectAppCount = (combo: IdeaCombination) =>
    combo.apps.filter((app) =>
      tokens.some((token) => app.slug === token || app.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === token)
    ).length;

  const tokenCoverage = (combo: IdeaCombination) => {
    const text = combo.apps.map((app) => [app.name, ...app.actions.map((action) => action.name)].join(" ")).join(" ").toLowerCase();
    return tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
  };

  combinationList.sort((a, b) => {
    const coverageDiff = tokenCoverage(b) - tokenCoverage(a);
    if (coverageDiff !== 0) return coverageDiff;
    const directDiff = exactDirectAppCount(b) - exactDirectAppCount(a);
    if (directDiff !== 0) return directDiff;
    if (a.apps.length !== b.apps.length) return a.apps.length - b.apps.length;
    if (b.score !== a.score) return b.score - a.score;
    if (a.totalScopes !== b.totalScopes) return a.totalScopes - b.totalScopes;
    return a.apps.map((app) => app.name).join().localeCompare(b.apps.map((app) => app.name).join());
  });
  const ranked = combinationList.slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    requirement,
    combinations: ranked,
    candidates: candidates.slice(0, 12),
  };
}
export type AiIdeaEnhancement = {
  model: string;
  steps: string[];
  source: string;
};

export async function enhanceIdeaSearchWithConfiguredModel(
  userId: string,
  requirement: string,
  result: { combinations: IdeaCombination[]; candidates: IdeaApp[] }
): Promise<AiIdeaEnhancement | null> {
  const enhanced = await generateLlmSteps(userId, requirement, result);
  if (!enhanced) return null;
  return {
    model: enhanced.model,
    steps: enhanced.steps,
    source: enhanced.source,
  };
}
