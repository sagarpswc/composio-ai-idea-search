import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  Info,
  KeyRound,
  ListChecks,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wrench,
  Zap,
} from "lucide-react";
import { AppDetailHeader } from "@/components/dashboard/app-detail-header";
import { DisconnectAppButton } from "@/components/dashboard/disconnect-app-button";
import { ScopeList } from "@/components/dashboard/scope-list";
import { ToolBrowser } from "@/components/dashboard/tool-browser";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InteractiveGrid } from "@/components/ui/interactive-grid";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import {
  getToolkitDetail,
  getToolkitOverview,
  type ToolkitAuthMethod,
} from "@/lib/toolkit-details";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Notice = {
  title: string;
  description: string;
  variant: "default" | "destructive";
  icon: typeof CheckCircle2;
};

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getNotice(
  query: Record<string, string | string[] | undefined>,
  detail: { slug: string; name: string }
): Notice | null {
  const connectError = queryValue(query.connectError);

  if (connectError) {
    return {
      title: `Could not connect ${detail.name}`,
      description: connectError,
      variant: "destructive",
      icon: TriangleAlert,
    };
  }

  if (queryValue(query.connected) === detail.slug) {
    return {
      title: `${detail.name} is connected`,
      description:
        "The authorization is active in this account's Composio session. You can now run its actions.",
      variant: "default",
      icon: CheckCircle2,
    };
  }

  if (queryValue(query.already) === detail.slug) {
    return {
      title: `${detail.name} is already connected`,
      description:
        "This account already has an active authorization for this app.",
      variant: "default",
      icon: CheckCircle2,
    };
  }

  if (queryValue(query.noauth) === detail.slug) {
    return {
      title: `${detail.name} needs no connection`,
      description:
        "This toolkit uses public actions, so there are no credentials to authorize.",
      variant: "default",
      icon: Info,
    };
  }

  return null;
}

function formatUpdatedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function emptyScopeNote(method: ToolkitAuthMethod, appName: string): string {
  switch (method.mode) {
    case "API_KEY":
      return `This method does not use OAuth scopes. Access is limited to the permissions of the API key you provide for ${appName}.`;
    case "NO_AUTH":
      return `${appName} requires no credentials and publishes no permission scopes through Composio.`;
    case "OAUTH1":
    case "OAUTH2":
      return `Composio did not return a fixed scope list for this ${method.label} connection. The exact permissions are shown on ${appName}'s authorization screen when you connect.`;
    case "S2S_OAUTH2":
      return "Server-to-server OAuth does not use a user consent screen. Access is controlled by the credentials and the app configuration.";
    default:
      return `The live toolkit metadata does not list explicit scopes for this ${method.label} method.`;
  }
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl border bg-background/50 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-semibold">{value}</p>
        <p className="truncate text-[10px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const overview = await getToolkitOverview(slug);

  if (!overview) {
    return {
      title: "App not found",
      description: "The requested app is not available in the Composio catalog.",
    };
  }

  return {
    title: `${overview.name} · App details`,
    description: overview.description,
  };
}

