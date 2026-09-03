"use client";

import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { useState } from "react";

import { KvEditorTable } from "@/components/kv-editor-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bodyAllows, isValidJson } from "@/lib/http/body";
import type { Body, KV } from "@/lib/http/types";
import { useRequestStore } from "@/lib/store/request-store";

type BodyKind = Body["kind"];

const CodeEditor = dynamic(
  () => import("@/components/ui/code-editor").then((module) => module.CodeEditor),
  {
    loading: () => (
      <div className="min-h-32 rounded-md border bg-background p-3 text-xs text-muted-foreground">
        Loading editor…
      </div>
    ),
    ssr: false,
  },
);

const BODY_TYPES: { value: BodyKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "json", label: "JSON" },
  { value: "form", label: "Form" },
  { value: "raw", label: "Raw" },
];

function freshField(): KV {
  return {
    id: crypto.randomUUID(),
    key: "",
    value: "",
    enabled: true,
  };
}

function initialDrafts(body: Body) {
  return {
    kind: body.kind,
    jsonText: body.kind === "json" ? body.text : "",
    rawText: body.kind === "raw" ? body.text : "",
    rawContentType: body.kind === "raw" ? body.contentType : "text/plain",
    formFields: body.kind === "form" ? body.fields.map((field) => ({ ...field })) : [],
  };
}

export function RequestBody() {
  const initial = useState(() => initialDrafts(useRequestStore.getState().spec.body))[0];
  const [kind, setKind] = useState<BodyKind>(initial.kind);
  const [jsonText, setJsonText] = useState(initial.jsonText);
  const [rawText, setRawText] = useState(initial.rawText);
  const [rawContentType, setRawContentType] = useState(initial.rawContentType);
  const [formFields, setFormFields] = useState<KV[]>(initial.formFields);
  const method = useRequestStore((state) => state.spec.method);
  const setBody = useRequestStore((state) => state.setBody);

  function bodyFor(nextKind: BodyKind): Body {
    switch (nextKind) {
      case "none":
        return { kind: "none" };
      case "json":
        return { kind: "json", text: jsonText };
      case "raw":
        return {
          kind: "raw",
          text: rawText,
          contentType: rawContentType,
        };
      case "form":
        return { kind: "form", fields: formFields };
    }
  }

  function selectKind(nextKind: BodyKind) {
    setKind(nextKind);
    setBody(bodyFor(nextKind));
  }

  function changeJsonText(text: string) {
    setJsonText(text);
    setBody({ kind: "json", text });
  }

  function changeRawText(text: string) {
    setRawText(text);
    setBody({ kind: "raw", text, contentType: rawContentType });
  }

  function changeRawContentType(contentType: string) {
    setRawContentType(contentType);
    setBody({ kind: "raw", text: rawText, contentType });
  }

  function changeFormFields(fields: KV[]) {
    setFormFields(fields);
    setBody({ kind: "form", fields });
  }

  return (
    <section aria-label="Request body" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium">Body</h2>
          <p className="text-xs text-muted-foreground">
            Choose how the request payload is encoded.
          </p>
        </div>
        <Tabs
          aria-label="Body type"
          onValueChange={(value) => selectKind(value as BodyKind)}
          value={kind}
        >
          <TabsList>
            {BODY_TYPES.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {kind === "json" ? (
        <div className="space-y-2">
          <CodeEditor
            ariaLabel="JSON body"
            language="json"
            onChange={changeJsonText}
            value={jsonText}
          />
          {jsonText.trim() !== "" && !isValidJson(jsonText) ? (
            <p className="text-xs text-destructive" role="status">
              Invalid JSON — it will still be sent as typed.
            </p>
          ) : null}
        </div>
      ) : null}

      {kind === "raw" ? (
        <div className="space-y-3">
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="raw-content-type">Raw Content-Type</Label>
            <Input
              className="font-mono"
              id="raw-content-type"
              onChange={(event) => changeRawContentType(event.target.value)}
              placeholder="text/plain"
              spellCheck={false}
              value={rawContentType}
            />
          </div>
          <CodeEditor
            ariaLabel="Raw body"
            language="text"
            onChange={changeRawText}
            value={rawText}
          />
        </div>
      ) : null}

      {kind === "form" ? (
        <div
          aria-label="Form body"
          className="overflow-hidden rounded-lg border bg-background/60"
          role="region"
        >
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              URL-encoded key/value fields
            </p>
            <Button
              onClick={() => changeFormFields([...formFields, freshField()])}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus aria-hidden />
              Add field
            </Button>
          </div>
          <KvEditorTable
            emptyMessage="Add a field to build a URL-encoded body."
            label="Form body"
            onChange={changeFormFields}
            rows={formFields}
          />
        </div>
      ) : null}

      {kind !== "none" && !bodyAllows(method) ? (
        <p className="text-xs text-muted-foreground" role="status">
          Body not sent for {method}.
        </p>
      ) : null}
    </section>
  );
}
