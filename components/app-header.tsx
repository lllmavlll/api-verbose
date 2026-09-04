import { ThemeToggle } from "@/components/theme-toggle";

type AppHeaderProps = {
  pending: boolean;
  elapsedMs: number;
};

export function AppHeader({ pending, elapsedMs }: AppHeaderProps) {
  return (
    <header
      aria-labelledby="app-title"
      className="sticky top-0 z-40 w-full border-b bg-background shadow-xs"
      role="banner"
    >
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1
              className="font-heading text-2xl font-semibold tracking-tight"
              id="app-title"
            >
              Verbose
            </h1>
            <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
              Local-first REST client
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Send an HTTP request and read the response without an account or
            cloud sync.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {pending ? (
            <p
              aria-live="polite"
              className="font-mono text-xs text-muted-foreground sm:text-sm"
            >
              Sending · {Math.round(elapsedMs)} ms
            </p>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
