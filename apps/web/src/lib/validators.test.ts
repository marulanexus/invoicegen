import { describe, expect, it } from "vitest";

import { documentSchema } from "./validators";

const base = { type: "invoice", issueDate: "2026-09-27", lineItems: [{ description: "Work" }] };

describe("documentSchema dates", () => {
  it("accepts real dates and empty/null optional dates", () => {
    expect(documentSchema.safeParse(base).success).toBe(true);
    expect(documentSchema.safeParse({ ...base, dueDate: "2026-10-27" }).success).toBe(true);
    expect(documentSchema.safeParse({ ...base, dueDate: "" }).success).toBe(true);
    expect(documentSchema.safeParse({ ...base, dueDate: null }).success).toBe(true);
  });

  it.each(["2026-02-31", "27/09/2026", "2026-9-7", "tomorrow", ""])(
    "rejects issueDate %j",
    (issueDate) => {
      expect(documentSchema.safeParse({ ...base, issueDate }).success).toBe(false);
    }
  );

  it("rejects an impossible due date", () => {
    expect(documentSchema.safeParse({ ...base, dueDate: "2026-13-01" }).success).toBe(false);
  });
});
