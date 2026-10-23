import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";

const ROOT = "/workspaces/codespaces-blank";
const DATA_DIR = path.join(ROOT, ".data");
const CACHE_FILE = path.join(DATA_DIR, "composio-cache.json");
const STATE_FILE = path.join(DATA_DIR, "composio-preload-state.json");
const CACHE_VERSION = 1;
const FORCE = process.argv.includes("--force");
const TODAY = new Date().toISOString().slice(0, 10);

function loadEnv() {
  // Minimal .env.local loader for the preload script.
  try {
    const raw = readFileSync(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Fall back to the process environment.
  }
}

loadEnv();

const { Composio } = await import("@composio/core");
const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

function cleanDescription(description) {
  const value = description?.replace(/\s+/g, " ").trim();
  if (!value) return "Runs this action with your connected account.";
  return value.length <= 360 ? value : `${value.slice(0, 357).trimEnd()}…`;
}

async function fetchRawToolkit(slug) {
  const response = await fetch(`https://backend.composio.dev/api/v3/toolkits/${encodeURIComponent(slug)}`, {
    headers: { "x-api-key": process.env.COMPOSIO_API_KEY },
  });

  if (!response.ok) {
    throw new Error(`toolkit HTTP ${response.status}`);
  }

  const raw = await response.json();

  function transformField(field) {
    if (!field || typeof field !== "object") return field;
    return {
      ...field,
      userVisible: field.user_visible ?? field.userVisible,
    };
  }

  function transformFields(fields) {
    if (!fields || typeof fields !== "object") {
      return { required: [], optional: [] };
    }

    return {
      required: Array.isArray(fields.required) ? fields.required.map(transformField) : [],
      optional: Array.isArray(fields.optional) ? fields.optional.map(transformField) : [],
    };
  }

  return {
    slug: raw.slug,
    name: raw.name,
    meta: {
      categories: Array.isArray(raw.meta?.categories) ? raw.meta.categories.map((category) => ({ slug: category.slug, name: category.name })) : [],
      appUrl: raw.meta?.app_url ?? null,
      description: raw.meta?.description,
      logo: raw.meta?.logo,
      toolsCount: raw.meta?.tools_count ?? 0,
      triggersCount: raw.meta?.triggers_count ?? 0,
      updatedAt: raw.meta?.updated_at ?? null,
    },
    authConfigDetails: Array.isArray(raw.auth_config_details)
      ? raw.auth_config_details.map((config) => ({
          name: config.name,
          mode: config.mode,
          authHintUrl: config.auth_hint_url ?? null,
          requiredScopes: Array.isArray(config.required_scopes) ? config.required_scopes : [],
          fields: {
            authConfigCreation: transformFields(config.fields?.auth_config_creation),
            connectedAccountInitiation: transformFields(config.fields?.connected_account_initiation),
          },
          proxy: config.proxy ?? {},
        }))
      : [],
    composioManagedAuthSchemes: Array.isArray(raw.composio_managed_auth_schemes) ? raw.composio_managed_auth_schemes : [],
  };
}

async function fetchRawTools(slug) {
  const response = await fetch(
    `https://backend.composio.dev/api/v3/tools?toolkit_slug=${encodeURIComponent(slug)}&limit=9999`,
    { headers: { "x-api-key": process.env.COMPOSIO_API_KEY } }
  );

  if (!response.ok) {
    throw new Error(`tools HTTP ${response.status}`);
  }

  const raw = await response.json();
  return (raw.items ?? []).map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    description: tool.description,
    toolkit: { slug: tool.toolkit?.slug ?? slug },
  }));
}

function actionKind(slug) {
  const action = slug.replace(/^[A-Z0-9]+_/, "");
  if (/(^|_)(DELETE|REMOVE|ARCHIVE|CANCEL|CLOSE|REVOKE|UNSUBSCRIBE|TRASH|CLEAR|RESET|KILL|TERMINATE|ABORT|STOP|DISABLE|DEACTIVATE|DECLINE|REJECT|LEAVE|UNFOLLOW|UNLINK|DETACH|DROP)(_|$)/.test(action)) return "delete";
  if (/(^|_)(UPDATE|PATCH|MODIFY|EDIT|SET|REPLACE|MOVE|RENAME|MARK|ASSIGN|SYNC|ENABLE|ACTIVATE|APPROVE|ACCEPT|UPSERT|MERGE)(_|$)/.test(action)) return "update";
  if (/(^|_)(GET|LIST|FETCH|SEARCH|FIND|RETRIEVE|READ|DESCRIBE|CHECK|VALIDATE|COUNT|DOWNLOAD|EXPORT|PREVIEW|WHO_AM_I|ME)(_|$)/.test(action)) return "read";
  if (/(^|_)(CREATE|ADD|INSERT|SEND|POST|UPLOAD|PUBLISH|MAKE|GENERATE|EXECUTE|RUN|START|INVITE|REGISTER|SUBSCRIBE|TRIGGER|CALL|ATTACH|APPLY|CONFIRM|PAY|ISSUE)(_|$)/.test(action)) return "create";
  return "action";
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(value, null, 2), "utf8");
  await rename(temporaryFile, file);
}

