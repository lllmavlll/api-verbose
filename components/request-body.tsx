"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CodeEditor } from "@/components/ui/code-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bodyAllows, isValidJson } from "@/lib/http/body";
import type { Body, KV } from "@/lib/http/types";
import { useRequestStore } from "@/lib/store/request-store";

type BodyKind = Body["kind"];

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

  function updateFormField(id: string, patch: Partial<KV>) {
    changeFormFields(
      formFields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <span className="sr-only">Enabled</span>
                </TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formFields.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-6 text-center text-sm text-muted-foreground"
                    colSpan={4}
                  >
                    Add a field to build a URL-encoded body.
                  </TableCell>
                </TableRow>
              ) : (
                formFields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell className="text-center">
                      <Checkbox
                        aria-label={`Enable ${field.key || `form field ${index + 1}`}`}
                        checked={field.enabled}
                        onCheckedChange={(enabled) =>
                          updateFormField(field.id, { enabled })
                        }
                      />
                    </TableCell>
                    <TableCell className="min-w-40">
                      <Input
                        aria-label={`Form body key ${index + 1}`}
                        className="font-mono"
                        onChange={(event) =>
                          updateFormField(field.id, { key: event.target.value })
                        }
                        placeholder="Key"
                        value={field.key}
                      />
                    </TableCell>
                    <TableCell className="min-w-40">
                      <Input
                        aria-label={`Form body value ${index + 1}`}
                        className="font-mono"
                        onChange={(event) =>
                          updateFormField(field.id, { value: event.target.value })
                        }
                        placeholder="Value"
                        value={field.value}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        aria-label={`Remove ${field.key || `form field ${index + 1}`}`}
                        onClick={() =>
                          changeFormFields(
                            formFields.filter(({ id }) => id !== field.id),
                          )
                        }
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
