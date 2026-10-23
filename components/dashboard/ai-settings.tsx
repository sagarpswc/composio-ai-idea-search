"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Settings, TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
              <Label htmlFor="ai-provider">Provider</Label>
              <select
                id="ai-provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value as Provider)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {PROVIDERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4o-mini, claude-3-5-sonnet, grok-2, qwen2.5:0.5b…"
                autoComplete="off"
                className="h-9"
              />
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
