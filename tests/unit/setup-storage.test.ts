import { describe, expect, it } from "vitest";
import { storageMode } from "@/lib/storage";
import { setupKeyMatches } from "@/lib/setup";

describe("recording storage", () => {
  it("is off unless explicitly set to local or vercel-blob", () => {
    expect(storageMode({})).toBe("none");
    expect(storageMode({ STORAGE_PROVIDER: "" })).toBe("none");
    expect(storageMode({ STORAGE_PROVIDER: "s3" })).toBe("none");
    expect(storageMode({ STORAGE_PROVIDER: "local" })).toBe("local");
    expect(storageMode({ STORAGE_PROVIDER: "vercel-blob" })).toBe("vercel-blob");
  });
});

describe("setup key", () => {
  it("matches only the exact provisioner password, and never when it is unset", () => {
    expect(setupKeyMatches("s3cret-value", "s3cret-value")).toBe(true);
    expect(setupKeyMatches("s3cret-valuE", "s3cret-value")).toBe(false);
    expect(setupKeyMatches("", "s3cret-value")).toBe(false);
    expect(setupKeyMatches("", undefined)).toBe(false);
    expect(setupKeyMatches("anything", "")).toBe(false);
  });
});
