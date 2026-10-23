import Link from "next/link";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20 ring-1 ring-primary/20">
        <Boxes className="size-5" />
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/15" />
      </span>
      <span className="text-sm font-semibold tracking-tight">
        Composio{" "}
        <span className="font-normal text-muted-foreground">Connections</span>
      </span>
    </Link>
  );
}
