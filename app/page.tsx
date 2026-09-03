"use client";

import { useEffect, useRef, useState } from "react";

import { CopyAsCodeMenu } from "@/components/copy-as-code-menu";
import { HistoryPanel } from "@/components/history-panel";
import { ImportCurlDialog } from "@/components/import-curl-dialog";
import { KeyboardProvider } from "@/components/keyboard-provider";
import { RequestBar } from "@/components/request-bar";
import { RequestBody } from "@/components/request-body";
import { RequestTabs } from "@/components/request-tabs";
import { ResponsePanel } from "@/components/response-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCoreCommands } from "@/components/use-core-commands";
import { logSend } from "@/lib/db/log-send";
import { sendRequest } from "@/lib/http/send-request";
import { useHydrated } from "@/hooks/use-hydrated";
import type { SendResult } from "@/lib/http/types";
import { composeRequest } from "@/lib/request/compose";
import { useRequestStore } from "@/lib/store/request-store";

export default function Home() {
  const hydrated = useHydrated();
  const setMethod = useRequestStore((state) => state.setMethod);
  const [pending, setPending] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<SendResult | null>(null);
  const pendingRef = useRef(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!pending) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 50);

    return () => window.clearInterval(timer);
  }, [pending]);

  async function handleSubmit() {
    if (pendingRef.current) {
      return;
    }

    const builderSpec = useRequestStore.getState().spec;
    const wireSpec = composeRequest(builderSpec);

    pendingRef.current = true;
    startedAtRef.current = performance.now();
    setElapsedMs(0);
    setResult(null);
    setPending(true);

    try {
      const nextResult = await sendRequest(wireSpec);
      const measuredTimeMs = performance.now() - startedAtRef.current;
      setResult(nextResult);
      void logSend(builderSpec, nextResult, measuredTimeMs);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  useCoreCommands({
    isSending: pending,
    onSend: () => {
      const form = document.querySelector<HTMLFormElement>("#request-form");
      form?.requestSubmit();
    },
    onFocusUrl: () => {
      document.querySelector<HTMLInputElement>("#request-url")?.focus();
    },
    setMethod,
  });

  return (
    <KeyboardProvider>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,var(--color-muted),transparent_42%)] px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
                Local-first REST client
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Verbose
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Send an HTTP request and read the response without an account or
                cloud sync.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {pending ? (
                <p
                  aria-live="polite"
                  className="font-mono text-sm text-muted-foreground"
                >
                  Sending · {Math.round(elapsedMs)} ms
                </p>
              ) : null}
              <ThemeToggle />
            </div>
          </header>

          <section
            className="mb-5 rounded-xl border bg-card/90 p-4 shadow-sm backdrop-blur sm:p-5"
            aria-busy={!hydrated}
          >
            <fieldset className="min-w-0 border-0 p-0" disabled={!hydrated}>
              <RequestBar pending={pending} onSubmit={handleSubmit} />
              <div
                aria-label="Request import and export"
                className="mt-3 flex flex-col items-start gap-2 sm:flex-row"
                role="group"
              >
                <ImportCurlDialog />
                <CopyAsCodeMenu />
              </div>
              <div className="mt-4 border-t pt-4">
                <RequestBody />
              </div>
              <div className="mt-4 border-t pt-4">
                <RequestTabs />
              </div>
            </fieldset>
          </section>

          <ResponsePanel pending={pending} result={result} />
          <HistoryPanel />
        </div>
      </main>
    </KeyboardProvider>
  );
}
