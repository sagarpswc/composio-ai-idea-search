"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Loader2,
  PlugZap,
  Search,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
  Waypoints,
} from "lucide-react";
import type {
  IdeaApp,
  IdeaConnectionInfo,
  IdeaPlan,
  IdeaSearchResponse,
  PlaygroundSeed,
} from "@/components/dashboard/types";
import { errorMessage, initials } from "@/components/dashboard/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "composio-idea-search-state";

const examples = [
  "Create a GitHub issue and notify Slack",
  "Save Gmail attachments to Google Drive",
  "Add new Google Form responses to Google Sheets",
  "Send a Slack message when a GitHub issue is created",
  "Get unread Gmail emails and save a summary to Notion",
];

const roleLabels: Record<IdeaApp["role"], string> = {
  source: "Trigger",
  primary: "Primary",
  destination: "Destination",
};

const confidenceStyles: Record<IdeaPlan["confidence"], string> = {
  high: "border-primary/25 bg-primary/5 text-primary",
  medium: "border-sky-500/25 bg-sky-500/5 text-sky-700 dark:text-sky-300",
  low: "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-300",
};

function AppLogo({ app, className }: { app: IdeaApp; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40",
        className
      )}
    >
      {app.logo ? (
        // Logos are served by Composio's public logo CDN.
        <img src={app.logo} alt="" loading="lazy" className="size-6 object-contain" />
      ) : (
        <span className="text-[10px] font-semibold text-muted-foreground">
          {initials(app.name)}
        </span>
      )}
    </span>
  );
}

function AppConnectionBadge({
  app,
  connection,
}: {
  app: IdeaApp;
  connection?: IdeaConnectionInfo;
}) {
  const known = connection?.known ?? false;
  const connected = connection?.connected ?? false;
  const isNoAuth = app.isNoAuth || connection?.isNoAuth;

  if (isNoAuth) {
    return (
      <Badge variant="outline" className="gap-1 border-sky-500/25 text-sky-700 dark:text-sky-300">
        <CheckCircle2 className="size-3" />
        No auth needed
      </Badge>
    );
  }

  if (connected) {
    return (
      <Badge variant="secondary" className="gap-1 text-primary">
        <CheckCircle2 className="size-3" />
        Connected
      </Badge>
    );
  }

  if (!known) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <CircleAlert className="size-3" />
        Check on run
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
    >
      <PlugZap className="size-3" />
      Connection needed
    </Badge>
  );
}

