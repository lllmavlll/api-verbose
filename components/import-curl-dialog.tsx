"use client";

import { Import } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parseCurl } from "@/lib/curl/parse";
import { useRequestStore } from "@/lib/store/request-store";

export function ImportCurlDialog() {
  const loadSpec = useRequestStore((state) => state.loadSpec);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);

  function handleImport() {
    const result = parseCurl(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    loadSpec(result.spec);
    setError(null);
    setIgnored(result.ignored);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setError(null);
        }}
      >
        <DialogTrigger render={<Button type="button" variant="outline" />}>
          <Import aria-hidden />
          Import curl
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import curl</DialogTitle>
            <DialogDescription>
              Paste a curl command to replace the request currently in the builder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="curl-command">
              curl command
            </label>
            <Textarea
              aria-describedby={error ? "curl-import-error" : undefined}
              aria-invalid={error ? true : undefined}
              className="min-h-36 font-mono"
              id="curl-command"
              onChange={(event) => {
                setText(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey)
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              placeholder="curl https://api.example.com -H 'Accept: application/json'"
              spellCheck={false}
              value={text}
            />
            {error ? (
              <p
                className="text-sm text-destructive"
                id="curl-import-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button onClick={handleImport} type="button">
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ignored.length > 0 ? (
        <Alert>
          <AlertTitle>
            Ignored {ignored.length} {ignored.length === 1 ? "flag" : "flags"}
          </AlertTitle>
          <AlertDescription className="font-mono">
            {ignored.join(", ")}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
