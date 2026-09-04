"use client";

import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";

import { ResponseBody } from "@/components/response-body";
import { ResponseCookiesTable } from "@/components/response-cookies-table";
import { ResponseHeadersTable } from "@/components/response-headers-table";
import { TestsPanel, testsBadgeCount } from "@/components/tests-panel";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cookiesFromHeaders } from "@/lib/http/parse-set-cookie";
import type { SendResult } from "@/lib/http/types";
import { contentTypeOf, formatSize } from "@/lib/render/meta";
import { useAssertionsStore } from "@/lib/store/assertions-store";

type ResponsePanelProps = {
  result: SendResult | null;
  pending: boolean;
};

export function ResponsePanel({ result, pending }: ResponsePanelProps) {
  const ruleCount = useAssertionsStore((state) => testsBadgeCount(state.rules));

  if (pending) {
    return (
      <Card
        aria-busy="true"
        aria-live="polite"
        className="grid min-h-80 place-items-center border border-dashed shadow-none ring-0"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          Waiting for a response…
        </div>
      </Card>
    );
  }

  const success = result?.ok ? result : null;
  const status = success
    ? [success.status, success.statusText].filter(Boolean).join(" ")
    : "";
  const contentType = success ? contentTypeOf(success.headers) : null;
  const contentEncoding = success?.headers.find(
    ([name]) => name.toLowerCase() === "content-encoding",
  )?.[1];
  const cookieCount = success ? cookiesFromHeaders(success.headers).length : 0;

  return (
    <Card
      aria-live="polite"
      className="min-h-80 gap-0 border py-0 shadow-none ring-0"
    >
      {success ? (
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 rounded-none border-b py-3 font-mono text-sm">
          <Badge
            className={success.status < 400 ? "text-status-success" : undefined}
            variant={success.status < 400 ? "outline" : "destructive"}
          >
            {status}
          </Badge>
          {success.via === "relay" ? (
            <Badge
              className="bg-muted text-[11px] tracking-wide text-muted-foreground"
              variant="outline"
            >
              via relay
            </Badge>
          ) : null}
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <span>{Math.round(success.timeMs)} ms</span>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <span>{formatSize(success.sizeBytes)}</span>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <span className="text-muted-foreground">
            {contentType ?? "content type unavailable"}
          </span>
          {contentEncoding ? (
            <>
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
              <span className="text-muted-foreground">{contentEncoding}</span>
            </>
          ) : null}
        </CardHeader>
      ) : null}
      {success?.redirects?.length ? (
        <section
          aria-label="Redirect chain"
          className="border-b bg-muted/35 px-4 py-3"
        >
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Redirect chain
          </p>
          <ol className="space-y-1.5 font-mono text-xs">
            {success.redirects.map((hop, index) => (
              <li className="flex min-w-0 items-center gap-2" key={`${hop.url}-${index}`}>
                {hop.status === 0 ? (
                  <span className="shrink-0 text-muted-foreground">
                    Redirected from
                  </span>
                ) : (
                  <Badge className="font-mono" variant="outline">
                    {hop.status}
                  </Badge>
                )}
                <ArrowRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate" title={hop.url}>
                  {hop.url}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <CardContent className="px-0">
        <Tabs className="gap-0" defaultValue="body">
          <TabsList
            aria-label="Response data views"
            className="mx-4 mt-3"
            variant="line"
          >
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger disabled={!success} value="headers">
              Headers {success?.headers.length ?? 0}
            </TabsTrigger>
            <TabsTrigger disabled={!success} value="cookies">
              Cookies {cookieCount}
            </TabsTrigger>
            <TabsTrigger aria-label={`Tests ${ruleCount}`} value="tests">
              Tests
              <Badge className="font-mono" variant="outline">
                {ruleCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="body">
            {!result ? (
              <div className="grid min-h-64 place-items-center px-4 py-8">
                <div className="max-w-sm text-center">
                  <ArrowRight
                    aria-hidden
                    className="mx-auto mb-3 size-5 text-muted-foreground"
                  />
                  <p className="font-medium">Send a request to see its response</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Status, timing, size, and body will appear here.
                  </p>
                </div>
              </div>
            ) : !result.ok ? (
              <div className="px-4 pb-5 pt-3">
                <Alert
                  aria-live="polite"
                  className="border-destructive/30"
                  variant="destructive"
                >
                  <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
                  <AlertTitle>Unable to send request</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              </div>
            ) : (
              <ResponseBody result={result} />
            )}
          </TabsContent>
          <TabsContent className="pt-3" value="headers">
            <ResponseHeadersTable headers={success?.headers ?? []} />
          </TabsContent>
          <TabsContent className="pt-3" value="cookies">
            <ResponseCookiesTable headers={success?.headers ?? []} />
          </TabsContent>
          <TabsContent value="tests">
            <TestsPanel result={result} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
