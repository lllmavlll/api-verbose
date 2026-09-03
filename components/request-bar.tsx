"use client";

import { LoaderCircle } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HttpMethod } from "@/lib/http/types";
import { isAbsoluteHttpUrl } from "@/lib/http/url";
import { useRequestStore } from "@/lib/store/request-store";
import { cn } from "@/lib/utils";

const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
  HEAD: "text-method-head",
  OPTIONS: "text-method-options",
};

type RequestBarProps = {
  pending: boolean;
  onSubmit: () => void;
};

export function RequestBar({ pending, onSubmit }: RequestBarProps) {
  const method = useRequestStore((state) => state.spec.method);
  const storeUrl = useRequestStore((state) => state.spec.url);
  const setMethod = useRequestStore((state) => state.setMethod);
  const setStoreUrl = useRequestStore((state) => state.setUrl);
  const [url, setUrl] = useState(() => useRequestStore.getState().spec.url);
  const [error, setError] = useState<string | null>(null);
  const urlFocused = useRef(false);

  useEffect(() => {
    if (!urlFocused.current) {
      setUrl(storeUrl);
    }
  }, [storeUrl]);

  useEffect(() => {
    if (url === storeUrl) {
      return;
    }

    const timer = window.setTimeout(() => setStoreUrl(url), 150);
    return () => window.clearTimeout(timer);
  }, [setStoreUrl, storeUrl, url]);

  function submit() {
    if (pending) {
      return;
    }

    const trimmedUrl = url.trim();
    if (!isAbsoluteHttpUrl(trimmedUrl)) {
      setError("Enter a valid absolute HTTP or HTTPS URL.");
      return;
    }

    setError(null);
    setUrl(trimmedUrl);
    setStoreUrl(trimmedUrl);
    onSubmit();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      className="space-y-2"
      noValidate
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="request-method">
          HTTP method
        </label>
        <Select
          value={method}
          onValueChange={(value) => setMethod(value as HttpMethod)}
        >
          <SelectTrigger
            id="request-method"
            aria-label="HTTP method"
            className={cn("h-10 w-full font-mono sm:w-32", METHOD_COLORS[method])}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {HTTP_METHODS.map((item) => (
              <SelectItem
                className={cn("font-mono", METHOD_COLORS[item])}
                key={item}
                value={item}
              >
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="sr-only" htmlFor="request-url">
          Request URL
        </label>
        <Input
          id="request-url"
          aria-describedby={error ? "request-url-error" : undefined}
          aria-invalid={error ? true : undefined}
          autoCapitalize="none"
          autoComplete="url"
          className="h-10 flex-1 font-mono"
          disabled={pending}
          onBlur={(event) => {
            urlFocused.current = false;
            setStoreUrl(event.currentTarget.value);
          }}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError(null);
          }}
          onFocus={() => {
            urlFocused.current = true;
          }}
          placeholder="https://api.example.com/resource"
          spellCheck={false}
          type="url"
          value={url}
        />

        <Button className="h-10 sm:min-w-28" disabled={pending} type="submit">
          {pending ? (
            <>
              <LoaderCircle aria-hidden className="animate-spin" />
              Sending
            </>
          ) : (
            "Send"
          )}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" id="request-url-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Press <span className="font-mono">⌘↵</span> or{" "}
          <span className="font-mono">Ctrl+↵</span> to send.
        </p>
      )}
    </form>
  );
}
