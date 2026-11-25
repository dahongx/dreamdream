import { describe, expect, test } from "bun:test";
import { toLocalOptimizableMediaSrc } from "@/lib/media/optimizable-src";

describe("toLocalOptimizableMediaSrc", () => {
  test("keeps local paths unchanged", () => {
    expect(toLocalOptimizableMediaSrc("/api/media/imported/a.jpg")).toBe(
      "/api/media/imported/a.jpg",
    );
  });

  test("converts Supabase public media URLs to the local media proxy", () => {
    expect(
      toLocalOptimizableMediaSrc(
        "https://example.supabase.co/storage/v1/object/public/media/imported/a.jpg",
      ),
    ).toBe("/api/media/imported/a.jpg");
  });

  test("converts legacy self-hosted storage URLs to the local media proxy", () => {
    expect(
      toLocalOptimizableMediaSrc(
        "http://115.29.213.73:8000/storage/v1/object/public/media/mufy/a.jpg?width=430",
      ),
    ).toBe("/api/media/mufy/a.jpg?width=430");
  });

  test("converts absolute /api/media URLs without keeping their host", () => {
    expect(
      toLocalOptimizableMediaSrc("https://chat.dearm.ai/api/media/mufy/a.jpg"),
    ).toBe("/api/media/mufy/a.jpg");
  });

  test("leaves third-party images unchanged", () => {
    const src = "https://cdn.example.com/images/a.jpg";
    expect(toLocalOptimizableMediaSrc(src)).toBe(src);
  });
});
