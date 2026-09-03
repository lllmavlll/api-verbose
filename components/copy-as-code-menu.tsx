"use client";

import { ChevronDown, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { codegens, generate, type CodegenTarget } from "@/lib/codegen";
import { useRequestStore } from "@/lib/store/request-store";

export function CopyAsCodeMenu() {
  const spec = useRequestStore((state) => state.spec);
  const [message, setMessage] = useState("");

  async function copy(target: CodegenTarget, label: string) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(generate(target, spec));
      setMessage(`Copied as ${label}`);
    } catch {
      setMessage("Clipboard unavailable — copy permission may be blocked.");
    }
  }

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={spec.url.trim() === ""}
          render={<Button type="button" variant="outline" />}
        >
          <Copy aria-hidden />
          Copy as
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {codegens.map(({ id, label }) => (
            <DropdownMenuItem
              key={id}
              onClick={() => {
                void copy(id, label);
              }}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <p aria-live="polite" className="text-xs text-muted-foreground" role="status">
        {message}
      </p>
    </div>
  );
}
