import type { ReactNode } from 'react'

export function AppShellSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b bg-background/85">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-md bg-muted" />
            <span className="h-4 w-20 rounded bg-muted" />
          </div>
          <div className="flex items-center gap-2">
            <span className="h-8 w-16 rounded-md bg-muted" />
            <span className="size-8 rounded-md bg-muted" />
            <span className="size-8 rounded-md bg-muted" />
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children ?? (
          <div className="space-y-5">
            <div className="space-y-2">
              <span className="block h-8 w-2/3 rounded-md bg-muted" />
              <span className="block h-4 w-1/3 rounded bg-muted" />
            </div>
            <div className="h-80 rounded-xl border bg-card shadow-sm" />
          </div>
        )}
      </main>
      <footer className="border-t bg-background/80">
        <div className="mx-auto h-16 w-full max-w-6xl px-4 sm:px-6" />
      </footer>
    </div>
  )
}
