"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Save, Settings, TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Provider = "openai" | "openrouter" | "anthropic" | "xai" | "ollama" | "custom";

type SettingsResponse = {
  settings: {
    provider: Provider;
    model: string;
    baseUrl: string;
    hasApiKey: boolean;
    useShared: boolean;
    updatedAt: string | null;
  };
  shared: {
    available: boolean;
    provider: string | null;
    model: string | null;
    dailyLimit: number;
    usageToday: number;
  };
};

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "xai", label: "xAI (Grok)" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "custom", label: "Custom OpenAI-compatible" },
];

export function AiSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [shared, setShared] = useState<SettingsResponse["shared"] | null>(null);
  const [provider, setProvider] = useState<Provider>("ollama");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [useShared, setUseShared] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; preview: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/llm-settings", { cache: "no-store" });
        const data = (await response.json()) as SettingsResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load AI settings.");

        if (cancelled) return;
        setProvider(data.settings.provider);
        setModel(data.settings.model);
        setBaseUrl(data.settings.baseUrl);
        setUseShared(data.settings.useShared);
        setHasApiKey(data.settings.hasApiKey);
        setShared(data.shared);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load AI settings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    setTestResult(null);

    try {
      const response = await fetch("/api/llm-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          baseUrl,
          apiKey: apiKey.trim() || undefined,
          useShared,
          clearApiKey: !apiKey.trim() && !useShared ? false : undefined,
        }),
      });
      const data = (await response.json()) as { settings?: SettingsResponse["settings"]; error?: string };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Could not save AI settings.");
      }

      setHasApiKey(data.settings.hasApiKey);
      setApiKey("");
      setMessage("AI settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save AI settings.");
    } finally {
      setSaving(false);
    }
  }

  async function loadModels() {
    setModelError("");
    setTestResult(null);

    if (provider !== "ollama" && !apiKey.trim()) {
      setModelError("Paste an API key before loading models.");
      return;
    }

    setLoadingModels(true);
    try {
      const response = await fetch("/api/llm-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          baseUrl,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = (await response.json()) as { models?: string[]; error?: string };
      if (!response.ok || !Array.isArray(data.models)) {
        throw new Error(data.error || "Could not load models.");
      }

      setModels(data.models);
      if (!model || !data.models.includes(model)) {
        setModel(data.models[0] ?? "");
      }
      setMessage(`Loaded ${data.models.length} model${data.models.length === 1 ? "" : "s"}.`);
    } catch (loadModelError) {
      setModels([]);
      setModelError(loadModelError instanceof Error ? loadModelError.message : "Could not load models.");
    } finally {
      setLoadingModels(false);
    }
  }

  async function test() {
    setTesting(true);
    setError("");
    setMessage("");
    setTestResult(null);

    try {
      const response = await fetch("/api/llm-test", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; preview?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not test AI settings.");
      setTestResult({ ok: Boolean(data.ok), preview: data.preview ?? null });
      if (data.ok) setMessage("Connection test succeeded.");
      else setError("Connection test failed.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Could not test AI settings.");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading AI settings…</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="gap-4 shadow-sm">
        <CardHeader className="border-b">
          <div className="flex items-start gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base">AI provider settings</CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-xs leading-5">
                Use your own provider API key, or use shared platform access when no personal key is configured.
                API keys are stored encrypted on the server and are never returned to the browser.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-between">
                    {PROVIDERS.find((item) => item.value === provider)?.label ?? "Select provider"}
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  <DropdownMenuLabel>Provider</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PROVIDERS.map((item) => (
                    <DropdownMenuItem
                      key={item.value}
                      onSelect={() => {
                        setProvider(item.value);
                        setModels([]);
                        setModel("");
                        setModelError("");
                      }}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Model</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadModels()} disabled={loadingModels} className="h-7 px-2 text-xs">
                  {loadingModels ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {loadingModels ? "Loading" : "Load models"}
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-between" disabled={models.length === 0}>
                    {model || (models.length ? "Select a model" : "Load models first")}
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  <DropdownMenuLabel>Models</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {models.map((item) => (
                    <DropdownMenuItem key={item} onSelect={() => setModel(item)}>
                      {item}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {modelError ? <p className="text-xs text-destructive">{modelError}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-base-url">Base URL (optional)</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="Leave blank for the provider default"
              autoComplete="off"
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-api-key">API key</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasApiKey ? "Stored securely. Enter a new key to replace it." : "Enter a provider API key"}
              autoComplete="off"
              className="h-9"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={useShared}
                onChange={(event) => setUseShared(event.target.checked)}
                className="size-3.5"
              />
              Use shared platform access when no personal key is configured
            </label>
          </div>

          {shared ? (
            <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
              Shared access: {shared.available ? "available" : "not configured"}.
              {shared.available ? ` ${shared.provider} / ${shared.model}` : ""}
              {shared.available && shared.dailyLimit > 0
                ? ` ${shared.usageToday}/${shared.dailyLimit} requests used today.`
                : ""}
            </div>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {message ? <p className="text-xs text-primary">{message}</p> : null}
          {testResult ? (
            <p className={cn("text-xs", testResult.ok ? "text-primary" : "text-destructive")}>
              {testResult.ok ? "Connection test succeeded." : "Connection test failed."}
              {testResult.preview ? ` Response: ${testResult.preview}` : ""}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving} className="sm:w-32">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {saving ? "Saving" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void test()} disabled={testing} className="sm:w-40">
              {testing ? <Loader2 className="size-3.5 animate-spin" /> : <TestTube2 className="size-3.5" />}
              {testing ? "Testing" : "Test connection"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
