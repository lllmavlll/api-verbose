import type { RequestSpec } from "@/lib/http/types";

import { generateCurl } from "./curl";
import { generateFetch } from "./fetch";
import { generatePython } from "./python";

export type CodegenTarget = "curl" | "fetch" | "python";

export interface Codegen {
  id: CodegenTarget;
  label: string;
  generate: (spec: RequestSpec) => string;
}

export const codegens: Codegen[] = [
  { id: "curl", label: "curl", generate: generateCurl },
  { id: "fetch", label: "fetch (JS)", generate: generateFetch },
  { id: "python", label: "Python (requests)", generate: generatePython },
];

export function generate(target: CodegenTarget, spec: RequestSpec): string {
  const codegen = codegens.find(({ id }) => id === target);
  if (!codegen) throw new Error(`Unknown code generation target: ${target}`);
  return codegen.generate(spec);
}
