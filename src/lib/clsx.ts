/**
 * Tiny className combiner. Avoids pulling in a dependency for trivial class
 * merging (Brief §11: keep the dependency surface minimal).
 */
export function clsx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
