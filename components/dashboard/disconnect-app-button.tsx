"use client";

import { useRouter } from "next/navigation";
import { Unplug } from "lucide-react";
import { toast } from "sonner";
import { DisconnectDialog } from "@/components/dashboard/disconnect-dialog";
import type { DashboardApp } from "@/components/dashboard/types";
import { errorMessage } from "@/components/dashboard/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DisconnectAppButton({
  app,
  className,
}: {
  app: DashboardApp;
  className?: string;
}) {
  const router = useRouter();

  async function disconnect(target: DashboardApp) {
    const response = await fetch("/api/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolkit: target.slug }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(data.error || errorMessage(null, "Could not disconnect the app."));
    }

    toast.success(`${target.name} disconnected`, {
      description: "The stored authorization has been removed from your account.",
    });
    router.refresh();
  }

  return (
    <DisconnectDialog
      app={app}
      onDisconnect={disconnect}
      trigger={
        <Button variant="outline" className={cn("w-full", className)}>
          <Unplug className="size-3.5" />
          Disconnect
        </Button>
      }
    />
  );
}
