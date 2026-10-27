import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), ".data");
const SETTINGS_FILE = path.join(DATA_DIR, "llm-settings.json");
const USAGE_FILE = path.join(DATA_DIR, "llm-usage.json");

export type LlmProvider = "openai" | "openrouter" | "anthropic" | "xai" | "custom";

export type StoredLlmSettings = {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  encryptedApiKey: string | null;
  useShared: boolean;
  updatedAt: string;
};

export type PublicLlmSettings = {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  useShared: boolean;
  updatedAt: string | null;
};

export type ResolvedLlmConfig = {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  source: "user" | "shared" | "local";
  dailyLimit: number;
};

const PROVIDERS: LlmProvider[] = ["openai", "openrouter", "anthropic", "xai", "custom"];

const DEFAULT_BASE_URLS: Record<LlmProvider, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
  xai: "https://api.x.ai/v1",
  custom: "",
};

function isProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && PROVIDERS.includes(value as LlmProvider);
}

function normalizeUrl(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function validateUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(value, null, 2), "utf8");
  await rename(temporaryFile, file);
}

function encryptionSecrets(): string[] {
  const secrets: string[] = [];
  const dedicated = process.env.LLM_ENCRYPTION_KEY?.trim();
  if (dedicated && dedicated.length >= 32) {
    secrets.push(dedicated);
  }

  const authSecret = process.env.AUTH_SECRET?.trim();
  if (authSecret && authSecret.length >= 32) {
    secrets.push(authSecret);
  }

  if (secrets.length === 0) {
    throw new Error("AUTH_SECRET or LLM_ENCRYPTION_KEY must be set to a random string of at least 32 characters.");
  }

  return [...new Set(secrets)];
}

function encryptionKey(secret: string): Buffer {
  return crypto.scryptSync(secret, "composio-llm-settings-v2", 32);
}

