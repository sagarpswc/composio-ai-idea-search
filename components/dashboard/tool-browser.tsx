"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Pencil,
  Search,
  SearchX,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  ToolkitAction,
  ToolkitActionKind,
} from "@/lib/toolkit-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ACTION_STYLES: Record<
  ToolkitActionKind,
  {
    label: string;
    icon: LucideIcon;
    badge: string;
    iconWrap: string;
  }
> = {
  read: {
    label: "Read",
    icon: Search,
    badge:
      "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    iconWrap: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  create: {
    label: "Create",
    icon: CirclePlus,
    badge:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    iconWrap: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  update: {
    label: "Update",
    icon: Pencil,
    badge:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    iconWrap: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  delete: {
    label: "Delete",
    icon: Trash2,
    badge:
      "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    iconWrap: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  action: {
    label: "Action",
    icon: Wrench,
    badge: "border-border bg-muted/60 text-muted-foreground",
    iconWrap: "bg-muted text-muted-foreground",
  },
};

export function ToolBrowser({
  tools,
  total,
}: {
  tools: ToolkitAction[];
  total: number;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return tools;
    }

    return tools.filter((tool) => {
      return (
        tool.name.toLowerCase().includes(value) ||
        tool.slug.toLowerCase().includes(value) ||
        tool.description.toLowerCase().includes(value)
      );
    });
  }, [query, tools]);

  const visible = expanded ? filtered : filtered.slice(0, 9);
  const hasMore = filtered.length > 9;

  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Wrench className="size-4" />
        </span>
        <p className="mt-3 text-sm font-medium">No action preview is available</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          The app can still be connected. Composio may expose its actions
          through the session even when the public preview is unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setExpanded(false);
            }}
            placeholder="Search actions, e.g. create, list, message…"
            autoComplete="off"
            className="h-9 pl-8"
            aria-label={`Search ${total.toLocaleString()} actions`}
          />
        </div>
        <Badge
          variant="outline"
          className="h-7 shrink-0 justify-center px-2.5 text-[11px] font-normal text-muted-foreground"
        >
          {filtered.length} {filtered.length === 1 ? "action" : "actions"} found
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="size-4" />
          </span>
          <p className="mt-3 text-sm font-medium">No matching action</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a broader search term.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((tool) => {
            const style = ACTION_STYLES[tool.kind];
            const Icon = style.icon;

            return (
              <article
                key={tool.slug}
                className="group flex gap-3 rounded-xl border bg-background/50 p-3 transition-colors hover:bg-muted/35"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    style.iconWrap
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium leading-5">
                      {tool.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={cn("h-5 px-1.5 text-[10px]", style.badge)}
                    >
                      {style.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {tool.description}
                  </p>
                  <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground/75">
                    {tool.slug}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasMore ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            {expanded
              ? "Show fewer actions"
              : `Show all ${filtered.length} actions`}
          </Button>
          {expanded && total > tools.length ? (
            <p className="text-center text-[11px] text-muted-foreground">
              Showing {tools.length} highlighted actions from{" "}
              {total.toLocaleString()} total Composio actions.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
