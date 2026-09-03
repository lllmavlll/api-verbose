type QuoteMode = "none" | "single" | "double" | "ansi";

const ANSI_ESCAPES: Record<string, string> = {
  "\\": "\\",
  "'": "'",
  n: "\n",
  r: "\r",
  t: "\t",
};

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let tokenStarted = false;
  let mode: QuoteMode = "none";

  const finishToken = () => {
    if (tokenStarted) {
      tokens.push(token);
      token = "";
      tokenStarted = false;
    }
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (mode === "single") {
      if (character === "'") {
        mode = "none";
      } else {
        token += character;
      }
      continue;
    }

    if (mode === "ansi") {
      if (character === "'") {
        mode = "none";
      } else if (character === "\\") {
        const next = input[index + 1];
        if (next === undefined) {
          throw new Error("unterminated quote");
        }
        token += ANSI_ESCAPES[next] ?? next;
        index += 1;
      } else {
        token += character;
      }
      continue;
    }

    if (mode === "double") {
      if (character === '"') {
        mode = "none";
      } else if (character === "\\") {
        const next = input[index + 1];
        if (next === undefined) {
          throw new Error("unterminated quote");
        }
        if (next !== "\n") {
          token += next;
        }
        index += 1;
      } else {
        token += character;
      }
      continue;
    }

    if (/\s/.test(character)) {
      finishToken();
      continue;
    }

    if (character === "'") {
      tokenStarted = true;
      mode = "single";
    } else if (character === '"') {
      tokenStarted = true;
      mode = "double";
    } else if (character === "$" && input[index + 1] === "'") {
      tokenStarted = true;
      mode = "ansi";
      index += 1;
    } else if (character === "\\") {
      const next = input[index + 1];
      if (next === undefined) {
        throw new Error("unterminated escape");
      }
      if (next !== "\n") {
        tokenStarted = true;
        token += next;
      }
      index += 1;
    } else {
      tokenStarted = true;
      token += character;
    }
  }

  if (mode !== "none") {
    throw new Error("unterminated quote");
  }

  finishToken();
  return tokens;
}
