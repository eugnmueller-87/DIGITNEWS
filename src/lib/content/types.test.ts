import { describe, expect, it } from "vitest";

import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  ROUTING,
  type ContentType,
} from "@/lib/content/types";

describe("content taxonomy", () => {
  it("has a German label and a routing rule for every content type", () => {
    for (const t of CONTENT_TYPES) {
      expect(CONTENT_TYPE_LABELS[t]).toBeTruthy();
      expect(ROUTING[t]).toBeDefined();
    }
  });
});

describe("ROUTING rules (LLM advises, code decides)", () => {
  it("only event_notice creates calendar events", () => {
    const createsEvents = (Object.keys(ROUTING) as ContentType[]).filter(
      (t) => ROUTING[t].createsEvents,
    );
    expect(createsEvents).toEqual(["event_notice"]);
  });

  it("meal_plan and reflection use post_details; info does not", () => {
    expect(ROUTING.meal_plan.usesPostDetails).toBe(true);
    expect(ROUTING.reflection.usesPostDetails).toBe(true);
    expect(ROUTING.info.usesPostDetails).toBe(false);
  });

  it("info routes to the general feed (no section, no events)", () => {
    expect(ROUTING.info).toEqual({
      section: false,
      usesPostDetails: false,
      createsEvents: false,
    });
  });

  it("event_notice writes to events, not post_details", () => {
    expect(ROUTING.event_notice.usesPostDetails).toBe(false);
  });
});
