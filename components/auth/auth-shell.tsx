import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  LockKeyhole,
  PlugZap,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InteractiveGrid } from "@/components/ui/interactive-grid";

const features = [
  {
    icon: LockKeyhole,
    title: "Isolated by account",
    description:
      "Every registered account gets its own Composio user ID and session.",
  },
  {
    icon: Boxes,
    title: "The whole catalog",
    description:
      "Search the live Composio catalog instead of shipping a fixed app list.",
  },
  {
    icon: PlugZap,
    title: "Managed connections",
    description:
      "Composio handles provider OAuth. Your app never stores app passwords.",
  },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -left-40 -top-40 size-[34rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-48 top-1/3 size-[32rem] rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <InteractiveGrid
        cellSize={44}
        className="z-0 text-primary/60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <Brand href="/" />
        <div className="flex items-center gap-1">
          <Link
            href="https://docs.composio.dev"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Documentation
            <ArrowUpRight className="size-3" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 pb-14 pt-4 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10 lg:pb-20">
        <section className="hidden max-w-xl lg:block">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-primary/20 bg-background/60 px-3 py-1 text-primary backdrop-blur"
          >
            <Sparkles className="size-3.5" />
            Composio Platform
          </Badge>

          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] xl:text-6xl">
            Give every user{" "}
            <span className="text-gradient-brand">their own</span> connected
            apps.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">
            Email and password accounts with a separate Composio session for
            each one. Connect Gmail, Slack, Notion, GitHub, or any other app in
            the live catalog.
          </p>

          <ul className="mt-9 space-y-5">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <li key={feature.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border bg-background/70 text-primary shadow-sm backdrop-blur">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{feature.title}</p>
                    <p className="mt-0.5 max-w-sm text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <Card className="mt-9 max-w-md gap-0 border bg-card/70 py-0 shadow-sm backdrop-blur">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex -space-x-2">
                {["A", "M", "J"].map((initial, index) => (
                  <span
                    key={initial}
                    className="flex size-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground"
                    style={{ zIndex: 3 - index }}
                  >
                    {initial}
                  </span>
                ))}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Per-account sessions</p>
                <p className="truncate text-xs text-muted-foreground">
                  Connections never cross between accounts.
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto shrink-0 gap-1">
                <LockKeyhole className="size-3" />
                Isolated
              </Badge>
            </CardContent>
          </Card>
        </section>

        <section className="w-full max-w-[440px] justify-self-center lg:justify-self-end">
          {children}
          <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-[11px] leading-5 text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3 shrink-0" />
            Local demo auth. No email verification, no external auth provider.
          </p>
        </section>
      </main>
    </div>
  );
}
