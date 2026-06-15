# Spec: admin-defined custom categories — POST-LAUNCH (v2)

> **Status: design only. Build after the Play launch.** Touches the DB, the
> worker prompt, and the review/Bereiche UI. Not a launch feature.

## Goal

Make the app **multi-vertical**. A choir, sports club, or church downloads it and
sees **their** categories ("Probenplan", "Konzerte", "Vereinsheim") — not Kita
ones. Each org's **admin** defines the categories; the AI files each notice into
one of them automatically; members just browse (read-only).

## The key insight: custom NAMES, fixed SHAPES

Two layers, kept separate so we get full flexibility **without** losing the
"deterministic code decides" principle:

- **Category (user-facing, fully custom):** an org-scoped, admin-defined label —
  name, icon, color, order. Unlimited; per org. _This is the flexibility the user
  wants._
- **Shape (internal, fixed set):** every category maps to ONE structural shape the
  **admin picks once** when creating it. The shape — not the AI — decides
  structure + routing, so calendar/ICS/alerts/strict-schema all keep working.

The four shapes generalise today's five content types:

| Shape         | = today's type(s)         | Structure / routing                     |
| ------------- | ------------------------- | --------------------------------------- |
| `dated`       | `event_notice`            | dates → calendar + ICS                  |
| `weekly_plan` | `meal_plan`, `reflection` | week + per-day rows + section library   |
| `alert`       | `health_notice`           | severity → top-of-feed alert            |
| `info`        | `info`                    | freeform sections/bullets, general feed |

> 95%+ of real notice boards fit these four. A genuinely novel shape (e.g. a
> financial table) would need a new shape = a code change — the one accepted
> limit (this is what keeps us out of "AI invents arbitrary structure", which
> would break strict validation + the trust story). See the rejected Version B
> note at the bottom.

## Roles (decided)

- **Admin** (own org only) — creates/renames/reorders categories and picks each
  one's shape. Org-scoped, like members/groups today.
- **Operator** — can manage categories cross-org / seed templates.
- **Member** — **read-only**, sees only their org's categories. No create/edit.
  No public surface; no untrusted input (the scary part of "user-generated
  structure" doesn't exist here).

## What the AI does — classify, not invent

Today the worker forces the LLM into one of 5 hardcoded types. New behaviour: the
worker receives **the org's category list** (names + short descriptions, already
available per-org) and classifies the notice into one of them — a classification
task LLMs do reliably. The **shape** of the chosen category supplies the typed
payload schema, so:

- **AI advises:** which of the admin's categories (pre-selected at review).
- **Deterministic code decides:** structure + routing, via the category's
  admin-assigned shape. Strict schema validation per shape is unchanged.

`org_type` already feeds the prompt (`worker/.../extraction.py` `_system_prompt`);
this extends that to a per-org category list.

## Data model

```
categories                                 -- new, org-scoped, admin-managed
  id uuid pk
  org_id uuid       -- RLS: my_org_id(); admin write, member read
  name text         -- "Probenplan"
  slug text         -- stable key
  shape text        -- CHECK in ('dated','weekly_plan','alert','info')
  icon text, color text, sort_order int
  is_default bool   -- part of the starter set
  created_at
```

- `posts.content_type` (the confirmed type) → generalises to a `category_id` FK
  (nullable, NULL = unconfirmed, same semantics as today). The CHECK-enum on
  `content_type` (in 7 migrations) is replaced by the FK + the category's shape.
- Routing reads the **category's shape**, exactly where it reads `content_type`
  today (`ROUTING` in `src/lib/content/types.ts`).
- RLS: admin CRUD on own org's categories (security-definer or policy), member
  SELECT only. Members can never write — mirrors the existing model.

## Onboarding / templates

- The current 5 types become the **default Kita category set** (`is_default`), so
  existing orgs are unchanged — they just become editable.
- At org creation the admin picks a **starter set** by `org_type`: Kita / Verein /
  Kirche / Sportclub / blank. Ships sensible categories + shapes; the admin edits
  from there.

## UI

- **Admin:** "Bereiche verwalten" (under `/admin`, like members/groups) —
  add/rename/reorder, pick shape per category, choose icon/color.
- **Review:** the AI's suggested category is pre-selected from the org's list
  (same chip UX as today's content-type confirmation); admin confirms or re-files.
- **Member:** the Bereiche hub renders the org's categories — read-only, exactly
  as today but org-defined instead of hardcoded.

## Build phases (post-launch)

1. `categories` table + RLS + seed the 5 defaults for every existing org
   (backfill from `content_type`). App reads categories instead of the enum;
   no behaviour change yet (Kita orgs look identical).
2. Admin "Bereiche verwalten" CRUD + shape picker + starter templates per
   `org_type`.
3. Worker: pass the org's category list into the prompt; classify into it;
   map the chosen category's shape to the existing typed payload.
4. Polish: icons/colors, reorder, per-vertical default sets.

## Why NOT fully free-form (Version B), recorded

Considered: AI-invented arbitrary structure per category. Rejected because it
removes strict-schema validation (no shape to validate against → garbage can
reach members), breaks reliable calendar/ICS/alerts (no guaranteed date/severity
fields), and erodes the "LLM advises, deterministic code decides" principle the
privacy/trust story rests on — for a multi-week rebuild. The custom-NAME +
fixed-SHAPE design delivers the same user-facing outcome (orgs define their own
categories; AI files into them) while keeping all of that intact.
