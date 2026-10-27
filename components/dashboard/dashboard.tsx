"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  BrainCircuit,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  ExternalLink,
  LayoutGrid,
  LockKeyhole,
  LogOut,
  PlugZap,
  RefreshCw,
  Search,
  SearchX,
  ShieldCheck,
  SquareTerminal,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { AppCard } from "@/components/dashboard/app-card";
import { ConnectedApps } from "@/components/dashboard/connected-apps";
import { StatCard } from "@/components/dashboard/stat-card";
import { ToolPlayground } from "@/components/dashboard/tool-playground";
import { AiSettings } from "@/components/dashboard/ai-settings";
import { IdeaSearch } from "@/components/dashboard/idea-search";
import type {
  CatalogResponse,
  ConnectionsResponse,
  DashboardApp,
  PlaygroundSeed,
} from "@/components/dashboard/types";
import {
  errorMessage,
  initials,
  prettyName,
} from "@/components/dashboard/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InteractiveGrid } from "@/components/ui/interactive-grid";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 48;

type DashboardUser = {
  id: string;
  email: string;
};

export function Dashboard({ user }: { user: DashboardUser }) {
  const router = useRouter();
  const [apps, setApps] = useState<DashboardApp[]>([]);
  const [connectedApps, setConnectedApps] = useState<DashboardApp[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "connected">("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageCursors = useRef<(string | null)[]>([null]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("catalog");
  const [playgroundSeed, setPlaygroundSeed] = useState<PlaygroundSeed | null>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (
      requested === "catalog" ||
      requested === "playground" ||
      requested === "ideas" ||
      requested === "ai-settings"
    ) {
      setActiveTab(requested);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const already = params.get("already");
    const noauth = params.get("noauth");
    const connectError = params.get("connectError");

    if (!connected && !already && !noauth && !connectError) {
      return;
    }

    if (connectError) {
      toast.error("Could not connect app", { description: connectError });
    } else if (noauth) {
      toast.info(`${prettyName(noauth)} needs no connection`);
    } else if (already) {
      toast.info(`${prettyName(already)} is already connected`);
    } else if (connected) {
      toast.success(`${prettyName(connected)} connected`, {
        description:
          "Composio can take a few seconds to activate the connection. The catalog will refresh automatically.",
      });
    }

    params.delete("connected");
    params.delete("already");
    params.delete("noauth");
    params.delete("connectError");
    const nextUrl = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    window.history.replaceState({}, "", nextUrl);

    if (connected || already || noauth) {
      setRefreshKey((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      setLoading(true);
      setCatalogError("");
      setApps([]);
      setCursor(null);
      setPage(1);
      pageCursors.current = [null];

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });

        if (debouncedQuery) {
          params.set("search", debouncedQuery);
        }

        if (filter === "connected") {
          params.set("connected", "true");
        }

        const response = await fetch(`/api/toolkits?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as CatalogResponse;

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Could not load the app catalog.");
        }

        pageCursors.current = [null, data.nextCursor ?? null];
        setApps(data.items);
        setCursor(data.nextCursor);
        setTotalPages(data.totalPages);
        setPage(1);

        if (!debouncedQuery && filter === "all") {
          setCatalogTotal(data.totalPages * data.pageSize);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCatalogError(
          errorMessage(error, "Could not load the app catalog.")
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, [debouncedQuery, filter, refreshKey, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadConnections() {
      setConnectionsLoading(true);

      try {
        const response = await fetch("/api/connections", {
          cache: "no-store",
        });
        const data = (await response.json()) as ConnectionsResponse;

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "Could not load connected apps.");
        }

        if (!cancelled) {
          setConnectedApps(data.items);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("Could not load connected apps", {
            description: errorMessage(error, "Please refresh the page."),
          });
        }
      } finally {
        if (!cancelled) {
          setConnectionsLoading(false);
        }
      }
    }

    void loadConnections();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, router]);

  async function goToPage(targetPage: number) {
    if (targetPage < 1 || targetPage > totalPages || targetPage === page || paging) {
      return;
    }

    const targetCursor = targetPage === 1 ? null : pageCursors.current[targetPage - 1];

    if (targetPage > 1 && !targetCursor) {
      return;
    }

    setPaging(true);

    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });

      if (targetCursor) {
        params.set("cursor", targetCursor);
      }

      if (debouncedQuery) {
        params.set("search", debouncedQuery);
      }

      if (filter === "connected") {
        params.set("connected", "true");
      }

      const response = await fetch(`/api/toolkits?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as CatalogResponse;

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Could not load that page of apps.");
      }

      pageCursors.current[targetPage] = data.nextCursor ?? null;
      setApps(data.items);
      setCursor(data.nextCursor);
      setPage(targetPage);
      setTotalPages(data.totalPages);
    } catch (error) {
      toast.error("Could not load that page", {
        description: errorMessage(error, "Please try again."),
      });
    } finally {
      setPaging(false);
    }
  }

  async function disconnectApp(app: DashboardApp) {
    const response = await fetch("/api/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolkit: app.slug }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(data.error || "Could not disconnect the app.");
    }

    toast.success(`${app.name} disconnected`);
    setRefreshKey((value) => value + 1);
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function changeTab(value: string) {
    setActiveTab(value);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.replaceState({}, "", url);
    } catch {
      // The tab still changes when history updates are unavailable.
    }
  }

  const refreshing = loading || connectionsLoading;
  const estimatedApps = catalogTotal
    ? `~${catalogTotal.toLocaleString()}`
    : "—";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Brand href="/dashboard" />
          <Separator
            orientation="vertical"
            className="mx-1 hidden h-6 sm:block"
          />
          <Badge
            variant="outline"
            className="hidden gap-1.5 border-primary/20 bg-primary/5 text-primary sm:inline-flex"
          >
            <LockKeyhole className="size-3" />
            Per-account session
          </Badge>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="hidden md:inline-flex"
            >
              <Link
                href="https://docs.composio.dev"
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen className="size-3.5" />
                Docs
              </Link>
            </Button>
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 gap-2 px-1.5"
                  aria-label="Account menu"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-36 truncate text-sm font-medium sm:block">
                    {user.email}
                  </span>
                  <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
                  <span className="text-xs font-normal text-muted-foreground">
                    Signed in as
                  </span>
                  <span className="truncate text-sm font-medium">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="https://dashboard.composio.dev"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    Composio dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="https://docs.composio.dev"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <BookOpen className="size-4" />
                    Documentation
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void logout()}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden"
        >
          <div className="absolute left-1/2 top-0 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <section className="relative isolate overflow-hidden rounded-2xl border bg-card/60 p-5 shadow-sm backdrop-blur sm:p-6">
          <InteractiveGrid
            cellSize={48}
            className="z-0 text-primary/60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_82%)]"
          />
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-primary/20 bg-primary/5 text-primary"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                  Isolated Composio session
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Signed in as {user.email}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Your connections
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Connect any app from Composio&apos;s live catalog. Every
                connection and tool call stays attached to this account&apos;s
                session.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw
                  className={cn("size-3.5", refreshing && "animate-spin")}
                />
                Refresh
              </Button>
              <Button size="sm" asChild>
                <a href="#catalog">
                  <Search className="size-3.5" />
                  Browse apps
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={Boxes}
            label="Apps available"
            value={estimatedApps}
            hint="Live Composio catalog"
            accent
          />
          <StatCard
            icon={PlugZap}
            label="Connected apps"
            value={String(connectedApps.length)}
            hint="Scoped to this account"
          />
          <StatCard
            icon={ShieldCheck}
            label="Session"
            value="Isolated"
            hint={`User ${user.id.slice(0, 8)}…`}
          />
        </section>

        <div
          id="catalog"
          className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div className="min-w-0">
            <Tabs value={activeTab} onValueChange={changeTab}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="h-9">
                  <TabsTrigger value="catalog">
                    <LayoutGrid className="size-3.5" />
                    App catalog
                  </TabsTrigger>
                  <TabsTrigger value="playground">
                    <SquareTerminal className="size-3.5" />
                    Tool playground
                  </TabsTrigger>
                  <TabsTrigger value="ideas">
                    <BrainCircuit className="size-3.5" />
                    AI idea search
                  </TabsTrigger>
                  <TabsTrigger value="ai-settings">
                    <Settings className="size-3.5" />
                    AI settings
                  </TabsTrigger>
                </TabsList>
                <span className="text-[11px] text-muted-foreground">
                  {filter === "connected"
                    ? `${connectedApps.length} connected`
                    : `${apps.length} in view`}{" "}
                  · page {page} of {totalPages}
                </span>
              </div>

              <TabsContent value="catalog" className="mt-4 space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search Gmail, Slack, Notion, Jira…"
                      autoComplete="off"
                      className="h-9 pl-8"
                      aria-label="Search the app catalog"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={filter === "all" ? "secondary" : "ghost"}
                      onClick={() => setFilter("all")}
                    >
                      <LayoutGrid className="size-3.5" />
                      All apps
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        filter === "connected" ? "secondary" : "ghost"
                      }
                      onClick={() => setFilter("connected")}
                    >
                      <PlugZap className="size-3.5" />
                      Connected
                      <Badge
                        variant="outline"
                        className="ml-0.5 h-4 px-1 text-[10px]"
                      >
                        {connectedApps.length}
                      </Badge>
                    </Button>
                  </div>
                </div>

                {catalogError ? (
                  <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertDescription>{catalogError}</AlertDescription>
                  </Alert>
                ) : null}

                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Card key={index} className="gap-3 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-11 rounded-xl" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-2/3" />
                            <Skeleton className="h-2.5 w-1/3" />
                          </div>
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                        <Skeleton className="mt-6 h-8 w-full rounded-lg" />
                      </Card>
                    ))}
                  </div>
                ) : apps.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {apps.map((app) => (
                      <AppCard key={app.slug} app={app} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <SearchX className="size-5" />
                    </span>
                    <p className="mt-4 text-sm font-medium">
                      {filter === "connected"
                        ? "No connected apps yet"
                        : `No apps matched “${debouncedQuery}”`}
                    </p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                      {filter === "connected"
                        ? "Connect an app from the catalog to see it here."
                        : "Try a shorter search, or clear the field to browse the full catalog."}
                    </p>
                    {filter === "connected" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setFilter("all")}
                      >
                        Browse all apps
                      </Button>
                    ) : null}
                  </div>
                )}

                {!loading && totalPages > 1 ? (
                  <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
                    <p className="text-xs text-muted-foreground">
                      Showing page {page} of {totalPages} · {apps.length} apps
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || paging}
                        onClick={() => void goToPage(page - 1)}
                      >
                        <ChevronLeft className="size-3.5" />
                        Previous
                      </Button>
                      <span className="min-w-20 text-center text-xs text-muted-foreground">
                        {paging ? "Loading…" : `Page ${page}`}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!cursor || paging || page >= totalPages}
                        onClick={() => void goToPage(page + 1)}
                      >
                        Next
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="playground" className="mt-4">
                <ToolPlayground initialSetup={playgroundSeed} />
              </TabsContent>

              <TabsContent value="ideas" className="mt-4">
                <IdeaSearch
                  onOpenPlayground={(seed) => {
                    setPlaygroundSeed(seed);
                    changeTab("playground");
                  }}
                />
              </TabsContent>

              <TabsContent value="ai-settings" className="mt-4">
                <AiSettings />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <ConnectedApps
              apps={connectedApps}
              loading={connectionsLoading}
              onDisconnect={disconnectApp}
            />

            <Card className="gap-3 shadow-sm">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="size-4 text-primary" />
                  Session isolation
                </CardTitle>
                <CardDescription className="text-xs">
                  Connections stay attached to this account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Account</span>
                  <span className="max-w-[160px] truncate font-medium">
                    {user.email}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Session key</span>
                  <span className="font-mono text-[11px]">
                    {user.id.slice(0, 8)}…
                  </span>
                </div>
                <p className="rounded-lg bg-muted/50 p-2.5 leading-5 text-muted-foreground">
                  Signing in with another account creates a different Composio
                  session with a separate connection state.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <footer className="border-t bg-muted/20">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-[11px] text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span>Each account has its own Composio session and connections.</span>
          <span>Email/password demo auth · local JSON store</span>
        </div>
      </footer>
    </div>
  );
}
