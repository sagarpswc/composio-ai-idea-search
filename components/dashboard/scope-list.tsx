"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { ToolkitScope } from "@/lib/toolkit-details";
import { Button } from "@/components/ui/button";

export function ScopeList({ scopes }: { scopes: ToolkitScope[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? scopes : scopes.slice(0, 6);
  const hasMore = scopes.length > 6;

  return (
    <div className="mt-3">
      <ul className="divide-y overflow-hidden rounded-lg border bg-background/40">
        {visible.map((scope) => (
          <li key={`${scope.name}-${scope.alwaysRequested}`} className="flex gap-3 p-3">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-medium">{scope.label}</span>
                <code className="max-w-full break-all rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-4 text-muted-foreground">
                  {scope.name}
                </code>
                {scope.alwaysRequested ? (
                  <span className="text-[10px] font-medium text-primary">
                    Always requested
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {scope.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-xs text-muted-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          {expanded
            ? "Show fewer permissions"
            : `Show all ${scopes.length} permissions`}
        </Button>
      ) : null}
    </div>
  );
}
