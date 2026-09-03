"use client";

import { useEffect, useRef } from "react";

import { registerCommand } from "@/lib/commands";
import { HTTP_METHODS, type HttpMethod } from "@/lib/http/types";

type CoreCommandActions = {
  isSending: boolean;
  onSend: () => void;
  onFocusUrl: () => void;
  setMethod: (method: HttpMethod) => void;
};

export function useCoreCommands(actions: CoreCommandActions): void {
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    const disposers = [
      registerCommand({
        id: "send",
        title: "Send request",
        keys: "mod+enter",
        group: "Request",
        run: () => {
          if (!actionsRef.current.isSending) actionsRef.current.onSend();
        },
      }),
      registerCommand({
        id: "focus-url",
        title: "Focus URL",
        keys: "mod+\\",
        group: "Request",
        run: () => actionsRef.current.onFocusUrl(),
      }),
      ...HTTP_METHODS.map((method) =>
        registerCommand({
          id: `method-${method}`,
          title: `Switch method → ${method}`,
          group: "Request",
          run: () => actionsRef.current.setMethod(method),
        }),
      ),
    ];

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, []);
}
