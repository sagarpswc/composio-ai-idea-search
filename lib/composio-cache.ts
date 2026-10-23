import type { ToolkitAction, ToolkitOverview } from "./toolkit-details";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const COMPOSIO_CACHE_DIR = path.join(process.cwd(), ".data");
export const COMPOSIO_CACHE_FILE = path.join(
  COMPOSIO_CACHE_DIR,
  "composio-cache.json"
);

const CACHE_VERSION = 1;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type ComposioCacheEntry<T> = {
  updatedAt: string;
  value: T;
};

type ComposioCacheData = {
  version: number;
  toolkits: Record<string, ComposioCacheEntry<ToolkitOverview>>;
  tools: Record<string, ComposioCacheEntry<ToolkitAction[]>>;
};

let memoryToolkits = new Map<string, ComposioCacheEntry<ToolkitOverview>>();
let memoryTools = new Map<string, ComposioCacheEntry<ToolkitAction[]>>();

function isCacheEntry<T>(value: unknown): value is ComposioCacheEntry<T> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<ComposioCacheEntry<T>>;

  if (typeof entry.updatedAt !== "string" || !entry.value) {
    return false;
  }

  return true;
}

async function readCacheData(): Promise<ComposioCacheData> {
  try {
    const raw = await readFile(COMPOSIO_CACHE_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const candidate = parsed as Partial<ComposioCacheData>;

    if (
      !candidate ||
      candidate.version !== CACHE_VERSION ||
      !candidate.toolkits ||
      typeof candidate.toolkits !== "object" ||
      !candidate.tools ||
      typeof candidate.tools !== "object"
    ) {
      return { version: CACHE_VERSION, toolkits: {}, tools: {} };
    }

    return {
      version: CACHE_VERSION,
      toolkits: candidate.toolkits,
      tools: candidate.tools,
    };
  } catch {
    return { version: CACHE_VERSION, toolkits: {}, tools: {} };
  }
}

async function writeCacheData(data: ComposioCacheData): Promise<void> {
  await mkdir(COMPOSIO_CACHE_DIR, { recursive: true });
  const temporaryFile = `${COMPOSIO_CACHE_FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(data, null, 2), "utf8");
  await rename(temporaryFile, COMPOSIO_CACHE_FILE);
}

function isFresh<T>(entry: ComposioCacheEntry<T> | undefined, ttlMs: number): boolean {
  if (!entry) {
    return false;
  }

  const updatedAt = Date.parse(entry.updatedAt);

  if (Number.isNaN(updatedAt)) {
    return false;
  }

  return Date.now() - updatedAt <= ttlMs;
}

export async function getCachedToolkitOverview(
  rawSlug: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<ToolkitOverview | null> {
  const slug = rawSlug.trim().toLowerCase();
  const entry = memoryToolkits.get(slug) ?? (await readCacheData()).toolkits[slug];

  if (!isCacheEntry(entry) || !isFresh(entry, ttlMs)) {
    return null;
  }

  return entry.value;
}

export async function setCachedToolkitOverview(
  rawSlug: string,
  overview: ToolkitOverview
): Promise<void> {
  const slug = rawSlug.trim().toLowerCase();
  const updatedAt = new Date().toISOString();

  memoryToolkits.set(slug, { updatedAt, value: overview });

  const data = await readCacheData();
  data.toolkits[slug] = { updatedAt, value: overview };
  await writeCacheData(data);
}

export async function getCachedToolkitActions(
  rawSlug: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<ToolkitAction[] | null> {
  const slug = rawSlug.trim().toLowerCase();
  const entry = memoryTools.get(slug) ?? (await readCacheData()).tools[slug];

  if (!isCacheEntry(entry) || !isFresh(entry, ttlMs)) {
    return null;
  }

  return entry.value;
}

export async function setCachedToolkitActions(
  rawSlug: string,
  tools: ToolkitAction[]
): Promise<void> {
  const slug = rawSlug.trim().toLowerCase();
  const updatedAt = new Date().toISOString();

  memoryTools.set(slug, { updatedAt, value: tools });

  const data = await readCacheData();
  data.tools[slug] = { updatedAt, value: tools };
  await writeCacheData(data);
}

export async function clearComposioCache(): Promise<void> {
  memoryToolkits.clear();
  memoryTools.clear();

  await writeCacheData({
    version: CACHE_VERSION,
    toolkits: {},
    tools: {},
  });
}
