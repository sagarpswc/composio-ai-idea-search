"use client";

import { useState } from "react";
import {
  Check,
  Clipboard,
  Loader2,
  Play,
  Search,
  Terminal,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ExecutionResult,
  ToolSearchItem,
  ToolSearchResponse,
} from "@/components/dashboard/types";
import { errorMessage } from "@/components/dashboard/utils";
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
import { Textarea } from "@/components/ui/textarea";

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

export function ToolPlayground() {
  const [toolQuery, setToolQuery] = useState("");
  const [toolResults, setToolResults] = useState<ToolSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [toolSlug, setToolSlug] = useState("HACKERNEWS_GET_USER");
  const [toolArgs, setToolArgs] = useState('{\n  "username": "pg"\n}');
  const [executing, setExecuting] = useState(false);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState("");
  const [copied, setCopied] = useState(false);

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
    setExecution(null);
    setExecutionError("");
    document
      .getElementById("tool-runner-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function runTool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = toolSlug.trim();

    if (!slug) {
      setExecutionError("Enter a tool slug.");
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
      const message = errorMessage(error, "Tool execution failed.");
      setExecutionError(message);
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
        <Card className="gap-3 shadow-sm">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <WandSparkles className="size-4 text-primary" />
              Find a tool
            </CardTitle>
            <CardDescription className="text-xs">
              Describe what you want to do. Composio searches every connected
              toolkit.
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
              Run any Composio tool through this account&apos;s session.
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
                    setExecution(null);
                    setExecutionError("");
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
                <Label htmlFor="tool-slug">Tool slug</Label>
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
                <Label htmlFor="tool-args">Arguments (JSON)</Label>
                <Textarea
                  id="tool-args"
                  value={toolArgs}
                  onChange={(event) => setToolArgs(event.target.value)}
                  rows={7}
                  spellCheck={false}
                  className="min-h-36 font-mono text-xs leading-5"
                />
              </div>

              <Button type="submit" disabled={executing} className="w-full">
                {executing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {executing ? "Running…" : "Run tool"}
              </Button>
            </form>

            {executionError ? (
              <Alert variant="destructive" className="mt-3">
                <TriangleAlert />
                <AlertDescription>{executionError}</AlertDescription>
              </Alert>
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
                Start with the Hacker News example. It needs no app connection
                and returns a real provider response.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
