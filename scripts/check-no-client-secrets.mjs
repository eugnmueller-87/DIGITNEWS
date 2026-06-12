#!/usr/bin/env node
/**
 * CI guard: fail if any server secret leaked into the CLIENT bundle.
 *
 * Brief §11: "grep CI guard against NEXT_PUBLIC_ leaks of any secret". We scan
 * the built client chunks (.next/static) for tell-tale secret markers. The
 * service-role key and other secrets are NEVER prefixed NEXT_PUBLIC_, so they
 * must never appear in client output. If they do, the `server-only` guard was
 * bypassed somewhere — hard fail.
 *
 * Run AFTER `next build`:  node scripts/check-no-client-secrets.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = ".next/static";

// Strings that must NEVER appear in a client chunk. Add the literal secret env
// VAR NAMES (not values) plus structural giveaways of a leaked service key.
const FORBIDDEN = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  // The actual secret values, pulled from the environment at check time, so a
  // real key value can never slip through even if the var name is obfuscated.
  process.env.SUPABASE_SERVICE_ROLE_KEY,
].filter(
  (s) =>
    typeof s === "string" &&
    s.length > 0 &&
    s !== "placeholder-service-role-key",
);

function walk(dir) {
  let files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files; // dir absent (no build yet)
  }
  for (const e of entries) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) files = files.concat(walk(p));
    else if (/\.(js|mjs|cjs)$/.test(e)) files.push(p);
  }
  return files;
}

const files = walk(CLIENT_DIR);
if (files.length === 0) {
  console.error(
    `check-no-client-secrets: no client chunks found in ${CLIENT_DIR}. Run \`next build\` first.`,
  );
  process.exit(2);
}

const hits = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const needle of FORBIDDEN) {
    if (content.includes(needle)) {
      hits.push({ file, needle });
    }
  }
}

if (hits.length > 0) {
  console.error("❌ SECRET LEAK DETECTED in client bundle:");
  for (const h of hits) {
    console.error(`   ${h.file}  contains  "${h.needle}"`);
  }
  process.exit(1);
}

console.log(
  `✅ check-no-client-secrets: scanned ${files.length} client chunks, no secrets found.`,
);
