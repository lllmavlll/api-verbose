import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";

import { ResponseBody } from "@/components/response-body";
import { ResponseCookiesTable } from "@/components/response-cookies-table";
import { ResponseHeadersTable } from "@/components/response-headers-table";
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

type ResponsePanelProps = {
  result: SendResult | null;
  pending: boolean;
};

export function ResponsePanel({ result, pending }: ResponsePanelProps) {
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

  if (!result) {
    return (
      <Card className="grid min-h-80 place-items-center border border-dashed shadow-none ring-0">
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
      </Card>
    );
  }

  if (!result.ok) {
    return (
      <Card className="min-h-80 border border-destructive/30 bg-destructive/5 shadow-none ring-0">
        <CardContent>
          <Alert aria-live="polite" className="border-destructive/30" variant="destructive">
            <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
            <AlertTitle>Unable to send request</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const status = [result.status, result.statusText].filter(Boolean).join(" ");
  const contentType = contentTypeOf(result.headers);
  const contentEncoding = result.headers.find(
    ([name]) => name.toLowerCase() === "content-encoding",
  )?.[1];
  const cookieCount = cookiesFromHeaders(result.headers).length;

  return (
    <Card
      aria-live="polite"
      className="min-h-80 gap-0 border py-0 shadow-none ring-0"
    >
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 rounded-none border-b py-3 font-mono text-sm">
        <Badge
          className={result.status < 400 ? "text-status-success" : undefined}
          variant={result.status < 400 ? "outline" : "destructive"}
        >
          {status}
        </Badge>
        {result.via === "relay" ? (
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
        <span>{Math.round(result.timeMs)} ms</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span>{formatSize(result.sizeBytes)}</span>
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
      {result.redirects?.length ? (
        <section
          aria-label="Redirect chain"
          className="border-b bg-muted/35 px-4 py-3"
        >
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Redirect chain
          </p>
          <ol className="space-y-1.5 font-mono text-xs">
            {result.redirects.map((hop, index) => (
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
            <TabsTrigger value="headers">
              Headers {result.headers.length}
            </TabsTrigger>
            <TabsTrigger value="cookies">Cookies {cookieCount}</TabsTrigger>
          </TabsList>
          <TabsContent value="body">
            <ResponseBody result={result} />
          </TabsContent>
          <TabsContent className="pt-3" value="headers">
            <ResponseHeadersTable headers={result.headers} />
          </TabsContent>
          <TabsContent className="pt-3" value="cookies">
            <ResponseCookiesTable headers={result.headers} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
