"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { base64ToBytes } from "@/lib/http/body-codec";
import type { SendSuccess } from "@/lib/http/types";
import {
  HIGHLIGHT_CAP_BYTES,
  detectGrammar,
  detectPreview,
  isBinary,
  shouldHighlight,
} from "@/lib/render/detect";
import {
  formatForGrammar,
  highlightToHtml,
} from "@/lib/render/highlight";
import { contentTypeOf, formatSize } from "@/lib/render/meta";
import { useActiveTheme } from "@/lib/render/use-active-theme";

type ResponseView = "pretty" | "raw" | "preview";

const HTML_PREVIEW_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'";

function RawBody({ bodyText }: { bodyText: string }) {
  return (
    <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-6">
      <code>{bodyText}</code>
    </pre>
  );
}

function BinaryBody({
  contentType,
  sizeBytes,
}: {
  contentType: string | undefined;
  sizeBytes: number;
}) {
  return (
    <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
      Binary response — {formatSize(sizeBytes)} · {contentType ?? "unknown type"},
      not shown as text
    </div>
  );
}

function ImagePreview({ body, contentType }: { body: SendSuccess["body"]; contentType: string }) {
  const bodyValue = body.encoding === "utf8" ? body.text : body.data;
  const input = `${contentType}\u0000${body.encoding}\u0000${bodyValue}`;
  const [prepared, setPrepared] = useState<{
    input: string;
    source: string;
  } | null>(null);
  const source = prepared?.input === input ? prepared.source : null;

  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") {
      return;
    }

    const bytes = body.encoding === "utf8"
      ? new TextEncoder().encode(body.text)
      : base64ToBytes(body.data);
    const objectUrl = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], { type: contentType }),
    );
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setPrepared({ input, source: objectUrl });
      }
    });

    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [body, contentType, input]);

  if (!source) {
    return <p className="text-sm text-muted-foreground">Preparing image preview…</p>;
  }

  // The source is a local object URL created from the already-received body.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="Response preview" className="max-h-[60vh] max-w-full" src={source} />;
}

export function ResponseBody({ result }: { result: SendSuccess }) {
  const contentType = contentTypeOf(result.headers);
  const bodyText = result.body.encoding === "utf8" ? result.body.text : "";
  const grammar = detectGrammar(contentType, bodyText);
  const previewKind = detectPreview(contentType);
  const binary = result.body.encoding === "base64" || isBinary(contentType);
  const capped = result.sizeBytes >= HIGHLIGHT_CAP_BYTES;
  const highlightable = shouldHighlight(result.sizeBytes, grammar);
  const defaultView: ResponseView = highlightable ? "pretty" : "raw";
  const [selection, setSelection] = useState<{
    result: SendSuccess;
    view: ResponseView;
  }>(() => ({ result, view: defaultView }));
  let view = selection.view;
  if (selection.result !== result) {
    setSelection({ result, view: defaultView });
    view = defaultView;
  }

  const [highlighted, setHighlighted] = useState<{
    html: string;
    input: string;
  } | null>(null);
  const theme = useActiveTheme();

  const prettyBody = useMemo(
    () => formatForGrammar(bodyText, grammar),
    [bodyText, grammar],
  );

  const highlightInput = `${theme}\u0000${grammar}\u0000${prettyBody}`;
  const highlightedHtml = highlighted?.input === highlightInput
    ? highlighted.html
    : null;

  useEffect(() => {
    let cancelled = false;

    if (!highlightable) {
      return;
    }

    void highlightToHtml(prettyBody, grammar, theme).then((html) => {
      if (!cancelled) {
        setHighlighted({ html, input: highlightInput });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [grammar, highlightInput, highlightable, prettyBody, theme]);

  if (bodyText.length === 0 && result.body.encoding === "utf8") {
    return (
      <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
        Empty response
      </div>
    );
  }

  const htmlPreview = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_CSP}"></head><body>${bodyText}</body></html>`;

  return (
    <div>
      {capped ? (
        <div
          className="border-b bg-muted/60 px-4 py-2 text-sm text-muted-foreground"
          role="status"
        >
          Large response — highlighting off, showing raw.
        </div>
      ) : null}
      <Tabs
        className="gap-0"
        onValueChange={(nextView) =>
          setSelection({ result, view: nextView as ResponseView })
        }
        value={view}
      >
        <TabsList
          aria-label="Response body view"
          className="mx-4 mt-3"
          variant="line"
        >
          <TabsTrigger
            disabled={!highlightable}
            value="pretty"
          >
            Pretty
          </TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
          {previewKind ? (
            <TabsTrigger value="preview">Preview</TabsTrigger>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      aria-label="Why Preview is unavailable"
                      className="inline-flex"
                      tabIndex={0}
                    />
                  }
                >
                  <TabsTrigger
                    disabled
                    value="preview"
                  >
                    Preview
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  Preview is available for HTML and images.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </TabsList>

        <TabsContent className="px-4 pb-4 pt-3" value="pretty">
          {highlightedHtml ? (
            <div
              className="max-h-[60vh] overflow-auto [&_.shiki]:min-h-full [&_.shiki]:overflow-auto [&_.shiki]:bg-transparent! [&_.shiki]:font-mono [&_.shiki]:text-sm [&_.shiki]:leading-6"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <div
              aria-label="Highlighting response"
              className="h-48 animate-pulse rounded-md bg-muted"
              role="status"
            />
          )}
        </TabsContent>

        <TabsContent className="px-4 pb-4 pt-3" value="raw">
          {binary || previewKind === "image" ? (
            <BinaryBody
              contentType={contentType}
              sizeBytes={result.sizeBytes}
            />
          ) : (
            <RawBody bodyText={bodyText} />
          )}
        </TabsContent>

        {previewKind ? (
          <TabsContent className="px-4 pb-4 pt-3" value="preview">
            {previewKind === "html" ? (
              <iframe
                {...({ csp: HTML_PREVIEW_CSP } as { csp: string })}
                className="pointer-events-none h-[60vh] w-full rounded-md border bg-white"
                referrerPolicy="no-referrer"
                sandbox=""
                srcDoc={htmlPreview}
                tabIndex={-1}
                title="HTML response preview"
              />
            ) : (
              <ImagePreview
                body={result.body}
                contentType={contentType ?? "application/octet-stream"}
              />
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
