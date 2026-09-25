import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_NOTICE_TEXT } from "@/lib/demoNotice";

describe("shared-demo disclosure", () => {
  it("tells visitors the account is shared, data is visible to all, it resets, and to avoid personal info", () => {
    expect(DEMO_NOTICE_TEXT).toMatch(/shares? one account/i);
    expect(DEMO_NOTICE_TEXT).toMatch(/visible to all visitors/i);
    expect(DEMO_NOTICE_TEXT).toMatch(/reset/i);
    expect(DEMO_NOTICE_TEXT).toMatch(/personal information/i);
  });

  it("is rendered by the root layout (so it appears on every page) and explained in the Terms", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toContain("<DemoNotice />");
    expect(readFileSync("src/app/terms/page.tsx", "utf8")).toMatch(/shared public demo/i);
  });
});
