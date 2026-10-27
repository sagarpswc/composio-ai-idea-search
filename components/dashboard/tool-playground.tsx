"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  KeyRound,
  Loader2,
  Play,
  PlugZap,
  Search,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Terminal,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ExecutionResult,
  PlaygroundSeed,
  PlaygroundSetup,
  ToolSearchItem,
  ToolSearchResponse,
} from "@/components/dashboard/types";
import { errorMessage, initials, prettyName } from "@/components/dashboard/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const RESTORE_KEY = "composio-playground-restore";

const examples = [
  {
    label: "Hacker News",
    detail: "No auth",
    slug: "HACKERNEWS_GET_USER",
    args: '{\n  "username": "pg"\n}',
  },
  {
    label: "Gmail profile",
    detail: "Connect first",
    slug: "GMAIL_GET_PROFILE",
    args: '{\n  "user_id": "me"\n}',
  },
  {
    label: "GitHub profile",
    detail: "Connect first",
    slug: "GITHUB_GET_THE_AUTHENTICATED_USER",
    args: "{}",
  },
  {
    label: "Slack auth test",
    detail: "Connect first",
    slug: "SLACK_TEST_AUTH",
    args: "{}",
  },
];

const aiExamples = [
  "Send “Standup starts in 10 minutes” to #general on Slack",
  "Create a GitHub issue titled “Login bug” in acme/app",
  "Get my unread Gmail emails",
  "Add a row to Google Sheets",
];

type ConnectionIssue = {
  appName: string;
  appSlug: string | null;
  message: string;
};

function rememberRestore(prompt: string, toolSlug: string) {
  try {
    window.sessionStorage.setItem(
      RESTORE_KEY,
      JSON.stringify({ prompt, toolSlug, nonce: Date.now() })
    );
  } catch {
    // The connect flow still works when session storage is unavailable.
  }
}

function AppMark({ setup }: { setup: PlaygroundSetup }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background">
      {setup.toolkit.logo ? (
        // Logos are served by Composio's public logo CDN.
        <img
          src={setup.toolkit.logo}
          alt=""
          loading="lazy"
          className="size-6 object-contain"
        />
      ) : (
        <span className="text-[10px] font-semibold text-muted-foreground">
          {initials(setup.toolkit.name)}
        </span>
      )}
    </span>
  );
}

