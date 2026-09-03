"use client";

import { AuthPanel } from "@/components/auth-panel";
import { KvTable } from "@/components/kv-table";
import { detectCollisions } from "@/lib/request/compose";
import { useRequestStore } from "@/lib/store/request-store";

export function RequestTabs() {
  const spec = useRequestStore((state) => state.spec);
  const setParams = useRequestStore((state) => state.setParams);
  const setHeaders = useRequestStore((state) => state.setHeaders);
  const setAuth = useRequestStore((state) => state.setAuth);
  const collisions = detectCollisions(spec);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <KvTable
        label="Query Params"
        onChange={setParams}
        overriddenKeys={collisions.paramKeys}
        rows={spec.params}
      />
      <KvTable
        label="Headers"
        onChange={setHeaders}
        overriddenKeys={collisions.headerKeys}
        rows={spec.headers}
      />
      <div className="lg:col-span-2">
        <AuthPanel auth={spec.auth} onChange={setAuth} />
      </div>
    </div>
  );
}
