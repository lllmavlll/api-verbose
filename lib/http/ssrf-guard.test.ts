import { describe, expect, it, vi } from "vitest";

import {
  assertTargetAllowed,
  checkUrl,
  isBlockedAddress,
  resolveTarget,
} from "./ssrf-guard";

describe("checkUrl", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://host/path",
    "gopher://host",
    "data:text/plain,hello",
    "not a url",
  ])("blocks unsupported or invalid target %s", (url) => {
    expect(checkUrl(url)).toMatchObject({
      allowed: false,
      code: "blocked-scheme",
    });
  });

  it.each(["http://example.com", "https://example.com/path"])(
    "allows absolute HTTP target %s",
    (url) => {
      expect(checkUrl(url)).toMatchObject({ allowed: true });
    },
  );
});

describe("isBlockedAddress", () => {
  it.each([
    "0.0.0.0",
    "0.255.255.255",
    "10.1.2.3",
    "100.64.0.1",
    "100.127.255.254",
    "127.0.0.1",
    "169.254.1.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "168.63.129.16",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fdff:ffff::1",
    "fd00:ec2::254",
    "fe80::1",
    "febf:ffff::1",
    "ff02::1",
    "4000::1",
    "fec0::1",
    "2001:db8::1",
    "64:ff9b::a00:1",
    "2002:0a00:0001::",
    "::ffff:0.0.0.0",
    "::ffff:10.0.0.1",
    "::ffff:100.64.0.1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:172.16.0.1",
    "::ffff:192.168.0.1",
    "::ffff:168.63.129.16",
    "::ffff:198.18.0.1",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    "1.1.1.1",
    "8.8.8.8",
    "93.184.216.34",
    "100.128.0.1",
    "172.15.255.255",
    "172.32.0.0",
    "2606:2800:220:1:248:1893:25c8:1946",
    "2001:4860:4860::8888",
  ])("allows %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it.each(["", "example.com", "999.1.1.1", "hello::world"])(
    "treats malformed address %s as blocked",
    (address) => {
      expect(isBlockedAddress(address)).toBe(true);
    },
  );
});

describe("resolveTarget", () => {
  it("rejects a hostname when any answer is blocked", async () => {
    const resolve = async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "10.0.0.1", family: 4 as const },
    ];

    await expect(
      resolveTarget("https://mixed.example", resolve),
    ).resolves.toMatchObject({ allowed: false, code: "blocked-address" });
  });

  it("returns the exact public answer that the transport must pin", async () => {
    const resolve = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 as const },
    ]);

    await expect(
      resolveTarget("https://good.example/path", resolve),
    ).resolves.toMatchObject({
      allowed: true,
      url: expect.objectContaining({ hostname: "good.example" }),
      address: { address: "93.184.216.34", family: 4 },
    });
    expect(resolve).toHaveBeenCalledWith("good.example");
  });

  it("checks a literal target without performing DNS resolution", async () => {
    const resolve = vi.fn();

    await expect(
      resolveTarget("https://93.184.216.34/path", resolve),
    ).resolves.toMatchObject({
      allowed: true,
      address: { address: "93.184.216.34", family: 4 },
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("blocks a literal metadata address without resolution", async () => {
    const resolve = vi.fn();

    await expect(
      resolveTarget("http://169.254.169.254/latest/meta-data", resolve),
    ).resolves.toMatchObject({ allowed: false, code: "blocked-address" });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("fails closed when DNS yields no addresses", async () => {
    await expect(
      resolveTarget("https://empty.example", async () => []),
    ).resolves.toMatchObject({ allowed: false, code: "blocked-address" });
  });

  it("exposes a verdict-only compatibility helper", async () => {
    await expect(
      assertTargetAllowed("https://good.example", async () => [
        { address: "93.184.216.34", family: 4 },
      ]),
    ).resolves.toEqual({ allowed: true });
  });
});