function AppRow({
  app,
  connection,
}: {
  app: IdeaApp;
  connection?: IdeaConnectionInfo;
}) {
  const needsConnection =
    connection?.known && !connection.connected && !connection.isNoAuth && !app.isNoAuth;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <AppLogo app={app} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{app.name}</p>
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground">
              {roleLabels[app.role]}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {app.action.name}
            {app.scopeCount > 0 ? ` · ${app.scopeCount} scopes` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <AppConnectionBadge app={app} connection={connection} />
        {needsConnection ? (
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/connect?toolkit=${encodeURIComponent(app.slug)}&returnTo=ideas`}>
              <PlugZap className="size-3.5" />
              Connect
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StepCard({
  plan,
  step,
  app,
  connection,
  searchPrompt,
  onOpenPlayground,
}: {
  plan: IdeaPlan;
  step: IdeaPlan["steps"][number];
  app?: IdeaApp;
  connection?: IdeaConnectionInfo;
  searchPrompt: string;
  onOpenPlayground?: (seed: PlaygroundSeed) => void;
}) {
  const needsConnection =
    connection?.known && !connection.connected && !connection.isNoAuth && !app?.isNoAuth;

  return (
    <div className="relative rounded-xl border bg-background/70 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold text-muted-foreground">
          {step.order}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{step.actionName}</p>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {step.appName}
            </Badge>
            {app ? (
              <Badge
                variant="outline"
                className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground"
              >
                {roleLabels[app.role]}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {step.instruction}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!onOpenPlayground}
              onClick={() =>
                onOpenPlayground?.({
                  prompt: searchPrompt,
                  toolSlug: step.actionSlug,
                  autoBuild: true,
                  nonce: Date.now(),
                })
              }
            >
              <SquareTerminal className="size-3.5" />
              Open in playground
            </Button>
            {needsConnection && app ? (
              <Button size="sm" variant="ghost" asChild>
                <a href={`/api/connect?toolkit=${encodeURIComponent(app.slug)}&returnTo=ideas`}>
                  <PlugZap className="size-3.5" />
                  Connect {app.name}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  primary,
  connections,
  searchPrompt,
  onOpenPlayground,
}: {
  plan: IdeaPlan;
  primary?: boolean;
  connections?: IdeaSearchResponse["connections"];
  searchPrompt: string;
  onOpenPlayground?: (seed: PlaygroundSeed) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const connectionValues = plan.apps.map((app) => connections?.[app.slug]);
  const needsConnection = plan.apps.filter((app, index) => {
    const connection = connectionValues[index];
    return connection?.known && !connection.connected && !connection.isNoAuth && !app.isNoAuth;
  });

  const content = (
    <div className={cn("space-y-4", primary ? "p-0" : "px-4 pb-4 pt-0")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("gap-1", confidenceStyles[plan.confidence])}>
          <Sparkles className="size-3" />
          {plan.confidence === "high"
            ? "High confidence"
            : plan.confidence === "medium"
              ? "Good match"
              : "Best available"}
        </Badge>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {plan.apps.length} {plan.apps.length === 1 ? "app" : "apps"}
        </Badge>
        {plan.totalScopes > 0 ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {plan.totalScopes} scopes
          </Badge>
        ) : null}
        {!primary ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Rank #{plan.rank}
          </Badge>
        ) : null}
      </div>

      <div>
        <h3 className={cn("font-semibold tracking-[-0.02em]", primary ? "text-xl sm:text-2xl" : "text-base")}>
          {plan.title}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{plan.summary}</p>
      </div>

      <div className="grid gap-2">
        {plan.apps.map((app) => (
          <AppRow key={app.slug} app={app} connection={connections?.[app.slug]} />
        ))}
      </div>

      {needsConnection.length > 0 ? (
        <Alert className="border-amber-500/25 bg-amber-500/5 text-amber-950 dark:text-amber-100">
          <PlugZap />
          <AlertTitle>
            {needsConnection.length === 1
              ? `${needsConnection[0].name} needs a connection`
              : `${needsConnection.length} apps need connections`}
          </AlertTitle>
          <AlertDescription>
            Connect once, then return here. Your search and plan will be restored
            automatically.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        {plan.steps.map((step) => (
          <StepCard
            key={`${step.order}-${step.actionSlug}`}
            plan={plan}
            step={step}
            app={plan.apps.find((app) => app.slug === step.appSlug)}
            connection={connections?.[step.appSlug]}
            searchPrompt={searchPrompt}
            onOpenPlayground={onOpenPlayground}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          onClick={() => setShowWhy((value) => !value)}
        >
          Why this plan
          <ChevronDown className={cn("size-3.5 transition-transform", showWhy && "rotate-180")} />
        </Button>
        {plan.unmatchedTerms.length > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            Unmatched context: {plan.unmatchedTerms.join(", ")}
          </span>
        ) : null}
      </div>

      {showWhy ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          {plan.why}
        </div>
      ) : null}
    </div>
  );

  if (!primary) {
    return (
      <details className="group rounded-xl border bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 outline-none [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{plan.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {plan.apps.map((app) => app.name).join(" + ")} · {plan.totalScopes} scopes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("gap-1", confidenceStyles[plan.confidence])}>
              {plan.confidence}
            </Badge>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <Separator />
        <div className="pt-4">{content}</div>
      </details>
    );
  }

  return (
    <Card className="gap-4 border-primary/15 shadow-sm">
      <CardHeader className="gap-1 px-4 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="outline" className="gap-1.5 border-primary/20 bg-primary/5 text-primary">
            <BrainCircuit className="size-3.5" />
            Best workflow
          </Badge>
          <span className="text-[11px] text-muted-foreground">Ranked by intent, app, and action match</span>
        </div>
      </CardHeader>
      <CardContent className="px-4">{content}</CardContent>
    </Card>
  );
}

export function IdeaSearch({
  onOpenPlayground,
}: {
  onOpenPlayground?: (seed: PlaygroundSeed) => void;
}) {
  const [requirement, setRequirement] = useState("");
  const [result, setResult] = useState<IdeaSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshConnectionStatuses(current: IdeaSearchResponse) {
    try {
      const response = await fetch("/api/connections", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        items?: { slug: string; isConnected: boolean; isNoAuth: boolean; status: string | null }[];
      };
      const connections = { ...(current.connections ?? {}) };
      for (const item of data.items ?? []) {
        connections[item.slug] = {
          known: true,
          connected: item.isConnected || item.isNoAuth,
          isNoAuth: item.isNoAuth,
          status: item.status,
        };
      }
      setResult((previous) =>
        previous ? { ...previous, connections } : previous
      );
    } catch {
      // The saved result is still usable when the live check is unavailable.
    }
  }

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as { requirement?: unknown; result?: unknown };
      if (typeof stored.requirement !== "string" || !stored.result) return;
      const restored = stored.result as IdeaSearchResponse;
      if (!restored.best) return;
      setRequirement(stored.requirement);
      setResult(restored);
      void refreshConnectionStatuses(restored);
    } catch {
      // Ignore malformed saved state.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!result) return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ requirement, result })
      );
    } catch {
      // Storage can be unavailable in private contexts.
    }
  }, [requirement, result]);

  async function runSearch(prompt: string) {
    const next = prompt.trim();
    if (!next || loading) return;

    setRequirement(next);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/composio-idea-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: next, limit: 4 }),
      });
      const data = (await response.json()) as IdeaSearchResponse;

      if (!response.ok) {
        throw new Error(data.error || "Idea search failed.");
      }

      setResult(data);
    } catch (searchError) {
      setResult(null);
      setError(errorMessage(searchError, "Idea search failed."));
    } finally {
      setLoading(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(requirement);
  }

  return (
    <div className="space-y-4">
      <Card className="gap-3 shadow-sm">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BrainCircuit className="size-4 text-primary" />
            AI idea search
          </CardTitle>
          <CardDescription className="text-xs">
            Describe an outcome. Get a ranked, human-readable workflow with the
            best Composio apps and actions — never code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={requirement}
                onChange={(event) => setRequirement(event.target.value)}
                placeholder="Create a GitHub issue and send a summary to Slack…"
                className="h-10 pl-9"
                aria-label="Describe the workflow you want"
              />
            </div>
            <Button type="submit" disabled={loading || !requirement.trim()} className="h-10 sm:px-5">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {loading ? "Building plan…" : "Find workflow"}
            </Button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void runSearch(example)}
                className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/25 hover:bg-primary/5 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>

          {result?.interpretation ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                <Waypoints className="size-3.5" />
                Understood as
              </span>
              {result.interpretation.apps.map((app) => (
                <Badge key={`app-${app}`} variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                  {app}
                </Badge>
              ))}
              {result.interpretation.intents.map((intent) => (
                <Badge key={`intent-${intent}`} variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                  {intent}
                </Badge>
              ))}
              {result.interpretation.objects.slice(0, 5).map((object) => (
                <span key={`object-${object}`} className="rounded-full border px-1.5 py-0.5">
                  {object}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Could not build a plan</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !result ? (
        <Card className="gap-4 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-primary" />
            Reading the catalog and ranking actions…
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl border bg-muted/30" />
            ))}
          </div>
        </Card>
      ) : null}

      {!loading && result?.best ? (
        <>
          <PlanCard
            plan={result.best}
            primary
            connections={result.connections}
            searchPrompt={requirement}
            onOpenPlayground={onOpenPlayground}
          />

          {result.alternatives.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Other strong options
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {result.alternatives.length} alternative
                  {result.alternatives.length === 1 ? "" : "s"}
                </span>
              </div>
              {result.alternatives.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  connections={result.connections}
                  searchPrompt={requirement}
                  onOpenPlayground={onOpenPlayground}
                />
              ))}
            </div>
          ) : null}

          <p className="px-1 text-[11px] leading-5 text-muted-foreground">{result.note}</p>
        </>
      ) : null}

      {!loading && result && !result.best ? (
        <Card className="border-dashed bg-card/50 shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="size-5" />
            </span>
            <p className="mt-4 text-sm font-medium">No strong workflow found</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              {result.note}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !result && !error ? (
        <Card className="border-dashed bg-card/50 shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <p className="mt-4 text-sm font-medium">Start with the outcome, not the tool</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              Try “create a GitHub issue and notify Slack” or “save Gmail
              attachments to Google Drive”. The planner will choose the apps,
              actions, and order for you.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {examples.slice(0, 3).map((example) => (
                <Button
                  key={example}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runSearch(example)}
                >
                  {example}
                  <ArrowRight className="size-3.5" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
