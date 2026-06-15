# Spec: AI cover illustrations (text-to-image) — POST-LAUNCH

> **Status: design only. Not a launch feature.** Adds a new EU image-model
> dependency, real per-image cost, and extra store-review scrutiny of AI image
> generation — none of which should gate the first Google Play submission. Build
> after the core is live and the per-org AI metering/cap exists.

## What this is

An **optional, decorative cover illustration** generated for a post — a friendly
cartoon-style image shown next to the real notice in the feed. It is an
**addition**, never a replacement for the photo of the board.

## The one rule that makes it safe: text-to-image, never image-to-image

The cover is generated **from the already-redacted, extracted content** — the
`title`, `summary`, and `content_type` produced by `extract()` — **not** from the
raw board photo. By the time this stage runs, all PII is masked to `[NAME_1]`
placeholders (`worker/src/aushang_worker/redaction.py`). So the image prompt
carries **zero PII**, exactly like the existing text LLM call. This preserves the
founding principle: **raw photos never leave our infra; nothing PII-bearing
reaches an external model.** Image-to-image (feeding the photo to a stylizer)
would send un-redacted PII out and is permanently off the table.

## Guardrails (non-negotiable for a childcare product)

- **No people.** The prompt must produce objects/scenes only — a sun, a plate of
  food, a calendar, autumn leaves. **Never a rendered child or any person.**
- **Decorative only.** It must not depict the notice's factual content (no
  "illustrate the event"), to avoid a cheerful image landing next to a closure or
  illness notice. Tie the style to `content_type` + a neutral mood, not to the
  specifics.
- **Human-confirmed.** Like everything else in this app, an admin sees the cover
  in `/review` and **confirms, regenerates, or skips** before any member sees it.
  Nothing auto-publishes. (Preserves "LLM advises, deterministic code / a human
  decides.")
- **Photo stays.** The real (blurred) image remains available; the cover never
  hides ground truth.

## Where it slots into the pipeline

`worker/src/aushang_worker/pipeline.py` → `process_job`, a new step **6.5**:

```
3 OCR → 4 redact → 5 blur → 6 extract (text)  →  6.5 generate cover  →  7 callback
```

- 6.5 builds a prompt from `envelope.content_type_suggested` + a fixed,
  no-people style template (NOT the free-text summary, to bound what's depicted).
- Calls the **EU-hosted image API** (decision: EU API, not US, not self-host).
- Uploads the result and passes a `cover_image_path` in the callback.
- **Fail-open:** if generation errors or is over the org's cap, skip the cover
  and write the draft anyway (the post must never fail for a missing decoration).

## Data / code changes (when built)

- **New column** `posts.cover_image_path text null` (a new migration, next number
  after the latest). Public/non-PII — readable by `authenticated` like
  `redacted_image_path` (`src/lib/database.types.ts:75`); add to `posts_public`.
  **Not** PII, so no REVOKE (unlike `source_image_path`, which stays REVOKE'd).
- **New storage bucket** `cover-photos` (public-read or signed like
  `redacted-photos`), parallel to the upload in
  `src/app/api/worker/callback/route.ts:52-59`.
- **Callback** (`worker/callback/route.ts`): accept a second image part
  (`cover_image`), upload it, pass `p_cover_path` to `worker_write_draft` (RPC
  gets one new param).
- **Review UI** (`src/app/(app)/review/`): show the cover with confirm /
  regenerate / remove. Regenerate re-triggers only step 6.5 (cheap path), not the
  whole pipeline.
- **Worker config**: new env `IMAGE_API_KEY` + `IMAGE_API_URL` (EU endpoint),
  stored on the worker only — same secret-boundary as `ANTHROPIC_API_KEY`
  (`worker/src/aushang_worker/config.py`). Never in the web app.

## Cost (chosen model: FLUX.1 [schnell], EU-hosted)

**Per image: ~$0.003–$0.01 (~€0.005–€0.01).** FLUX.1 [schnell] is the
fast/distilled tier — cheap, fast, good quality, the right fit for a small
decorative cover. (For reference: SDXL is similar; FLUX dev/pro ~$0.025–0.05 is
overkill; top-tier Imagen/GPT-Image-class $0.04–0.19 is mostly US-hosted and off
the table for EU-only.)

In context:

- **Per org/month** (~20 boards, one cover each): **~€0.20.** A heavy org at 100
  boards/month: **~€1.** Trivial against any SaaS fee.
- **~3–10× the Haiku text-extraction cost per post** (text is ~€0.001–0.003), so
  the cover is the most expensive pipeline step — but still **cents per org per
  month** in absolute terms. It does **not** threaten unit economics; bundle it
  into the subscription (do not charge per-image).
- **The real cost multiplier is the regenerate button**, not the per-image price.
  Cap **generations per org per month**, not just posts — an admin regenerating
  4× to get a cover they like 4×'s that post's cost.

## Cost, metering, EU — the things text-to-image does NOT solve on its own

1. **Cost.** Image gen is ~100–1000× the Haiku text-extraction cost (cents–dimes
   per image). This makes the **per-org metering + monthly cap** (see the AI
   billing decision) **mandatory**, not optional. The cap is what stops a runaway
   bill; covers are the most expensive call in the pipeline.
2. **EU residency.** Must use an **EU-region image endpoint** with a DPA, or it
   reintroduces the US-transfer problem the project is removing from the text
   side. Verify the provider's EU region is real before wiring.
3. **Store scrutiny.** Apple/Google review AI image generation closely, and
   anything child-adjacent harder. The no-people / decorative-only guardrail is
   also the store-safety story — document it in the review notes.

## Recommendation

Build only after: (a) Play launch is shipped, (b) per-org AI metering + cap
exists, (c) an EU image endpoint is chosen and DPA-covered. Until then this stays
a v2 "delight" differentiator — "your notices, beautifully illustrated" — not a
blocker. The privacy design above is final; the model/provider and cost controls
are the open work.
