import { readFile } from "node:fs/promises";
import path from "node:path";

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
      .sort((a, b) => b.score - a.score)
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
  const requiredApps = topApps.filter((app) =>
    tokens.some((token) => app.slug.includes(token) || app.name.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(token))
  );

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

  const directAppCount = (combo: IdeaCombination) =>
    combo.apps.filter((app) =>
      tokens.some((token) => app.slug.includes(token) || app.name.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(token))
    ).length;

  const tokenCoverage = (combo: IdeaCombination) => {
    const text = combo.apps.map((app) => [app.name, ...app.actions.map((action) => action.name)].join(" ")).join(" ").toLowerCase();
    return tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
  };

  combinationList.sort((a, b) => {
    const coverageDiff = tokenCoverage(b) - tokenCoverage(a);
    if (coverageDiff !== 0) return coverageDiff;
    const directDiff = directAppCount(b) - directAppCount(a);
    if (directDiff !== 0) return directDiff;
    if (b.score !== a.score) return b.score - a.score;
    if (a.totalScopes !== b.totalScopes) return a.totalScopes - b.totalScopes;
    return a.apps.length - b.apps.length;
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
};

export async function enhanceIdeaSearchWithLocalModel(
  requirement: string,
  result: { combinations: IdeaCombination[]; candidates: IdeaApp[] }
): Promise<AiIdeaEnhancement | null> {
  const baseUrl = process.env.LOCAL_LLM_URL?.trim();
  const model = process.env.LOCAL_LLM_MODEL?.trim();
  if (!baseUrl || !model) return null;

  const endpoint = baseUrl.endsWith("/api/generate")
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, "")}/api/generate`;

  const timeoutMs = Number(process.env.LOCAL_LLM_TIMEOUT_MS ?? 30000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const best = result.combinations[0];
  const alternatives = result.combinations.slice(1, 4);
  const context = [
    `Best combination: ${best.apps.map((app) => `${app.name} (${app.slug})`).join(" + ")}.`,
    `Best actions: ${best.apps.flatMap((app) => app.actions.map((action) => action.slug)).join(", ")}.`,
    `Best total scopes: ${best.totalScopes}.`,
    ...alternatives.map((combination, index) => {
      const apps = combination.apps.map((app) => `${app.name} (${app.slug})`).join(" + ");
      const actions = combination.apps.flatMap((app) => app.actions.map((action) => action.slug)).join(", ");
      return `Alternative ${index + 1}: ${apps}. Actions: ${actions}. Scopes: ${combination.totalScopes}.`;
    }),
  ].join("\n");

  const prompt = [
    "You are a Composio workflow planning assistant.",
    "Use only the supplied Composio apps and actions.",
    "Return 5 to 8 concise implementation steps only.",
    "Each step must be a plain English sentence and start with an action verb.",
    "Do not include code, snippets, JSON, tool slugs, tool arguments, or invented user-interface actions.",
    "Example:",
    "1. Connect GitHub if it is not already connected.",
    "2. Create the issue in GitHub.",
    "3. Review the requested GitHub scopes.",
    "4. Connect Slack if it is not already connected.",
    "5. Send the notification in Slack.",
    "6. Review the requested Slack scopes.",
    "Choose the best combination, then rank alternatives by requirement fit and fewer total scopes.",
    `Requirement: ${requirement}`,
    context,
    "Steps:",
  ].join("\n");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0, num_predict: 180 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { response?: unknown };
    if (typeof data.response !== "string") return null;

    const steps = data.response
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim())
      .filter((line) => line.length > 0 && !line.includes("```") && !/\b(const|let|var|function|import|export)\b/.test(line));

    const looksLikeToolSlugs = steps.length > 0 && steps.every((step) => /^[A-Z0-9_]+$/.test(step));
    if (looksLikeToolSlugs) return null;

    return steps.length > 0 ? { model, steps } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