function ConnectionNotice({
  setup,
  onConnect,
}: {
  setup: PlaygroundSetup;
  onConnect: () => void;
}) {
  if (setup.connection.isNoAuth) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs leading-5 text-sky-900 dark:text-sky-100">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <p>
          <span className="font-medium">No connection required.</span> This
          action is available without an app account.
        </p>
      </div>
    );
  }

  if (setup.connection.connected) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-foreground">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          <span className="font-medium">
            {setup.toolkit.name} is connected.
          </span>{" "}
          Review the JSON, then run the tool below.
        </p>
      </div>
    );
  }

  if (!setup.connection.known) {
    return (
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Connection status could not be checked. If the app is not connected,
          Composio will ask you to connect it before the tool can run.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-background to-background">
      <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start">
        <AppMark setup={setup} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            >
              <PlugZap className="size-3" />
              Connection required
            </Badge>
            <span className="text-xs font-medium">{setup.toolkit.name}</span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            This action runs with your own {setup.toolkit.name} account.
            Composio keeps the connection scoped to this session; your
            credentials are never shared with other users.
          </p>
          {setup.toolkit.scopeCount > 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Requests {setup.toolkit.scopeCount} permission
              {setup.toolkit.scopeCount === 1 ? "" : "s"} when you connect.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <a
                href={`/api/connect?toolkit=${encodeURIComponent(setup.toolkit.slug)}&returnTo=playground`}
                onClick={onConnect}
              >
                <PlugZap className="size-3.5" />
                Connect {setup.toolkit.name}
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`/dashboard/apps/${encodeURIComponent(setup.toolkit.slug)}`}>
                <ShieldCheck className="size-3.5" />
                View permissions
              </a>
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            After connecting, you will return here with this setup restored.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectionIssueNotice({
  issue,
  prompt,
  toolSlug,
  onDismiss,
}: {
  issue: ConnectionIssue;
  prompt: string;
  toolSlug: string;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2">
        <PlugZap className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">
            {issue.appSlug
              ? `${issue.appName} needs a connection`
              : "A connection may be required"}
          </p>
          <p className="mt-1 break-words text-[11px] leading-5 text-muted-foreground">
            {issue.message}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {issue.appSlug ? (
              <Button size="sm" asChild>
                <a
                  href={`/api/connect?toolkit=${encodeURIComponent(issue.appSlug)}&returnTo=playground`}
                  onClick={() => rememberRestore(prompt, toolSlug)}
                >
                  <PlugZap className="size-3.5" />
                  Connect {issue.appName}
                </a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <a href="/dashboard">
                  <Search className="size-3.5" />
                  Browse apps
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToolPlayground({
  initialSetup,
}: {
  initialSetup?: PlaygroundSeed | null;
}) {
  const [toolQuery, setToolQuery] = useState("");
  const [toolResults, setToolResults] = useState<ToolSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [setup, setSetup] = useState<PlaygroundSetup | null>(null);

  const [toolSlug, setToolSlug] = useState("HACKERNEWS_GET_USER");
  const [toolArgs, setToolArgs] = useState('{\n  "username": "pg"\n}');
  const [executing, setExecuting] = useState(false);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState("");
  const [connectionIssue, setConnectionIssue] = useState<ConnectionIssue | null>(null);
  const [copied, setCopied] = useState(false);
  const [setupCopied, setSetupCopied] = useState(false);

  const lastSeedRef = useRef<number | null>(null);
  const restoreRef = useRef(false);

  const activeSetup =
    setup && setup.toolSlug === toolSlug.trim() ? setup : null;
  const blockedByConnection = Boolean(
    activeSetup &&
      activeSetup.connection.known &&
      !activeSetup.connection.connected &&
      !activeSetup.connection.isNoAuth
  );

  async function buildSetup(promptOverride?: string, toolSlugOverride?: string) {
    const nextPrompt = (promptOverride ?? prompt).trim();
    const nextToolSlug = toolSlugOverride?.trim() || undefined;

    if (!nextPrompt) {
      setBuildError("Describe the tool call you want to build.");
      return;
    }

    setBuilding(true);
    setBuildError("");
    setSetup(null);
    setConnectionIssue(null);

    try {
      const response = await fetch("/api/composio-playground-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: nextPrompt,
          ...(nextToolSlug ? { toolSlug: nextToolSlug } : {}),
        }),
      });
      const data = (await response.json()) as PlaygroundSetup & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not build a playground setup.");
      }

      setSetup(data);
      setPrompt(data.prompt);
      setToolSlug(data.toolSlug);
      setToolArgs(data.json);
      setExecution(null);
      setExecutionError("");
      setConnectionIssue(null);
    } catch (error) {
      setBuildError(errorMessage(error, "Could not build a playground setup."));
    } finally {
      setBuilding(false);
    }
  }

  useEffect(() => {
    if (restoreRef.current) return;
    restoreRef.current = true;

    try {
      const raw = window.sessionStorage.getItem(RESTORE_KEY);
      if (!raw) return;
      window.sessionStorage.removeItem(RESTORE_KEY);
      const seed = JSON.parse(raw) as Partial<PlaygroundSeed>;
      if (typeof seed.prompt !== "string" || typeof seed.toolSlug !== "string") {
        return;
      }

      setPrompt(seed.prompt);
      setToolSlug(seed.toolSlug);
      setToolArgs("{}");
      void buildSetup(seed.prompt, seed.toolSlug);
    } catch {
      // Ignore malformed restore state.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialSetup || lastSeedRef.current === initialSetup.nonce) {
      return;
    }

    lastSeedRef.current = initialSetup.nonce;
    setPrompt(initialSetup.prompt);
    setToolSlug(initialSetup.toolSlug);
    setToolArgs("{}");
    setExecution(null);
    setExecutionError("");
    setConnectionIssue(null);
    setSetup(null);

    if (initialSetup.autoBuild !== false) {
      void buildSetup(initialSetup.prompt, initialSetup.toolSlug);
    }

    window.setTimeout(() => {
      document
        .getElementById("playground-ai")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSetup]);

  async function searchTools(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = toolQuery.trim();

    if (!query) {
      return;
    }

    setSearching(true);
    setSearchError("");
    setToolResults([]);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await response.json()) as ToolSearchResponse;

      if (!response.ok) {
        throw new Error(data.error || "Tool search failed.");
      }

      const tools = data.tools ?? [];
      setToolResults(tools);

      if (tools.length === 0) {
        setSearchError("No tools matched. Try a more specific use case.");
      }
    } catch (error) {
      setSearchError(errorMessage(error, "Tool search failed."));
    } finally {
      setSearching(false);
    }
  }

  function selectTool(tool: ToolSearchItem) {
    setToolSlug(tool.slug);
    setToolArgs("{}");
    setSetup(null);
    setExecution(null);
    setExecutionError("");
    setConnectionIssue(null);
    document
      .getElementById("tool-runner-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function applySetup() {
    if (!setup) return;
    setToolSlug(setup.toolSlug);
    setToolArgs(setup.json);
    setExecution(null);
    setExecutionError("");
    document
      .getElementById("tool-runner-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copySetupJson() {
    if (!setup) return;

    try {
      await navigator.clipboard.writeText(setup.json);
      setSetupCopied(true);
      toast.success("JSON copied");
      window.setTimeout(() => setSetupCopied(false), 1500);
    } catch {
      toast.error("Could not copy the JSON");
    }
  }

  async function runTool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = toolSlug.trim();

    if (!slug) {
      setExecutionError("Enter a tool slug.");
      return;
    }

    if (blockedByConnection) {
      setConnectionIssue({
        appName: activeSetup?.toolkit.name ?? "This app",
        appSlug: activeSetup?.toolkit.slug ?? null,
        message: "Connect the app before running this tool. Your generated JSON will be preserved.",
      });
      document
        .getElementById("tool-runner-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    let parsedArgs: unknown;

    try {
      parsedArgs = toolArgs.trim() ? JSON.parse(toolArgs) : {};
    } catch {
      setExecutionError("Arguments must be valid JSON.");
      return;
    }

    if (
      typeof parsedArgs !== "object" ||
      parsedArgs === null ||
      Array.isArray(parsedArgs)
    ) {
      setExecutionError("Arguments must be a JSON object.");
      return;
    }

    setExecuting(true);
    setExecution(null);
    setExecutionError("");
    setConnectionIssue(null);

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolSlug: slug,
          arguments: parsedArgs,
        }),
      });
      const data = (await response.json()) as ExecutionResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Tool execution failed.");
      }

      setExecution(data);

      if (data.resultType === "completed") {
        toast.success("Tool call completed", {
          description: `Composio log ${data.logId}`,
        });
      } else {
        toast.error("Tool call failed", {
          description: data.error || "Check the execution result.",
        });
      }
    } catch (error) {
      let message = errorMessage(error, "Tool execution failed.");
      if (/meta tool|ToolRouterV2_BadRequest|Cannot execute meta tool/i.test(message)) {
        message =
          "This is a Composio management tool and cannot be run directly. Choose an app action from the catalog or rebuild the setup with a specific app.";
      }
      setExecutionError(message);

      if (/connect|connection|auth|credential|oauth|account|permission/i.test(message)) {
        setConnectionIssue({
          appName: activeSetup?.toolkit.name ?? prettyName(slug.split("_")[0] ?? "app"),
          appSlug: activeSetup?.toolkit.slug ?? null,
          message:
            "Composio could not use an active connection for this action. Connect the app, then return to this setup and run it again.",
        });
      }

      toast.error("Tool call failed", { description: message });
    } finally {
      setExecuting(false);
    }
  }

  async function copyLogId() {
    if (!execution?.logId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(execution.logId);
      setCopied(true);
      toast.success("Log ID copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the log ID");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <Card id="playground-ai" className="gap-3 shadow-sm">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <WandSparkles className="size-4 text-primary" />
              Build a tool call with AI
            </CardTitle>
            <CardDescription className="text-xs">
              Describe the call in plain English. The playground finds the best
              Composio action, loads its schema, and prepares JSON arguments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void buildSetup();
              }}
              className="space-y-2.5"
            >
              <div className="relative">
                <Sparkles className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Send a message to #general on Slack saying the deploy is live…"
                  rows={3}
                  className="min-h-24 resize-y pl-9 text-sm leading-6"
                  aria-label="Describe the tool call you want to build"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {aiExamples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/25 hover:bg-primary/5 hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={building || !prompt.trim()} className="min-w-36">
                  {building ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <WandSparkles className="size-3.5" />
                  )}
                  {building ? "Building JSON…" : "Build JSON"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  The setup is written into the runner below — nothing runs
                  automatically.
                </span>
              </div>
            </form>

            {buildError ? (
              <Alert variant="destructive" className="overflow-hidden">
                <TriangleAlert />
                <AlertDescription className="break-words whitespace-pre-wrap">
                  {buildError}
                </AlertDescription>
              </Alert>
            ) : null}

            {building ? (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  Matching the request to a catalog action…
                </div>
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ) : null}

            {setup ? (
              <div className="space-y-3 rounded-xl border bg-muted/15 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <AppMark setup={setup} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "gap-1",
                            setup.source === "ai" ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {setup.source === "ai" ? (
                            <Sparkles className="size-3" />
                          ) : (
                            <SquareTerminal className="size-3" />
                          )}
                          {setup.source === "ai" ? "AI filled JSON" : "Schema template"}
                        </Badge>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                          {setup.toolkit.name}
                        </Badge>
                        {setup.model ? (
                          <span className="truncate text-[10px] text-muted-foreground">
                            {setup.model}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium">{setup.toolName}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-primary">
                        {setup.toolSlug}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={applySetup}
                    className="shrink-0"
                  >
                    <ArrowRight className="size-3.5" />
                    Use setup
                  </Button>
                </div>

                <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
                  {setup.description}
                </p>

                {setup.requiredFields.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Required fields
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {setup.requiredFields.slice(0, 8).map((field) => (
                        <Badge
                          key={field.name}
                          variant="outline"
                          className="font-mono text-[10px] font-normal"
                          title={field.description || field.name}
                        >
                          {field.name}
                        </Badge>
                      ))}
                      {setup.requiredFields.length > 8 ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          +{setup.requiredFields.length - 8} more
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <p className="text-[11px] leading-5 text-muted-foreground">
                  {setup.reasoning}
                </p>

                {setup.warning ? (
                  <Alert>
                    <CircleAlert />
                    <AlertDescription>{setup.warning}</AlertDescription>
                  </Alert>
                ) : null}

                <ConnectionNotice
                  setup={setup}
                  onConnect={() => rememberRestore(setup.prompt, setup.toolSlug)}
                />

                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copySetupJson()}
                  >
                    {setupCopied ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <Clipboard className="size-3.5" />
                    )}
                    {setupCopied ? "Copied" : "Copy JSON"}
                  </Button>
                  {setup.alternatives.length > 0 ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Other tools:</span>
                      {setup.alternatives.slice(0, 3).map((alternative) => (
                        <button
                          key={alternative.slug}
                          type="button"
                          onClick={() =>
                            void buildSetup(setup.prompt, alternative.slug)
                          }
                          className="max-w-full truncate rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground"
                          title={`${alternative.name} · ${alternative.toolkitName}`}
                        >
                          {alternative.toolkitName}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="gap-3 shadow-sm">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Search className="size-4 text-primary" />
              Find a tool
            </CardTitle>
            <CardDescription className="text-xs">
              Search the full Composio action catalog without generating JSON.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <form onSubmit={searchTools} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={toolQuery}
                  onChange={(event) => setToolQuery(event.target.value)}
                  placeholder="list my unread emails"
                  autoComplete="off"
                  className="pl-8"
                />
              </div>
              <Button type="submit" variant="outline" disabled={searching}>
                {searching ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                Search
              </Button>
            </form>

            {searchError ? (
              <p className="mt-3 text-xs text-destructive">{searchError}</p>
            ) : null}

            {toolResults.length > 0 ? (
              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                {toolResults.map((tool) => (
                  <button
                    type="button"
                    key={tool.slug}
                    onClick={() => selectTool(tool)}
                    className="w-full rounded-lg border bg-background/60 p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/60"
                  >
                    <span className="block truncate font-mono text-[11px] font-medium text-primary">
                      {tool.slug}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                      {tool.description || "No description"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card id="tool-runner-form" className="gap-3 shadow-sm">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Play className="size-4 text-primary" />
              Run a tool
            </CardTitle>
            <CardDescription className="text-xs">
              The generated setup appears here. Review the JSON before running.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <div className="mb-4 flex flex-wrap gap-1.5">
              {examples.map((example) => (
                <Button
                  key={example.slug}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="gap-1"
                  onClick={() => {
                    setToolSlug(example.slug);
                    setToolArgs(example.args);
                    setSetup(null);
                    setExecution(null);
                    setExecutionError("");
                    setConnectionIssue(null);
                  }}
                >
                  {example.label}
                  <span className="text-muted-foreground">
                    · {example.detail}
                  </span>
                </Button>
              ))}
            </div>

            <form onSubmit={runTool} className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="tool-slug">Tool slug</Label>
                  {activeSetup ? (
                    <Badge variant="secondary" className="gap-1 text-[10px] text-primary">
                      <Sparkles className="size-3" />
                      AI setup
                    </Badge>
                  ) : null}
                </div>
                <Input
                  id="tool-slug"
                  value={toolSlug}
                  onChange={(event) => setToolSlug(event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="tool-args">Arguments (JSON)</Label>
                  {activeSetup?.requiredFields.length ? (
                    <span className="text-[10px] text-muted-foreground">
                      Required: {activeSetup.requiredFields.map((field) => field.name).join(", ")}
                    </span>
                  ) : null}
                </div>
                <Textarea
                  id="tool-args"
                  value={toolArgs}
                  onChange={(event) => setToolArgs(event.target.value)}
                  rows={7}
                  spellCheck={false}
                  className="min-h-36 font-mono text-xs leading-5"
                />
              </div>

              <Button
                type="submit"
                disabled={executing || blockedByConnection}
                className="w-full"
              >
                {executing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : blockedByConnection ? (
                  <PlugZap className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {executing
                  ? "Running…"
                  : blockedByConnection
                    ? `Connect ${activeSetup?.toolkit.name ?? "app"} to run`
                    : "Run tool"}
              </Button>
              {blockedByConnection ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  This action needs a connection first. Use the connection card above.
                </p>
              ) : null}
            </form>

            {executionError ? (
              <Alert variant="destructive" className="mt-3 overflow-hidden">
                <TriangleAlert />
                <AlertDescription className="break-words whitespace-pre-wrap">
                  {executionError}
                </AlertDescription>
              </Alert>
            ) : null}

            {connectionIssue ? (
              <div className="mt-3">
                <ConnectionIssueNotice
                  issue={connectionIssue}
                  prompt={prompt}
                  toolSlug={toolSlug}
                  onDismiss={() => setConnectionIssue(null)}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="flex min-h-[480px] flex-col gap-0 py-0 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b px-4 py-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Terminal className="size-4 text-primary" />
              Execution result
            </CardTitle>
            <CardDescription className="text-xs">
              Provider response and Composio log ID
            </CardDescription>
          </div>
          {execution ? (
            <Badge
              variant={execution.resultType === "completed" ? "secondary" : "destructive"}
              className="gap-1"
            >
              {execution.resultType === "completed" ? (
                <Check className="size-3" />
              ) : (
                <TriangleAlert className="size-3" />
              )}
              {execution.resultType}
            </Badge>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-1 flex-col p-4">
          {execution ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="max-w-full gap-1 font-mono text-[10px]">
                  <span className="truncate">log {execution.logId}</span>
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => void copyLogId()}
                >
                  {copied ? (
                    <Check className="size-3 text-primary" />
                  ) : (
                    <Clipboard className="size-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              {execution.error ? (
                <Alert variant="destructive" className="mb-3">
                  <TriangleAlert />
                  <AlertDescription>{execution.error}</AlertDescription>
                </Alert>
              ) : null}

              <Separator className="mb-3" />

              <pre className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-5">
                {JSON.stringify(execution.data, null, 2)}
              </pre>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground ring-1">
                <Terminal className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium">No execution yet</p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                Build a setup from a prompt, review the JSON, then run it. The
                Hacker News example works without connecting an app.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
