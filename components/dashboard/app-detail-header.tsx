import Link from "next/link";
import { ArrowLeft, LayoutGrid, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { initials } from "@/components/dashboard/utils";

export function AppDetailHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Brand href="/dashboard" />
        <Separator
          orientation="vertical"
          className="mx-1 hidden h-6 sm:block"
        />
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">All apps</span>
          </Link>
        </Button>
        <Badge
          variant="outline"
          className="hidden gap-1.5 border-primary/20 bg-primary/5 text-primary md:inline-flex"
        >
          <LockKeyhole className="size-3" />
          Per-account session
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
            <Link href="/dashboard">
              <LayoutGrid className="size-3.5" />
              Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-2 border-l pl-2">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {initials(email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-xs font-medium text-muted-foreground lg:block">
              {email}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
