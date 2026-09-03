import { AlertCircle, ArrowRight, LoaderCircle } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatBody } from "@/lib/http/format-body";
import type { SendResult } from "@/lib/http/types";

type ResponsePanelProps = {
  result: SendResult | null;
  pending: boolean;
};

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const formattedBody = formatBody(result.bodyText, result.isJson);

  return (
    <Card
      aria-live="polite"
      className="min-h-80 gap-0 border py-0 shadow-none ring-0"
    >
      <CardHeader className="flex flex-row flex-wrap items-center gap-2 rounded-none border-b py-3 font-mono text-sm">
        <span
          className={
            result.status < 400 ? "text-status-success" : "text-destructive"
          }
        >
          {status}
        </span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span>{Math.round(result.timeMs)} ms</span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span>{formatSize(result.sizeBytes)}</span>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[60vh] overflow-auto font-mono text-sm leading-6 whitespace-pre-wrap break-words">
          <code>{formattedBody}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
