import { describe, expect, it } from "vitest";

import {
  cookiesFromHeaders,
  parseSetCookie,
  splitSetCookie,
} from "./parse-set-cookie";

describe("parseSetCookie", () => {
  it("parses a simple name=value pair", () => {
    const [cookie] = parseSetCookie("sid=abc123");

    expect(cookie).toMatchObject({
      name: "sid",
      value: "abc123",
      secure: false,
      httpOnly: false,
    });
  });

  it("parses attributes and flags case-insensitively", () => {
    const [cookie] = parseSetCookie(
      "sid=abc; DOMAIN=example.com; path=/; Expires=Wed, 09 Jun 2027 10:18:14 GMT; secure; HTTPONLY; SameSite=lax",
    );

    expect(cookie).toMatchObject({
      name: "sid",
      value: "abc",
      domain: "example.com",
      path: "/",
      expires: "Wed, 09 Jun 2027 10:18:14 GMT",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    });
  });

  it("captures Max-Age and SameSite=None", () => {
    const [cookie] = parseSetCookie(
      "token=a=b=c; max-age=3600; samesite=none",
    );

    expect(cookie).toMatchObject({
      value: "a=b=c",
      maxAge: "3600",
      sameSite: "None",
    });
  });

  it("preserves the Expires comma while splitting folded cookies", () => {
    const parsed = parseSetCookie(
      "a=1; Path=/, b=2; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Secure, c=3",
    );

    expect(parsed.map((cookie) => cookie.name)).toEqual(["a", "b", "c"]);
    expect(parsed[1]).toMatchObject({
      value: "2",
      expires: "Wed, 09 Jun 2027 10:18:14 GMT",
      secure: true,
    });
  });

  it("ignores unknown attributes without dropping the row", () => {
    const [cookie] = parseSetCookie("a=1; Priority=High; Partitioned");

    expect(cookie).toMatchObject({ name: "a", value: "1" });
  });

  it("degrades malformed values to a recoverable row", () => {
    expect(() => parseSetCookie("brokencookie")).not.toThrow();
    expect(parseSetCookie("brokencookie")[0]).toMatchObject({
      name: "brokencookie",
      value: "",
    });
  });

  it("returns no rows for empty input", () => {
    expect(parseSetCookie("")).toEqual([]);
    expect(parseSetCookie("   ")).toEqual([]);
  });
});

describe("splitSetCookie", () => {
  it("keeps the Expires comma inside one entry", () => {
    expect(
      splitSetCookie("a=1, b=2; Expires=Wed, 09 Jun 2027 10:18:14 GMT"),
    ).toEqual(["a=1", "b=2; Expires=Wed, 09 Jun 2027 10:18:14 GMT"]);
  });
});

describe("cookiesFromHeaders", () => {
  it("collects Set-Cookie entries case-insensitively and flattens them", () => {
    const cookies = cookiesFromHeaders([
      ["content-type", "application/json"],
      ["Set-Cookie", "a=1; Path=/"],
      ["set-cookie", "b=2; Secure, c=3"],
    ]);

    expect(cookies.map((cookie) => cookie.name)).toEqual(["a", "b", "c"]);
  });

  it("returns no rows without Set-Cookie", () => {
    expect(cookiesFromHeaders([["content-type", "text/html"]])).toEqual([]);
  });
});
