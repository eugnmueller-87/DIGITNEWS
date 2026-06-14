"use client";

import { useEffect } from "react";

import { markCategorySeen, type SeenCategory } from "./actions";

/**
 * Fire-and-forget: marks a category as seen for the current member once, on
 * mount, so its "new since last visit" badge on the Bereiche hub clears. Renders
 * nothing. Dropped onto each category page (feed, essensplan, …). Side-effect
 * lives in an effect (not render) so it runs exactly once per visit, client-side.
 */
export function MarkSeen({ category }: { category: SeenCategory }) {
  useEffect(() => {
    void markCategorySeen(category);
  }, [category]);
  return null;
}
