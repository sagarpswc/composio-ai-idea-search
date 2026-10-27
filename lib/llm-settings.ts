import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), ".data");
const SETTINGS_FILE = path.join(DATA_DIR, "llm-settings.json");
const USAGE_FILE = path.join(DATA_DIR, "llm-usage.json");

export type LlmProvider = "openai" | "openrouter" | "anthropic" | "xai" | "ollama" | "custom";

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

const PROVIDERS: LlmProvider[] = ["openai", "openrouter", "anthropic", "xai", "ollama", "custom"];

const DEFAULT_BASE_URLS: Record<LlmProvider, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
  xai: "https://api.x.ai/v1",
  ollama: "http://127.0.0.1:11434",
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

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters.");
  }
  return crypto.scryptSync(secret, "composio-llm-settings", 32);
}

function encrypt(value: string): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(value: string): string {
  const [ivText, tagText, encryptedText] = value.split(":");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted API key.");
  const key = encryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  const decrypted = decipher.update(Buffer.from(encryptedText, "base64"));
  const final = decipher.final();
  return Buffer.concat([decrypted, final]).toString("utf8");
}

type SettingsFile = Record<string, StoredLlmSettings>;

async function readSettings(): Promise<SettingsFile> {
  const parsed = await readJson<unknown>(SETTINGS_FILE, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as SettingsFile;
}

export async function getPublicLlmSettings(userId: string): Promise<PublicLlmSettings> {
  const settings = (await readSettings())[userId];
  return {
    provider: settings?.provider ?? "ollama",
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

  const useShared = input.useShared === true;
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

  const stored: StoredLlmSettings = {
    provider: input.provider,
    model,
    baseUrl,
    encryptedApiKey: useShared ? null : encryptedApiKey,
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
    if (provider === "ollama" || apiKey) {
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

  // Backward-compatible local model configuration.
  const localUrl = process.env.LOCAL_LLM_URL?.trim();
  const localModel = process.env.LOCAL_LLM_MODEL?.trim();
  if (localUrl && localModel) {
    return {
      provider: "ollama",
      model: localModel,
      baseUrl: localUrl.replace(/\/+$/, ""),
      apiKey: "",
      source: "local",
      dailyLimit: 0,
    };
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

async function callOllama(
  config: ResolvedLlmConfig,
  prompt: string,
  options: LlmCallOptions = {}
): Promise<string | null> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URLS.ollama;
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0,
        num_predict: options.maxTokens ?? 180,
      },
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { response?: unknown };
  return typeof data.response === "string" ? data.response : null;
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
        : config.provider === "ollama"
          ? await callOllama(config, prompt, callOptions)
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

export async function generateLlmSteps(
  userId: string,
  requirement: string,
  result: { combinations: { apps: { name: string; slug: string; scopeCount: number; actions: { slug: string; name: string }[] }[]; totalScopes: number }[] }
): Promise<{ model: string; steps: string[]; source: string } | null> {
  const config = await resolveLlmConfig(userId);
  if (!config) return null;
  if (!(await consumeUsage(userId, config))) return null;

  const best = result.combinations[0];
  if (!best) return null;

  const allowedSteps = best.apps.flatMap((app) => {
    const steps = [`Connect ${app.name} if it is not already connected.`];
    const action = app.actions[0];
    if (action) steps.push(`Run ${action.name} for the ${app.name} part of the workflow.`);
    if (app.scopeCount > 0) steps.push(`Review and approve the ${app.scopeCount} requested ${app.name} scopes before connecting.`);
    return steps;
  });
  if (best.apps.length > 1) {
    allowedSteps.push("Chain the tool results in order, passing only the fields needed by the next step.");
  }

  const prompt = [
    "You are a Composio workflow planning assistant.",
    "Use only the supplied Composio apps and actions.",
    "Return 5 to 8 concise implementation steps only.",
    "Each step must be a plain English sentence and start with an action verb.",
    "Do not include code, snippets, JSON, tool slugs, tool arguments, or invented user-interface actions.",
    `Requirement: ${requirement}`,
    `Best combination: ${best.apps.map((app) => app.name).join(" + ")}.`,
    `Best actions: ${best.apps.flatMap((app) => app.actions.map((action) => action.name)).join("; ")}.`,
    `Best total scopes: ${best.totalScopes}.`,
    "Allowed steps:",
    ...allowedSteps,
    "Return only allowed steps, one per line.",
    "Steps:",
  ].join("\\n");

  const timeoutMs = 60000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let text: string | null = null;

    if (config.provider === "anthropic") {
      text = await callAnthropic(config, prompt);
    } else if (config.provider === "ollama") {
      text = await callOllama(config, prompt);
    } else {
      text = await callOpenAiCompatible(config, prompt);
    }

    if (!text) return null;

    const allowed = new Set(allowedSteps);
    const steps = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim())
      .filter((line) => allowed.has(line));

    if (steps.length === 0) return null;

    return { model: config.model, steps, source: config.source };
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
    else if (config.provider === "ollama") text = await callOllama(config, prompt);
    else text = await callOpenAiCompatible(config, prompt);

    return { ok: Boolean(text), provider: config.provider, model: config.model, preview: text };
  } catch {
    return { ok: false, provider: config.provider, model: config.model, preview: null };
  }
}