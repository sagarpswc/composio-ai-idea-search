import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AppNotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Brand href="/dashboard" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              App not found
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              This app is not in the live Composio catalog, or its slug has
              changed. Browse the catalog to find the current toolkit.
            </p>
            <Button className="mt-5" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="size-3.5" />
                Back to all apps
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
