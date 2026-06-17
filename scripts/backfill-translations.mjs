#!/usr/bin/env node
/**
 * One-off backfill: translate ALREADY-PUBLISHED posts into the non-German locales.
 *
 * New posts are translated automatically at publish (see review/actions.ts ->
 * triggerTranslation). This script covers posts that were published BEFORE that
 * shipped: it finds published posts (and their confirmed events) that lack a
 * translation row and re-fires the same worker /translate path, which calls back
 * to /api/worker/translation-callback and writes the rows.
 *
 * It sends ONLY member-safe content (the published title/body, the structured
 * extraction.payload, and event titles) — never raw OCR or the source image.
 *
 * Idempotent: a post that already has both target locales is skipped, so re-runs
 * are cheap. Rate-limited (sequential with a small delay) to be gentle on the LLM.
 *
 * Env (read from process.env; load .env.local first, e.g. via `node --env-file`):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (DB access)
 *   WORKER_URL, WORKER_SHARED_SECRET                     (worker /translate)
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-translations.mjs [--locales en,ru] [--limit N] [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
    return args[idx + 1];
  }
  return fallback;
};
const DRY_RUN = args.includes("--dry-run");
const LOCALES = getArg("locales", "en,ru")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LIMIT = Number(getArg("limit", "0")) || 0; // 0 = no limit

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_URL = process.env.WORKER_URL;
const WORKER_SECRET = process.env.WORKER_SHARED_SECRET;

function requireEnv(name, value) {
  if (!value) {
    console.error(
      `Missing env ${name}. Run with: node --env-file=.env.local scripts/backfill-translations.mjs`,
    );
    process.exit(1);
  }
  return value;
}
requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
requireEnv("WORKER_URL", WORKER_URL);
requireEnv("WORKER_SHARED_SECRET", WORKER_SECRET);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // All published posts (service role bypasses RLS, so this is cross-org — the
  // operator runs the backfill once over everything).
  let query = db
    .from("posts")
    .select("id, org_id, title, body, extraction")
    .eq("status", "published")
    .order("published_at", { ascending: true });
  if (LIMIT > 0) query = query.limit(LIMIT);
  const { data: posts, error } = await query;
  if (error) {
    console.error("Failed to read posts:", error.message);
    process.exit(1);
  }

  // Which (post_id, locale) translations already exist — to skip done work.
  const { data: existing } = await db
    .from("post_translations")
    .select("post_id, locale");
  const have = new Set((existing ?? []).map((r) => `${r.post_id}:${r.locale}`));

  let triggered = 0;
  let skipped = 0;

  for (const post of posts ?? []) {
    const missing = LOCALES.filter((l) => !have.has(`${post.id}:${l}`));
    if (missing.length === 0) {
      skipped++;
      continue;
    }

    const payload =
      post.extraction && typeof post.extraction === "object"
        ? (post.extraction.payload ?? null)
        : null;

    const { data: events } = await db
      .from("events")
      .select("id, title")
      .eq("post_id", post.id);

    const reqBody = {
      post_id: post.id,
      org_id: post.org_id,
      title: post.title ?? "",
      body: post.body ?? "",
      payload: payload && typeof payload === "object" ? payload : null,
      events: (events ?? []).map((e) => ({ id: e.id, title: e.title })),
      locales: missing,
    };

    if (DRY_RUN) {
      console.log(
        `[dry-run] would translate ${post.id} -> ${missing.join(",")}` +
          ` (${(events ?? []).length} events)`,
      );
      triggered++;
      continue;
    }

    const res = await fetch(`${WORKER_URL.replace(/\/$/, "")}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": WORKER_SECRET,
      },
      body: JSON.stringify(reqBody),
    });
    if (res.ok) {
      triggered++;
      console.log(`triggered ${post.id} -> ${missing.join(",")}`);
    } else {
      console.warn(`FAILED ${post.id}: HTTP ${res.status}`);
    }

    // Gentle pacing so we don't hammer the LLM / worker.
    await sleep(750);
  }

  console.log(
    `\nDone. Triggered: ${triggered}, already-complete (skipped): ${skipped}, ` +
      `total published: ${(posts ?? []).length}.`,
  );
  console.log(
    "Translations land asynchronously via the worker callback — re-run with " +
      "--dry-run later to confirm coverage.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
