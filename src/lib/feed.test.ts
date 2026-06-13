import { describe, expect, it } from "vitest";

import {
  buildFeedView,
  sortHealthAlerts,
  type FeedAlert,
  type FeedPost,
} from "@/lib/feed";

function alert(over: Partial<FeedAlert>): FeedAlert {
  return {
    id: over.id ?? "x",
    title: over.title ?? "t",
    body: over.body ?? null,
    health_severity: over.health_severity ?? null,
    published_at: over.published_at ?? null,
  };
}

describe("sortHealthAlerts", () => {
  it("orders urgent → advisory → info", () => {
    const out = sortHealthAlerts([
      alert({ id: "info", health_severity: "info" }),
      alert({ id: "urgent", health_severity: "urgent" }),
      alert({ id: "advisory", health_severity: "advisory" }),
    ]);
    expect(out.map((a) => a.id)).toEqual(["urgent", "advisory", "info"]);
  });

  it("treats null severity as info", () => {
    const out = sortHealthAlerts([
      alert({ id: "null-sev", health_severity: null }),
      alert({ id: "advisory", health_severity: "advisory" }),
    ]);
    expect(out.map((a) => a.id)).toEqual(["advisory", "null-sev"]);
  });

  it("sorts newest-first within the same severity", () => {
    const out = sortHealthAlerts([
      alert({
        id: "old",
        health_severity: "urgent",
        published_at: "2026-01-01T00:00:00Z",
      }),
      alert({
        id: "new",
        health_severity: "urgent",
        published_at: "2026-06-01T00:00:00Z",
      }),
    ]);
    expect(out.map((a) => a.id)).toEqual(["new", "old"]);
  });

  it("REGRESSION: an older urgent alert outranks a newer info alert", () => {
    // The bug a DB-side limit could mask: capping by recency before ranking by
    // severity could drop this urgent alert entirely.
    const out = sortHealthAlerts([
      alert({
        id: "new-info",
        health_severity: "info",
        published_at: "2026-06-01T00:00:00Z",
      }),
      alert({
        id: "old-urgent",
        health_severity: "urgent",
        published_at: "2026-01-01T00:00:00Z",
      }),
    ]);
    expect(out[0].id).toBe("old-urgent");
  });

  it("does not mutate the input array", () => {
    const input = [
      alert({ id: "info", health_severity: "info" }),
      alert({ id: "urgent", health_severity: "urgent" }),
    ];
    const snapshot = input.map((a) => a.id);
    sortHealthAlerts(input);
    expect(input.map((a) => a.id)).toEqual(snapshot);
  });

  it("handles an empty list", () => {
    expect(sortHealthAlerts([])).toEqual([]);
  });
});

describe("buildFeedView", () => {
  const post = (id: string): FeedPost => ({
    id,
    title: id,
    body: null,
    published_at: null,
  });

  it("orders alerts and passes posts through", () => {
    const view = buildFeedView(
      {
        data: [
          alert({ id: "info", health_severity: "info" }),
          alert({ id: "urgent", health_severity: "urgent" }),
        ],
        error: null,
      },
      { data: [post("a"), post("b")], error: null },
    );
    expect(view.alerts.map((a) => a.id)).toEqual(["urgent", "info"]);
    expect(view.posts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(view.loadFailed).toBe(false);
  });

  it("coalesces null data to empty lists", () => {
    const view = buildFeedView(
      { data: null, error: null },
      { data: null, error: null },
    );
    expect(view.alerts).toEqual([]);
    expect(view.posts).toEqual([]);
    expect(view.loadFailed).toBe(false);
  });

  it("flags loadFailed when EITHER query errors (not silently empty)", () => {
    expect(
      buildFeedView(
        { data: null, error: { message: "boom" } },
        { data: [], error: null },
      ).loadFailed,
    ).toBe(true);
    expect(
      buildFeedView(
        { data: [], error: null },
        { data: null, error: { message: "boom" } },
      ).loadFailed,
    ).toBe(true);
  });
});
