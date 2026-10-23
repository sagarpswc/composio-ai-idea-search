import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppDetailLoading() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Brand href="/dashboard" />
          <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
          <Skeleton className="h-7 w-24" />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <Skeleton className="mb-4 h-4 w-56" />
        <div className="rounded-2xl border bg-card/60 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-16 rounded-2xl sm:size-20" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-64 max-w-full" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full max-w-2xl" />
              <Skeleton className="h-4 w-3/4 max-w-xl" />
            </div>
            <Skeleton className="hidden h-8 w-36 sm:block" />
          </div>
          <Separator className="my-5" />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card className="gap-4 shadow-sm">
              <CardHeader className="border-b">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-full max-w-xl" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-9 w-full" />
                {[0, 1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-24 w-full rounded-xl" />
                ))}
              </CardContent>
            </Card>
            <Card className="gap-4 shadow-sm">
              <CardHeader className="border-b">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="h-4 w-full max-w-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full rounded-xl" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
