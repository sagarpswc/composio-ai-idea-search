"use client";

import { useState } from "react";
import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type IdeaAction = {
  slug: string;
  name: string;
  score: number;
};

type IdeaApp = {
  slug: string;
  name: string;
  score: number;
  scopeCount: number;
  scopes: string[];
  actions: IdeaAction[];
};

type IdeaResearch = {
  slug: string;
  name: string;
  score: number;
  matchedTerms: string[];
  matchedFields: string[];
  categories: string[];
  scopes: string[];
  toolsCount: number;
  actions: IdeaAction[];
  reason: string;
};

type IdeaCombination = {
  rank: number;
  score: number;
  totalScopes: number;
  apps: IdeaApp[];
  steps: string[];
};

type IdeaResponse = {
  requirement: string;
  combinations: IdeaCombination[];
  candidates: IdeaApp[];
  research?: IdeaResearch[];
  aiSteps?: string[] | null;
  aiModel?: string | null;
  note?: string;
};

export function IdeaSearch() {
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IdeaResponse | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  async function search() {
    const value = requirement.trim();
    if (!value) {
      setError("Describe the workflow you want to build.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/composio-idea-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: value, limit: 8 }),
      });
      const data = (await response.json()) as IdeaResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not search Composio ideas.");
      }

      setResult(data);
      setExpanded({});
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Could not search Composio ideas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="gap-4 shadow-sm">
        <CardHeader className="border-b">
          <div className="flex items-start gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BrainCircuit className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base">AI idea search</CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-xs leading-5">
                Describe a workflow. The search reads the local Composio cache and
                returns ranked app/tool combinations and implementation steps.
                No implementation code is returned.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void search();
              }}
              placeholder="Example: create a GitHub issue and notify Slack"
              autoComplete="off"
              className="h-9"
              aria-label="Describe a workflow for AI idea search"
            />
            <Button type="button" onClick={() => void search()} disabled={loading} className="sm:w-32">
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
              {loading ? "Searching" : "Search"}
            </Button>
          </div>

          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}

          {result?.combinations?.length ? (
            <div className="space-y-3">
              {result.combinations.map((combination) => {
                const isOpen = expanded[combination.rank] ?? combination.rank === 1;
                return (
                  <div key={combination.rank} className="rounded-xl border bg-background/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Rank {combination.rank}</Badge>
                          <Badge variant="outline" className="font-normal">
                            {combination.apps.length} app{combination.apps.length === 1 ? "" : "s"}
                          </Badge>
                          <Badge variant="outline" className="font-normal">
                            {combination.totalScopes} scopes
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm font-medium">
                          {combination.apps.map((app) => app.name).join(" + ")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded((current) => ({ ...current, [combination.rank]: !isOpen }))}
                      >
                        {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        {isOpen ? "Hide steps" : "Show steps"}
                      </Button>
                    </div>

                    {isOpen ? (
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {combination.apps.map((app) => (
                            <Badge key={app.slug} variant="outline" className="gap-1.5 font-normal">
                              <Sparkles className="size-3 text-primary" />
                              {app.name}
                              {app.actions[0] ? `: ${app.actions[0].name}` : ""}
                            </Badge>
                          ))}
                        </div>
                        <ol className="space-y-2 text-xs leading-5 text-muted-foreground">
                          {combination.steps.map((step, index) => (
                            <li key={`${combination.rank}-${index}`} className="flex gap-2.5">
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : result ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-8 text-center text-sm text-muted-foreground">
              No matching Composio apps were found for that requirement.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {result?.research?.length ? (
        <Card className="gap-4 shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Research summary</CardTitle>
                <CardDescription className="mt-1 max-w-2xl text-xs leading-5">
                  The search checked app names, descriptions, categories, scopes, and actions before ranking combinations.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.research.map((item) => (
              <div key={item.slug} className="rounded-xl border bg-background/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                  </div>
                  <Badge variant="outline" className="font-normal">
                    {item.score} match
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.matchedTerms.map((term) => (
                    <Badge key={`${item.slug}-${term}`} variant="secondary" className="font-normal">
                      {term}
                    </Badge>
                  ))}
                  {item.matchedFields.map((field) => (
                    <Badge key={`${item.slug}-field-${field}`} variant="outline" className="font-normal text-muted-foreground">
                      {field}
                    </Badge>
                  ))}
                </div>
                {item.scopes.length > 0 ? (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground">Scopes:</span> {item.scopes.join(", ")}
                  </p>
                ) : null}
                {item.actions.length > 0 ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground">Relevant actions:</span>{" "}
                    {item.actions.map((action) => action.name).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {result?.aiSteps?.length ? (
        <Card className="gap-4 shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BrainCircuit className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">AI-refined steps</CardTitle>
                <CardDescription className="mt-1 max-w-2xl text-xs leading-5">
                  {result.aiModel
                    ? `Generated by ${result.aiModel} from the local Composio cache.`
                    : "Generated from the local Composio cache."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-xs leading-5 text-muted-foreground">
              {result.aiSteps.map((step, index) => (
                <li key={`ai-${index}`} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {result?.candidates?.length ? (
        <Card className="gap-3 shadow-sm">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-primary" />
              Candidate apps
            </CardTitle>
            <CardDescription className="text-xs">
              Ranked by requirement match, then by fewer requested scopes.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <div className="flex flex-wrap gap-2">
              {result.candidates.map((candidate) => (
                <Badge
                  key={candidate.slug}
                  variant="outline"
                  className={cn("gap-1.5 font-normal", candidate.scopeCount > 0 && "border-primary/20")}
                >
                  {candidate.name}
                  <span className="text-muted-foreground">{candidate.scopeCount} scopes</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}