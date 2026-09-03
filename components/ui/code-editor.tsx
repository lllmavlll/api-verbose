"use client";

import { useEffect, useRef } from "react";
import { json } from "@codemirror/lang-json";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";

import { cn } from "@/lib/utils";

type CodeEditorProps = {
  value: string;
  language: "json" | "text";
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

const verboseTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--foreground)",
    fontSize: "0.875rem",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
    minHeight: "8rem",
    padding: "0.75rem 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--muted)",
    borderRight: "1px solid var(--border)",
    color: "var(--muted-foreground)",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklch, var(--muted) 65%, transparent)",
  },
  "&.cm-focused": {
    outline: "2px solid color-mix(in oklch, var(--ring) 50%, transparent)",
    outlineOffset: "-1px",
  },
});

export function CodeEditor({
  value,
  language,
  onChange,
  ariaLabel,
  className,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          Prec.highest(
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => true,
              },
            ]),
          ),
          basicSetup,
          verboseTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          ...(language === "json" ? [json()] : []),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) {
      return;
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return (
    <div
      aria-label={ariaLabel}
      className={cn("overflow-hidden rounded-md border bg-background", className)}
      ref={hostRef}
    />
  );
}
