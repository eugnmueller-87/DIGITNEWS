/**
 * Render-time placeholder sanitizer for MEMBER-FACING text.
 *
 * The worker replaces PII with one-way tokens of the form `[TYPE_n]`
 * (e.g. [NAME_1], [ORT_2], [TEL_1]) BEFORE anything leaves our infra. Those
 * tokens can survive into the LLM-built payload (e.g. a notice like
 * "[NAME_1] ihrer Kinder"), and showing a raw `[NAME_1]` to parents looks
 * broken. This strips them at the last render step.
 *
 * PRIVACY: this is purely presentational and STRICTLY one-way — it only ever
 * removes/obscures a token, never reverses it to the original value. It can show
 * LESS than the stored token, never more. It is a last-line guard, not the
 * primary redaction (that happens in the worker, fail-closed).
 */

// [TYPE_n]: uppercase German type label (incl. ÄÖÜ), underscore, 1-based index.
const PLACEHOLDER = /\[[A-ZÄÖÜ]+_\d+\]/g;

export function maskPlaceholders<T extends string | null | undefined>(s: T): T {
  if (typeof s !== "string") return s;
  return s
    .replace(PLACEHOLDER, "") // drop the token entirely (user chose "remove")
    .replace(/\s{2,}/g, " ") // collapse the resulting double spaces
    .replace(/\s+([,.;:!?])/g, "$1") // tidy a space left before punctuation
    .trim() as T;
}
