"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  KeyRound,
  PlugZap,
  Circle,
} from "lucide-react";
import type { DashboardApp } from "@/components/dashboard/types";
import { initials } from "@/components/dashboard/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AppCard({ app }: { app: DashboardApp }) {
  const status = app.isConnected
    ? { label: "Connected", icon: CheckCircle2, className: "text-primary" }
    : app.isNoAuth
      ? { label: "No auth", icon: KeyRound, className: "text-sky-600 dark:text-sky-400" }
      : { label: "Not connected", icon: Circle, className: "text-muted-foreground" };
  const StatusIcon = status.icon;

  return (
    <Card className="group relative h-full gap-3 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20">
      <Link
        href={`/dashboard/apps/${encodeURIComponent(app.slug)}`}
        className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`View ${app.name} permissions and actions`}
      />
      <CardHeader className="pointer-events-none relative z-10 flex flex-row items-start justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
            {app.logo ? (
              // Logos are served by Composio's public logo CDN.
              <img
                src={app.logo}
                alt=""
                loading="lazy"
                className="size-7 object-contain"
              />
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">
                {initials(app.name)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{app.name}</CardTitle>
            <CardDescription className="truncate font-mono text-[11px]">
              {app.slug}
            </CardDescription>
          </div>
        </div>
        <Badge
          variant={app.isConnected ? "secondary" : "outline"}
          className={`shrink-0 gap-1 ${status.className}`}
        >
          <StatusIcon className="size-3" />
          {status.label}
        </Badge>
      </CardHeader>

      <CardContent className="pointer-events-none relative z-10 mt-auto px-4 pt-0">
        <p className="mb-3 text-xs text-muted-foreground">
          {app.isConnected
            ? "Ready to run tools in your session."
            : app.isNoAuth
              ? "Works without an account connection."
              : "Connect securely through Composio."}
        </p>

        <p className="mb-3 flex items-center gap-1 text-[11px] font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
          View permissions & actions
          <ArrowUpRight className="size-3" />
        </p>

        <div className="relative z-20 pointer-events-auto">
          {app.isConnected ? (
            <Button variant="outline" size="sm" className="w-full" disabled>
              <CheckCircle2 className="size-3.5 text-primary" />
              Connected
            </Button>
          ) : app.isNoAuth ? (
            <Button variant="secondary" size="sm" className="w-full" disabled>
              <KeyRound className="size-3.5" />
              No connection needed
            </Button>
          ) : (
            <Button size="sm" className="w-full" asChild>
              <a
                href={`/api/connect?toolkit=${encodeURIComponent(app.slug)}`}
                target="_self"
              >
                <PlugZap className="size-3.5" />
                Connect
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