export default async function AppDetailPage({
  params,
  searchParams,
}: DetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { slug } = await params;
  const detail = await getToolkitDetail(slug, user.id);

  if (!detail) {
    notFound();
  }

  const query = await searchParams;
  const notice = getNotice(query, detail);
  const updatedAt = formatUpdatedAt(detail.updatedAt);
  const appForActions: DashboardApp = {
    slug: detail.slug,
    name: detail.name,
    logo: detail.logo,
    isNoAuth: detail.isNoAuth,
    isConnected: detail.isConnected,
    status: detail.connectionStatus,
  };
  const status = detail.isConnected
    ? {
        label: "Connected",
        heading: "Authorized for this account",
        description: detail.connectedAuthMethod
          ? `${detail.connectedAuthMethod} access is active in this account's isolated Composio session.`
          : "The authorization is active in this account's isolated Composio session.",
        icon: CheckCircle2,
        className: "border-primary/20 bg-primary/10 text-primary",
      }
    : detail.isNoAuth
      ? {
          label: "No auth",
          heading: "No connection required",
          description:
            "This toolkit works through public actions. There is no account authorization to manage.",
          icon: KeyRound,
          className:
            "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        }
      : !detail.connectionKnown
        ? {
            label: "Unknown",
            heading: "Connection status unavailable",
            description:
              "The app details loaded, but the session connection could not be checked right now.",
            icon: Circle,
            className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          }
        : {
            label: "Not connected",
            heading: "Ready to connect",
            description:
              "Connect this app to let Composio run its actions with this account's permissions.",
            icon: Circle,
            className: "border-border bg-muted/60 text-muted-foreground",
          };
  const StatusIcon = status.icon;
  const noticeIcon = notice ? notice.icon : null;
  const NoticeIcon = noticeIcon;
  const connectHref = `/api/connect?toolkit=${encodeURIComponent(detail.slug)}&returnTo=app`;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppDetailHeader email={user.email} />

      <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 overflow-hidden"
        >
          <div className="absolute left-1/2 top-0 h-80 w-[54rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
            Apps
          </Link>
          <ChevronRight className="size-3" />
          {detail.categories[0] ? (
            <>
              <span>{detail.categories[0]}</span>
              <ChevronRight className="size-3" />
            </>
          ) : null}
          <span className="font-medium text-foreground">{detail.name}</span>
        </nav>

        {notice && NoticeIcon ? (
          <Alert
            variant={notice.variant}
            className={cn(
              "mb-4",
              notice.variant === "default" &&
                "border-primary/25 bg-primary/5 text-primary"
            )}
          >
            <NoticeIcon />
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription
              className={notice.variant === "default" ? "text-primary/80" : undefined}
            >
              {notice.description}
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="relative isolate overflow-hidden rounded-2xl border bg-card/60 p-5 shadow-sm backdrop-blur sm:p-6">
          <InteractiveGrid
            cellSize={44}
            className="z-0 text-primary/60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_82%)]"
          />
          <div className="relative z-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-background shadow-sm sm:size-20">
                  {detail.logo ? (
                    <img
                      src={detail.logo}
                      alt=""
                      className="size-10 object-contain sm:size-12"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-muted-foreground">
                      {initials(detail.name)}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-primary/20 bg-primary/5 text-primary"
                    >
                      <Sparkles className="size-3" />
                      Composio toolkit
                    </Badge>
                    {detail.categories.slice(0, 3).map((category) => (
                      <Badge key={category} variant="outline" className="font-normal">
                        {category}
                      </Badge>
                    ))}
                    {detail.categories.length > 3 ? (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        +{detail.categories.length - 3}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={cn("gap-1", status.className)}
                    >
                      <StatusIcon className="size-3" />
                      {status.label}
                    </Badge>
                  </div>

                  <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                    {detail.name}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      {detail.slug}
                    </code>
                    <span aria-hidden="true">·</span>
                    <span>{detail.primaryAuthMethod}</span>
                    {detail.updatedAt ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="size-3" />
                          Updated {updatedAt}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {detail.description}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                {detail.isConnected ? (
                  <>
                    <Button variant="secondary" disabled>
                      <CheckCircle2 className="size-3.5 text-primary" />
                      Connected
                    </Button>
                    <DisconnectAppButton app={appForActions} />
                  </>
                ) : detail.isNoAuth ? (
                  <Button variant="secondary" disabled>
                    <KeyRound className="size-3.5" />
                    No connection needed
                  </Button>
                ) : (
                  <Button asChild>
                    <a href={connectHref} target="_self">
                      <PlugZap className="size-3.5" />
                      Connect {detail.name}
                    </a>
                  </Button>
                )}

                {detail.websiteUrl ? (
                  <Button variant="outline" asChild>
                    <a
                      href={detail.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      Visit app website
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <Separator className="my-5" />

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                icon={Wrench}
                label="Actions"
                value={
                  detail.toolsCount
                    ? detail.toolsCount.toLocaleString()
                    : "—"
                }
                hint="Available through Composio"
              />
              <Stat
                icon={Zap}
                label="Triggers"
                value={
                  detail.triggersCount
                    ? detail.triggersCount.toLocaleString()
                    : "—"
                }
                hint="Event triggers"
              />
              <Stat
                icon={ShieldCheck}
                label="Authentication"
                value={detail.primaryAuthMethod}
                hint={detail.isNoAuth ? "No credentials needed" : "Approved on connect"}
              />
              <Stat
                icon={LockKeyhole}
                label="Permissions"
                value={
                  detail.scopeCount
                    ? `${detail.scopeCount.toLocaleString()} scopes`
                    : detail.isNoAuth
                      ? "Public access"
                      : "Provider-managed"
                }
                hint="Shown before authorization"
              />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <Card className="gap-4 shadow-sm">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="size-4" />
                    </span>
                    <div>
                      <CardTitle className="text-base">
                        What you can do with {detail.name}
                      </CardTitle>
                      <CardDescription className="mt-1 max-w-2xl text-xs leading-5">
                        These are live actions exposed by the Composio{" "}
                        {detail.name} toolkit. Each action runs with the
                        permissions granted to this account.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-normal">
                    {detail.toolsCount.toLocaleString()} actions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {detail.toolsError ? (
                  <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertTitle>Actions are temporarily unavailable</AlertTitle>
                    <AlertDescription>{detail.toolsError}</AlertDescription>
                  </Alert>
                ) : (
                  <ToolBrowser tools={detail.tools} total={detail.toolsCount} />
                )}
              </CardContent>
            </Card>

            <Card className="gap-4 shadow-sm">
              <CardHeader className="border-b">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="size-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base">
                      Permissions &amp; scopes
                    </CardTitle>
                    <CardDescription className="mt-1 max-w-2xl text-xs leading-5">
                      These are the permissions Composio requests when you
                      connect {detail.name}. You approve them on {detail.name}
                      &apos;s own authorization screen, and you can revoke
                      access at any time.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {detail.authMethods.map((method) => (
                  <div
                    key={`${method.mode}-${method.name}`}
                    className="rounded-xl border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{method.label}</Badge>
                      {method.managedByComposio ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-primary/20 bg-primary/5 text-primary"
                        >
                          <Sparkles className="size-3" />
                          Composio-managed
                        </Badge>
                      ) : null}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {method.scopes.length
                          ? `${method.scopes.length} ${
                              method.scopes.length === 1
                                ? "permission"
                                : "permissions"
                            }`
                          : "Provider-managed"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {method.summary}
                    </p>

                    {method.scopes.length ? (
                      <ScopeList scopes={method.scopes} />
                    ) : (
                      <p className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                        {emptyScopeNote(method, detail.name)}
                      </p>
                    )}
                  </div>
                ))}

                <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                  <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>
                    Composio stores the authorization for this app in this
                    account&apos;s isolated session. It is not shared with other
                    accounts on this site.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <PlugZap className="size-3.5" />
                  </span>
                  <CardTitle className="text-sm">Connection</CardTitle>
                  <Badge
                    variant="outline"
                    className={cn("ml-auto gap-1", status.className)}
                  >
                    <StatusIcon className="size-3" />
                    {status.label}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Scoped to this account only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      status.className
                    )}
                  >
                    <StatusIcon className="size-4" />
                  </span>
                  <div>
                    <p className="font-medium">{status.heading}</p>
                    <p className="mt-0.5 leading-5 text-muted-foreground">
                      {status.description}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Authentication</span>
                    <span className="max-w-[170px] truncate text-right font-medium">
                      {detail.connectedAuthMethod ?? detail.primaryAuthMethod}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Permissions</span>
                    <span className="max-w-[170px] truncate text-right font-medium">
                      {detail.scopeCount
                        ? `${detail.scopeCount.toLocaleString()} scopes`
                        : "Provider-managed"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Session</span>
                    <span className="font-mono text-[11px]">
                      {user.id.slice(0, 8)}…
                    </span>
                  </div>
                </div>

                <p className="rounded-lg bg-muted/50 p-2.5 leading-5 text-muted-foreground">
                  Actions run as this account. Signing in with another account
                  creates a separate session with its own connections.
                </p>
              </CardContent>
            </Card>

            <Card className="gap-3 shadow-sm">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListChecks className="size-4 text-primary" />
                  How access works
                </CardTitle>
                <CardDescription className="text-xs">
                  What happens when you connect an app.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <ol className="space-y-3 text-xs">
                  {[
                    {
                      title: "You approve",
                      text: `Review the permissions on ${detail.name}'s own authorization screen.`,
                    },
                    {
                      title: "Composio stores a token",
                      text: "The authorization is attached to this account's isolated Composio session.",
                    },
                    {
                      title: "You stay in control",
                      text: "Disconnect at any time to remove the stored authorization.",
                    },
                  ].map((step, index) => (
                    <li key={step.title} className="flex gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{step.title}</p>
                        <p className="mt-0.5 leading-5 text-muted-foreground">
                          {step.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card className="gap-3 shadow-sm">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Info className="size-4 text-primary" />
                  Toolkit details
                </CardTitle>
                <CardDescription className="text-xs">
                  Live metadata from Composio.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Composio slug</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {detail.slug}
                  </code>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Actions</span>
                  <span className="font-medium">
                    {detail.toolsCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Triggers</span>
                  <span className="font-medium">
                    {detail.triggersCount.toLocaleString()}
                  </span>
                </div>
                {updatedAt ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium">{updatedAt}</span>
                  </div>
                ) : null}
                {detail.categories.length ? (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-muted-foreground">Categories</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.categories.map((category) => (
                          <Badge
                            key={category}
                            variant="outline"
                            className="font-normal"
                          >
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
                {detail.websiteUrl ? (
                  <>
                    <Separator />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-full justify-between px-1 text-xs"
                      asChild
                    >
                      <a
                        href={detail.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open {detail.name}
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      <footer className="border-t bg-muted/20">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-[11px] text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <span>
            App details, permissions, and actions are loaded live from Composio.
          </span>
          <span>Authorization scoped to {user.email}</span>
        </div>
      </footer>
    </div>
  );
}
