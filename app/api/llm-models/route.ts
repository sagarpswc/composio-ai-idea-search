import { NextResponse } from "next/server";
import { apiError, isRecord } from "@/lib/http";
import { requireUserId } from "@/lib/identity";

export const runtime = "nodejs";

type Provider = "openai" | "openrouter" | "anthropic" | "xai" | "ollama" | "custom";

const DEFAULT_BASE_URLS: Record<Provider, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
  xai: "https://api.x.ai/v1",
  ollama: "http://127.0.0.1:11434",
  custom: "",
};

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && ["openai", "openrouter", "anthropic", "xai", "ollama", "custom"].includes(value);
}

function normalizeUrl(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

type ModelGroups = { free: string[]; paid: string[] };

function isFreeModelId(id: string): boolean {
  return /(^|[-_/])free($|[-_/])/i.test(id) || id.endsWith(":free");
}

async function fetchModels(provider: Provider, baseUrl: string, apiKey: string): Promise<ModelGroups> {
  const normalizedBase = baseUrl || DEFAULT_BASE_URLS[provider];

  if (provider === "ollama") {
    const root = normalizedBase.replace(/\/v1$/, "");
    const data = await fetchJson(`${root}/api/tags`, {}, 15000);
    const models = (data as { models?: { name?: unknown }[] }).models ?? [];
    return {
      free: models.map((model) => (typeof model.name === "string" ? model.name : "")).filter(Boolean),
      paid: [],
    };
  }

  if (provider === "anthropic") {
    const data = await fetchJson(`${normalizedBase}/models`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    }, 15000);
    const models = (data as { data?: { id?: unknown }[] }).data ?? [];
    const ids = models.map((model) => (typeof model.id === "string" ? model.id : "")).filter(Boolean);
    return {
      free: ids.filter(isFreeModelId),
      paid: ids.filter((id) => !isFreeModelId(id)),
    };
  }

  const openAiBase = normalizedBase.endsWith("/v1") ? normalizedBase : `${normalizedBase}/v1`;
  const data = await fetchJson(`${openAiBase}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }, 15000);
  const models = (data as { data?: { id?: unknown; pricing?: { prompt?: unknown; completion?: unknown } }[] }).data ?? [];

  const free: string[] = [];
  const paid: string[] = [];
  for (const model of models) {
    if (typeof model.id !== "string") continue;
    const pricing = model.pricing;
    const promptPrice = typeof pricing?.prompt === "string" ? Number(pricing.prompt) : 0;
    const completionPrice = typeof pricing?.completion === "string" ? Number(pricing.completion) : 0;
    const isFree = isFreeModelId(model.id) || (promptPrice === 0 && completionPrice === 0 && provider === "openrouter");
    (isFree ? free : paid).push(model.id);
  }

  return { free, paid };
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Expected a JSON object." }, { status: 400 });
    }

    const provider = body.provider;
    if (!isProvider(provider)) {
      return NextResponse.json({ error: "Choose a supported provider." }, { status: 400 });
    }

    const userId = await requireUserId();
    const baseUrl = normalizeUrl(body.baseUrl);
    let apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!apiKey && provider !== "ollama" && body.useStoredKey === true) {
      const { getStoredApiKey } = await import("@/lib/llm-settings");
      apiKey = (await getStoredApiKey(userId)) ?? "";
    }

    if (provider !== "ollama" && !apiKey) {
      return NextResponse.json({ error: "Paste an API key before loading models." }, { status: 400 });
    }

    const models = await fetchModels(provider, baseUrl, apiKey);
    const free = [...new Set(models.free)].sort((a, b) => a.localeCompare(b)).slice(0, 500);
    const paid = [...new Set(models.paid)].sort((a, b) => a.localeCompare(b)).slice(0, 500);

    if (free.length === 0 && paid.length === 0) {
      return NextResponse.json({ error: "No models were returned by that provider." }, { status: 404 });
    }

    return NextResponse.json({ free, paid });
  } catch (error) {
    return apiError(error);
  }
}