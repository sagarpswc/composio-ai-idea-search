"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import type { DashboardApp } from "@/components/dashboard/types";
import { errorMessage } from "@/components/dashboard/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DisconnectDialog({
  app,
  onDisconnect,
  trigger,
}: {
  app: DashboardApp;
  onDisconnect: (app: DashboardApp) => Promise<void>;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function disconnect() {
    setLoading(true);

    try {
      await onDisconnect(app);
      setOpen(false);
    } catch (error) {
      toast.error("Could not disconnect app", {
        description: errorMessage(error, "Please try again."),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Disconnect ${app.name}`}
            title={`Disconnect ${app.name}`}
          >
            <Unplug className="size-3.5" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {app.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the connection and its stored authorization from your
            account. Tools for {app.name} will stop working until you connect it
            again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              void disconnect();
            }}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Unplug className="size-3.5" />
            )}
            {loading ? "Disconnecting…" : "Disconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
