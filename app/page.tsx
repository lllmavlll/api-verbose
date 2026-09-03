"use client";

import { useEffect, useRef, useState } from "react";

import { RequestBar } from "@/components/request-bar";
import { ResponsePanel } from "@/components/response-panel";
import { sendRequest } from "@/lib/http/send-request";
import type { HttpMethod, RequestSpec, SendResult } from "@/lib/http/types";

export default function Home() {
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

  async function handleSubmit(input: { method: HttpMethod; url: string }) {
    if (pendingRef.current) {
      return;
    }

    const spec: RequestSpec = {
      method: input.method,
      url: input.url,
      headers: [],
      params: [],
      auth: { kind: "none" },
      body: { kind: "none" },
    };

    pendingRef.current = true;
    startedAtRef.current = performance.now();
    setElapsedMs(0);
    setResult(null);
    setPending(true);

    try {
      setResult(await sendRequest(spec));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
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
              Send an HTTP request and read the response without an account or cloud sync.
            </p>
          </div>
          {pending ? (
            <p
              aria-live="polite"
              className="font-mono text-sm text-muted-foreground"
            >
              Sending · {Math.round(elapsedMs)} ms
            </p>
          ) : null}
        </header>

        <section className="mb-5 rounded-xl border bg-card/90 p-4 shadow-sm backdrop-blur sm:p-5">
          <RequestBar pending={pending} onSubmit={handleSubmit} />
        </section>

        <ResponsePanel pending={pending} result={result} />
      </div>
    </main>
  );
}
