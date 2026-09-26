import { describe, expect, it } from "vitest";
import { hasPermission, isAdmin, parsePermissions, PERMISSIONS } from "@/lib/permissions";

describe("hasPermission", () => {
  it("grants admins every permission", () => {
    for (const p of PERMISSIONS) expect(hasPermission({ role: "ADMIN", permissions: [] }, p.value)).toBe(true);
  });

  it("grants staff only explicitly granted permissions", () => {
    const staff = { role: "STAFF" as const, permissions: ["VIEW_STUDENTS" as const] };
    expect(hasPermission(staff, "VIEW_STUDENTS")).toBe(true);
    for (const p of PERMISSIONS.filter((x) => x.value !== "VIEW_STUDENTS")) {
      expect(hasPermission(staff, p.value)).toBe(false);
    }
  });

  it("denies students, inactive users and missing actors", () => {
    expect(hasPermission({ role: "STUDENT", permissions: ["VIEW_STUDENTS"] }, "VIEW_STUDENTS")).toBe(false);
    expect(hasPermission({ role: "ADMIN", permissions: [], active: false }, "VIEW_STUDENTS")).toBe(false);
    expect(hasPermission(null, "VIEW_STUDENTS")).toBe(false);
  });

  it("only admins are admins", () => {
    expect(isAdmin({ role: "STAFF", permissions: PERMISSIONS.map((p) => p.value) })).toBe(false);
    expect(isAdmin({ role: "ADMIN", permissions: [] })).toBe(true);
  });

  it("drops unknown permission values from form input", () => {
    expect(parsePermissions(["VIEW_STUDENTS", "SUPERUSER", "VIEW_STUDENTS", 3])).toEqual(["VIEW_STUDENTS"]);
  });
});
