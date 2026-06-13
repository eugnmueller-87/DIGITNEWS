#!/usr/bin/env node
/**
 * Public-repo guard: fail if a real SECRET value was committed to source.
 *
 * The repo is public. Secrets must live only in gitignored `.env.local` (app)
 * and on the worker host — never in tracked files. This complements
 * `check-no-client-secrets.mjs` (which scans the *built* client bundle): this
 * one scans *source* and runs in CI on every PR, so a leak is blocked BEFORE it
 * merges rather than caught after a build.
 *
 * It matches secret VALUE SHAPES (JWTs, provider key prefixes, connection
 * strings), not variable names — so the legitimate placeholders and docs
 * (`.env.example`, README, brand config) don't trip it. Add real exceptions to
 * ALLOW below with a comment explaining why they're safe.
 *
 * Usage:  node scripts/check-no-source-secrets.mjs
 * Scans `git ls-files` (tracked files only), skipping the patterns in SKIP.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Paths we never scan (binaries, lockfiles, this script + its sibling which
// legitimately contain the var-name strings we hunt for).
const SKIP = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)\.next\//,
  /(^|\/)node_modules\//,
  /\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf|pdf)$/i,
  /(^|\/)scripts\/check-no-(source|client)-secrets\.mjs$/,
];

// Secret VALUE patterns. Each must match an actual credential shape, not a name.
const PATTERNS = [
  // Supabase / any JWT: header.payload.signature, all base64url, payload long.
  {
    name: "JWT (Supabase key / token)",
    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/g,
  },
  // Resend API key.
  { name: "Resend API key", re: /\bre_[A-Za-z0-9]{20,}\b/g },
  // sk- prefix covers Anthropic (sk-ant-...) and OpenAI-style keys.
  { name: "sk- style API key", re: /\bsk-[A-Za-z0-9-]{20,}\b/g },
  // Anthropic / LLM key assigned to an *_API_KEY var (24+ url-safe chars).
  {
    name: "LLM API key assignment",
    re: /(?:ANTHROPIC|MISTRAL)_API_KEY\s*[:=]\s*["']?[A-Za-z0-9_-]{24,}["']?/g,
  },
  // Postgres/Supabase connection string with embedded password.
  {
    name: "Postgres connection string with password",
    re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^\s"']+/g,
  },
  // VAPID private key looks like a base64url blob assigned to the private var.
  {
    name: "VAPID_PRIVATE_KEY value",
    re: /VAPID_PRIVATE_KEY\s*[:=]\s*["'][A-Za-z0-9_-]{30,}["']/g,
  },
  // Worker shared secret with a real-looking value.
  {
    name: "WORKER_SHARED_SECRET value",
    re: /WORKER_SHARED_SECRET\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/g,
  },
];

// Known-safe literals that match a pattern but are intentional & public.
const ALLOW = new Set([
  // Resend's PUBLIC shared test sender — not our key, documented by Resend.
  "onboarding@resend.dev",
  // Placeholders in the worker deploy guide — instructions, not real values.
  "PASTE_THE_SHARED_SECRET",
  "PASTE_YOUR_ANTHROPIC_KEY",
]);

function tracked() {
  return execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => !SKIP.some((re) => re.test(f)));
}

const hits = [];
for (const file of tracked()) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue; // unreadable / binary
  }
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const value = m[0];
      if ([...ALLOW].some((a) => value.includes(a))) continue;
      // Locate line number for a useful message.
      const line = content.slice(0, m.index).split("\n").length;
      hits.push({ file, line, name, snippet: value.slice(0, 24) + "…" });
    }
  }
}

if (hits.length > 0) {
  console.error("❌ POSSIBLE SECRET committed to source (repo is PUBLIC):");
  for (const h of hits) {
    console.error(`   ${h.file}:${h.line}  ${h.name}  →  ${h.snippet}`);
  }
  console.error(
    "\nIf this is a real secret: remove it, then ROTATE the key (deleting the\n" +
      "commit is not enough on a public repo). If it's a safe placeholder, add it\n" +
      "to ALLOW in scripts/check-no-source-secrets.mjs with a comment.",
  );
  process.exit(1);
}

console.log("✅ check-no-source-secrets: no secret values found in source.");
