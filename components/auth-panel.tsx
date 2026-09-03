"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Auth } from "@/lib/http/types";

type AuthPanelProps = {
  auth: Auth;
  onChange: (auth: Auth) => void;
};

const AUTH_LABELS: Record<Auth["kind"], string> = {
  none: "None",
  bearer: "Bearer token",
  basic: "Basic",
  apikey: "API key",
};

function initialAuth(kind: Auth["kind"]): Auth {
  switch (kind) {
    case "none":
      return { kind: "none" };
    case "bearer":
      return { kind: "bearer", token: "" };
    case "basic":
      return { kind: "basic", username: "", password: "" };
    case "apikey":
      return { kind: "apikey", name: "", value: "", in: "header" };
  }
}

export function AuthPanel({ auth, onChange }: AuthPanelProps) {
  return (
    <section
      aria-label="Auth"
      className="rounded-lg border bg-background/60"
      role="region"
    >
      <div className="border-b px-3 py-2.5">
        <h2 className="text-sm font-medium">Auth</h2>
      </div>
      <div className="space-y-4 p-3">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="auth-kind">Preset</Label>
          <Select
            onValueChange={(value) => {
              if (value) onChange(initialAuth(value as Auth["kind"]));
            }}
            value={auth.kind}
          >
            <SelectTrigger
              aria-label="Auth preset"
              className="w-full"
              id="auth-kind"
            >
              <SelectValue>{AUTH_LABELS[auth.kind]}</SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="bearer">Bearer token</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="apikey">API key</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {auth.kind === "none" ? (
          <p className="text-sm text-muted-foreground">
            No authentication will be added to the request.
          </p>
        ) : null}

        {auth.kind === "bearer" ? (
          <div className="max-w-xl space-y-2">
            <Label htmlFor="auth-token">Token</Label>
            <Input
              autoComplete="off"
              className="font-mono"
              id="auth-token"
              onChange={(event) =>
                onChange({ kind: "bearer", token: event.target.value })
              }
              placeholder="Bearer token"
              value={auth.token}
            />
          </div>
        ) : null}

        {auth.kind === "basic" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="auth-username">Username</Label>
              <Input
                autoComplete="username"
                className="font-mono"
                id="auth-username"
                onChange={(event) =>
                  onChange({ ...auth, username: event.target.value })
                }
                value={auth.username}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                autoComplete="current-password"
                className="font-mono"
                id="auth-password"
                onChange={(event) =>
                  onChange({ ...auth, password: event.target.value })
                }
                type="password"
                value={auth.password}
              />
            </div>
          </div>
        ) : null}

        {auth.kind === "apikey" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="auth-api-key-name">API key name</Label>
                <Input
                  autoComplete="off"
                  className="font-mono"
                  id="auth-api-key-name"
                  onChange={(event) =>
                    onChange({ ...auth, name: event.target.value })
                  }
                  placeholder="X-Api-Key"
                  value={auth.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-api-key-value">API key value</Label>
                <Input
                  autoComplete="off"
                  className="font-mono"
                  id="auth-api-key-value"
                  onChange={(event) =>
                    onChange({ ...auth, value: event.target.value })
                  }
                  value={auth.value}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Send in</Label>
              <Tabs
                aria-label="API key location"
                onValueChange={(value) =>
                  onChange({ ...auth, in: value as "header" | "query" })
                }
                value={auth.in}
              >
                <TabsList>
                  <TabsTrigger value="header">Header</TabsTrigger>
                  <TabsTrigger value="query">Query param</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