function overviewFromToolkit(toolkit) {
  return {
    slug: toolkit.slug.toLowerCase(),
    name: toolkit.name,
    description: toolkit.meta?.description?.trim() || `${toolkit.name} is available as a Composio toolkit.`,
    logo: toolkit.meta?.logo ?? null,
    websiteUrl: toolkit.meta?.appUrl ?? null,
    categories: toolkit.meta?.categories?.map((category) => category.name).filter(Boolean) ?? [],
    toolsCount: toolkit.meta?.toolsCount ?? 0,
    triggersCount: toolkit.meta?.triggersCount ?? 0,
    updatedAt: toolkit.meta?.updatedAt ?? null,
    authConfigDetails: toolkit.authConfigDetails ?? [],
    managedSchemes: toolkit.composioManagedAuthSchemes?.map((mode) => mode.toUpperCase()) ?? [],
  };
}

async function fetchAllSlugs() {
  const slugs = [];
  const metaBySlug = new Map();
  let cursor;

  do {
    const page = await composio.client.toolkits.list({ limit: 1000, cursor });
    for (const item of page.items ?? []) {
      slugs.push(item.slug);
      metaBySlug.set(item.slug, item.meta ?? {});
    }
    cursor = page.next_cursor;
    console.log(`[preload] listed ${slugs.length}/${page.total_items ?? "?"} toolkits`);
  } while (cursor);

  return { slugs, metaBySlug };
}

async function runPool(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const state = await readJson(STATE_FILE, { lastRun: null });
  const cache = await readJson(CACHE_FILE, { version: CACHE_VERSION, toolkits: {}, tools: {} });

  if (!FORCE && new Date().getDay() !== 6) {
    console.log("[preload] Today is not Saturday. Use --force to run anyway.");
    return;
  }

  if (!FORCE && state.lastRun === TODAY) {
    console.log("[preload] Already ran today. Use --force to run again.");
    return;
  }

  console.log("[preload] Fetching all Composio toolkits...");
  const { slugs, metaBySlug } = await fetchAllSlugs();
  const slugSet = new Set(slugs);

  for (const slug of Object.keys(cache.toolkits ?? {})) {
    if (!slugSet.has(slug)) {
      delete cache.toolkits[slug];
      delete cache.tools[slug];
    }
  }

  const REFRESH_ALL = process.argv.includes("--refresh-all");
  let processed = 0;

  async function storeToolkit(detail, toolsForToolkit) {
    const slug = detail.slug.toLowerCase();
    const overview = overviewFromToolkit(detail);
    const actions = (toolsForToolkit ?? []).map((tool) => ({
      slug: tool.slug,
      name: tool.name || slug,
      description: cleanDescription(tool.description),
      kind: actionKind(tool.slug),
    }));

    cache.toolkits[slug] = { updatedAt: new Date().toISOString(), value: overview };
    cache.tools[slug] = { updatedAt: new Date().toISOString(), value: actions };
  }

  async function fetchToolkitAndTools(slug) {
    try {
      const [detail, tools] = await Promise.all([
        composio.toolkits.get(slug),
        composio.tools.getRawComposioTools({ toolkits: [slug], limit: 9999 }),
      ]);
      return { detail, tools };
    } catch (sdkError) {
      console.error(`[preload] SDK failed for ${slug}, trying raw HTTP:`, sdkError instanceof Error ? sdkError.message : sdkError);
      const [detail, tools] = await Promise.all([fetchRawToolkit(slug), fetchRawTools(slug)]);
      return { detail, tools };
    }
  }

  const REFRESH_SCOPES = process.argv.includes("--refresh-scopes");
  const changedSlugs = slugs.filter((slug) => {
    if (REFRESH_ALL || REFRESH_SCOPES) return true;
    const cached = cache.toolkits?.[slug]?.value;
    const updatedAt = metaBySlug.get(slug)?.updated_at ?? null;
    const hasScopes = Array.isArray(cached?.authConfigDetails) && cached.authConfigDetails.length > 0;
    return !cached || !hasScopes || cached.updatedAt !== updatedAt || !cache.tools?.[slug];
  });

  const concurrency = 8;
  const queue = [...changedSlugs];

  async function worker() {
    while (queue.length > 0) {
      const slug = queue.shift();
      if (!slug) return;

      try {
        const { detail, tools } = await fetchToolkitAndTools(slug);
        await storeToolkit(detail, tools);
      } catch (itemError) {
        console.error(`[preload] skipped ${slug}:`, itemError instanceof Error ? itemError.message : itemError);
      }

      processed += 1;
      if (processed % 25 === 0 || processed === changedSlugs.length) {
        cache.version = CACHE_VERSION;
        await writeJson(CACHE_FILE, cache);
        console.log(`[preload] processed ${processed}/${changedSlugs.length} changed toolkits`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  cache.version = CACHE_VERSION;
  await writeJson(CACHE_FILE, cache);
  await writeJson(STATE_FILE, {
    lastRun: TODAY,
    toolkits: Object.keys(cache.toolkits).length,
    tools: Object.keys(cache.tools).length,
    force: FORCE,
  });

  console.log(`[preload] done: ${Object.keys(cache.toolkits).length} toolkits, ${Object.keys(cache.tools).length} action sets`);
}

main().catch((error) => {
  console.error("[preload] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});