function encrypt(value: string): string {
  const key = encryptionKey(encryptionSecrets()[0]);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v2:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(value: string): string {
  const parts = value.split(":");
  const versioned = parts[0] === "v2";
  const [ivText, tagText, encryptedText] = versioned ? parts.slice(1) : parts;
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted API key.");

  const iv = Buffer.from(ivText, "base64");
  const tag = Buffer.from(tagText, "base64");
  const encrypted = Buffer.from(encryptedText, "base64");
  const salt = versioned ? "composio-llm-settings-v2" : "composio-llm-settings";

  for (const secret of encryptionSecrets()) {
    try {
      const key = crypto.scryptSync(secret, salt, 32);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const decrypted = decipher.update(encrypted);
      const final = decipher.final();
      return Buffer.concat([decrypted, final]).toString("utf8");
    } catch {
      // Try the next available secret or legacy salt.
    }
  }

  // Legacy v1 values were encrypted with the auth secret and the original salt.
  if (versioned) {
    throw new Error("Invalid encrypted API key.");
  }

  for (const secret of encryptionSecrets()) {
    try {
      const key = crypto.scryptSync(secret, "composio-llm-settings", 32);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const decrypted = decipher.update(encrypted);
      const final = decipher.final();
      return Buffer.concat([decrypted, final]).toString("utf8");
    } catch {
      // Try the next available secret.
    }
  }

  throw new Error("Invalid encrypted API key.");
}

type SettingsFile = Record<string, StoredLlmSettings>;

function normalizeProvider(value: unknown): LlmProvider {
  if (value === "ollama") return "openai";
  return isProvider(value) ? value : "openai";
}

async function readSettings(): Promise<SettingsFile> {
  const parsed = await readJson<unknown>(SETTINGS_FILE, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const normalized: SettingsFile = {};
  for (const [userId, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const stored = value as Partial<StoredLlmSettings>;
    const provider = normalizeProvider(stored.provider);
    normalized[userId] = {
      provider,
      model: typeof stored.model === "string" ? stored.model : "",
      baseUrl:
        provider === "openai"
          ? stored.baseUrl?.trim() || ""
          : typeof stored.baseUrl === "string"
            ? stored.baseUrl
            : "",
      encryptedApiKey:
        typeof stored.encryptedApiKey === "string" || stored.encryptedApiKey === null
          ? stored.encryptedApiKey
          : null,
      useShared: stored.useShared === true,
      updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : new Date(0).toISOString(),
    };
  }

  return normalized;
}

export async function getPublicLlmSettings(userId: string): Promise<PublicLlmSettings> {
  const settings = (await readSettings())[userId];
  return {
    provider: settings?.provider ?? "openai",
    model: settings?.model ?? "",
    baseUrl: settings?.baseUrl ?? "",
    hasApiKey: Boolean(settings?.encryptedApiKey),
    useShared: settings?.useShared ?? true,
    updatedAt: settings?.updatedAt ?? null,
  };
}

export async function saveLlmSettings(
  userId: string,
  input: {
    provider: unknown;
    model: unknown;
    baseUrl: unknown;
    apiKey: unknown;
    useShared: unknown;
    clearApiKey?: unknown;
  }
): Promise<PublicLlmSettings> {
  if (!isProvider(input.provider)) throw new Error("Choose a supported provider.");
  const model = typeof input.model === "string" ? input.model.trim() : "";
  if (!model || model.length > 120) throw new Error("Enter a valid model name.");

  const baseUrl = normalizeUrl(input.baseUrl);
  if (!validateUrl(baseUrl)) throw new Error("Enter a valid base URL.");

  const requestedUseShared = input.useShared === true;
  const clearApiKey = input.clearApiKey === true;
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";

  const settings = await readSettings();
  const current = settings[userId];
  let encryptedApiKey = current?.encryptedApiKey ?? null;

  if (clearApiKey) {
    encryptedApiKey = null;
  } else if (apiKey) {
    if (apiKey.length > 500) throw new Error("API key is too long.");
    encryptedApiKey = encrypt(apiKey);
  }

  const useShared = apiKey ? false : requestedUseShared;
  if (useShared) {
    encryptedApiKey = null;
  }

  const stored: StoredLlmSettings = {
    provider: input.provider,
    model,
    baseUrl,
    encryptedApiKey,
    useShared,
    updatedAt: new Date().toISOString(),
  };

  settings[userId] = stored;
  await writeJson(SETTINGS_FILE, settings);

  return {
    provider: stored.provider,
    model: stored.model,
    baseUrl: stored.baseUrl,
    hasApiKey: Boolean(stored.encryptedApiKey),
    useShared: stored.useShared,
    updatedAt: stored.updatedAt,
  };
}

export function sharedConfig(): ResolvedLlmConfig | null {
  const provider = process.env.SHARED_LLM_PROVIDER?.trim();
  const model = process.env.SHARED_LLM_MODEL?.trim();
  const baseUrl = process.env.SHARED_LLM_BASE_URL?.trim() ?? "";
  const apiKey = process.env.SHARED_LLM_API_KEY?.trim() ?? "";
  const dailyLimit = Number(process.env.SHARED_LLM_DAILY_LIMIT ?? 20);

  if (provider && isProvider(provider) && model) {
    if (apiKey || provider === "custom") {
      return {
        provider,
        model,
        baseUrl: baseUrl || DEFAULT_BASE_URLS[provider],
        apiKey,
        source: "shared",
        dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? Math.trunc(dailyLimit) : 20,
      };
    }
  }

  return null;
}

export async function resolveLlmConfig(userId: string): Promise<ResolvedLlmConfig | null> {
  const settings = (await readSettings())[userId];

  if (settings && !settings.useShared && settings.encryptedApiKey) {
    try {
      return {
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl || DEFAULT_BASE_URLS[settings.provider],
        apiKey: decrypt(settings.encryptedApiKey),
        source: "user",
        dailyLimit: 0,
      };
    } catch {
      // Fall through to shared configuration only when the user explicitly allows it.
    }
  }

  if (settings?.useShared) {
    return sharedConfig();
  }

  return null;
}

type UsageFile = { users?: Record<string, { date: string; count: number }> };

async function readUsage(): Promise<UsageFile> {
  const parsed = await readJson<unknown>(USAGE_FILE, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as UsageFile;
}

export async function getStoredApiKey(userId: string): Promise<string | null> {
  const settings = (await readSettings())[userId];
  if (!settings?.encryptedApiKey) return null;
  try {
    return decrypt(settings.encryptedApiKey);
  } catch {
    return null;
  }
}

export async function getUsageToday(userId: string): Promise<number> {
  const usage = (await readUsage()).users?.[userId];
  const today = new Date().toISOString().slice(0, 10);
  return usage?.date === today ? usage.count : 0;
}

async function consumeUsage(userId: string, config: ResolvedLlmConfig): Promise<boolean> {
  if (config.source !== "shared" || config.dailyLimit <= 0) return true;

  const usage = await readUsage();
  usage.users ??= {};
  const today = new Date().toISOString().slice(0, 10);
  const current = usage.users[userId];
  const count = current?.date === today ? current.count : 0;

  if (count >= config.dailyLimit) return false;

  usage.users[userId] = { date: today, count: count + 1 };
  await writeJson(USAGE_FILE, usage);
  return true;
}

export type LlmTextOptions = {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

type LlmCallOptions = LlmTextOptions & {
  signal?: AbortSignal;
};

async function callOpenAiCompatible(
  config: ResolvedLlmConfig,
  prompt: string,
  options: LlmCallOptions = {}
): Promise<string | null> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URLS[config.provider];
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 180,
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

async function callAnthropic(
  config: ResolvedLlmConfig,
  prompt: string,
  options: LlmCallOptions = {}
): Promise<string | null> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URLS.anthropic;
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: options.signal,
    body: JSON.stringify({
      model: config.model,
      max_tokens: options.maxTokens ?? 180,
      temperature: options.temperature ?? 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { content?: { type?: string; text?: string }[] };
  const text = data.content?.find((item) => item.type === "text")?.text;
  return typeof text === "string" ? text : null;
}


export async function generateLlmText(
  userId: string,
  prompt: string,
  options: LlmTextOptions = {}
): Promise<{
  text: string;
  model: string;
  provider: LlmProvider;
  source: "user" | "shared" | "local";
} | null> {
  const config = await resolveLlmConfig(userId);
  if (!config) return null;
  if (!(await consumeUsage(userId, config))) return null;

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Math.min(options.timeoutMs ?? 45000, 120000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const callOptions: LlmCallOptions = { ...options, signal: controller.signal };

  try {
    const text =
      config.provider === "anthropic"
        ? await callAnthropic(config, prompt, callOptions)
        : await callOpenAiCompatible(config, prompt, callOptions);

    if (!text?.trim()) return null;

    return {
      text: text.trim(),
      model: config.model,
      provider: config.provider,
      source: config.source,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testLlmConfig(userId: string): Promise<{ ok: boolean; provider: LlmProvider | null; model: string | null; preview: string | null }> {
  const config = await resolveLlmConfig(userId);
  if (!config) return { ok: false, provider: null, model: null, preview: null };

  const prompt = "Reply with exactly: OK";
  let text: string | null = null;

  try {
    if (config.provider === "anthropic") text = await callAnthropic(config, prompt);
    else text = await callOpenAiCompatible(config, prompt);

    return { ok: Boolean(text), provider: config.provider, model: config.model, preview: text };
  } catch {
    return { ok: false, provider: config.provider, model: config.model, preview: null };
  }
}