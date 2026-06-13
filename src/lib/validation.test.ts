import { describe, expect, it } from "vitest";

import {
  parseAssignableRole,
  parseEmail,
  parseJoinCode,
  parseNonEmpty,
  parseOrgType,
  safeNextPath,
} from "@/lib/validation";

describe("parseEmail", () => {
  it("normalizes case and trims", () => {
    expect(parseEmail("  Foo@Example.COM ")).toBe("foo@example.com");
  });
  it("rejects malformed / empty / over-length addresses", () => {
    expect(() => parseEmail("not-an-email")).toThrow();
    expect(() => parseEmail("a@b")).toThrow();
    expect(() => parseEmail("")).toThrow();
    expect(() => parseEmail(null)).toThrow();
    expect(() => parseEmail("a".repeat(250) + "@example.com")).toThrow();
  });
});

describe("parseNonEmpty", () => {
  it("trims and returns the value", () => {
    expect(parseNonEmpty("  hi  ", "Feld")).toBe("hi");
  });
  it("rejects empty/whitespace and over-length", () => {
    expect(() => parseNonEmpty("   ", "Feld")).toThrow();
    expect(() => parseNonEmpty(null, "Feld")).toThrow();
    expect(() => parseNonEmpty("x".repeat(11), "Feld", 10)).toThrow();
  });
});

describe("parseOrgType", () => {
  it("accepts known types, rejects unknown", () => {
    expect(parseOrgType("kita")).toBe("kita");
    expect(() => parseOrgType("startup")).toThrow();
    expect(() => parseOrgType(null)).toThrow();
  });
});

describe("parseJoinCode", () => {
  it("accepts a safe-charset code in range", () => {
    expect(parseJoinCode("jc-AbC_123-xyz")).toBe("jc-AbC_123-xyz");
  });
  it("rejects too-short / spaced / injection-y codes", () => {
    expect(() => parseJoinCode("short")).toThrow();
    expect(() => parseJoinCode("has space")).toThrow();
    expect(() => parseJoinCode("semi;colon;injection")).toThrow();
  });
});

describe("parseAssignableRole", () => {
  it("allows member always, defaults to member", () => {
    expect(parseAssignableRole("member", false)).toBe("member");
    expect(parseAssignableRole(null, false)).toBe("member");
  });
  it("allows admin only when permitted; never superadmin", () => {
    expect(parseAssignableRole("admin", true)).toBe("admin");
    expect(() => parseAssignableRole("admin", false)).toThrow();
    expect(() => parseAssignableRole("superadmin", true)).toThrow();
  });
});

describe("safeNextPath (open-redirect guard)", () => {
  it("allows same-origin absolute paths", () => {
    expect(safeNextPath("/kalender")).toBe("/kalender");
  });
  it("falls back to /feed when absent", () => {
    expect(safeNextPath(null)).toBe("/feed");
    expect(safeNextPath(undefined)).toBe("/feed");
    expect(safeNextPath("")).toBe("/feed");
  });
  it("rejects protocol-relative, cross-origin, and control-char paths", () => {
    expect(safeNextPath("//evil.com")).toBe("/feed");
    expect(safeNextPath("https://evil.com")).toBe("/feed");
    expect(safeNextPath("/a\\b")).toBe("/feed");
    expect(safeNextPath("/a\nb")).toBe("/feed");
  });
});
