"use client";

import { PlugZap } from "lucide-react";
import { DisconnectDialog } from "@/components/dashboard/disconnect-dialog";
import type { DashboardApp } from "@/components/dashboard/types";
import { initials } from "@/components/dashboard/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ConnectedApps({
  apps,
  loading,
  onDisconnect,
}: {
  apps: DashboardApp[];
  loading: boolean;
  onDisconnect: (app: DashboardApp) => Promise<void>;
}) {
  return (
    <Card className="gap-0 py-0 shadow-sm">
      <CardHeader className="border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PlugZap className="size-3.5" />
          </span>
          <CardTitle className="text-sm">Connected apps</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {apps.length}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Scoped to this account only
        </CardDescription>
      </CardHeader>

      <CardContent className="p-2">
        {loading ? (
          <div className="space-y-1.5 p-1">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-2.5 p-2">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : apps.length > 0 ? (
          <div className="space-y-1">
            {apps.map((app) => (
              <div
                key={app.slug}
                className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/60"
              >
                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
                  {app.logo ? (
                    <img
                      src={app.logo}
                      alt=""
                      className="size-5 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {initials(app.name)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{app.name}</p>
                  <p className="truncate text-[10px] capitalize text-muted-foreground">
                    {app.status?.toLowerCase() ?? "Active"}
                  </p>
                </div>
                <DisconnectDialog app={app} onDisconnect={onDisconnect} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <PlugZap className="size-4" />
            </span>
            <p className="mt-3 text-xs font-medium">No apps connected yet</p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Choose an app from the catalog and authorize it with Composio.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
