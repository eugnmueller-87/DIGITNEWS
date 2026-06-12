# Contributing

This project runs **quality gates** to keep the codebase clean as it grows. They
run in three places: locally on commit (fast), via `npm run verify` (full), and
in CI on every PR (authoritative, blocks merge).

## Quality gates

### Web (TypeScript / Next.js — repo root)

| Gate    | Command                 | What it enforces                                                                                                                                                 |
| ------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types   | `npm run typecheck`     | `tsc --noEmit`, strict                                                                                                                                           |
| Lint    | `npm run lint`          | ESLint, **type-aware** — no floating promises, no misused promises, import order, `no-console` (warn/error only), unused vars. `any` is a warning, not an error. |
| Format  | `npm run format:check`  | Prettier (run `npm run format` to fix)                                                                                                                           |
| Build   | `npm run build`         | production build must succeed                                                                                                                                    |
| Secrets | `npm run check:secrets` | **fails if any server secret leaks into the client bundle**                                                                                                      |

Run all of them at once: **`npm run verify`**.

### Worker (Python / FastAPI — `worker/`)

| Gate   | Command                 | What it enforces                                                             |
| ------ | ----------------------- | ---------------------------------------------------------------------------- |
| Lint   | `ruff check .`          | pyflakes, bugbear, simplify, security (bandit), async pitfalls, import order |
| Format | `ruff format --check .` | Ruff formatter (run `ruff format .` to fix)                                  |
| Types  | `mypy`                  | typed public functions, no implicit optional                                 |
| Tests  | `pytest`                | unit tests                                                                   |

```bash
cd worker
pip install -e ".[dev]"
ruff check . && ruff format --check . && mypy && pytest
```

## Local pre-commit hook

A husky hook runs on every commit and checks **only the files you staged** (fast,
seconds):

- TS/JS/JSON/CSS/MD → `eslint --fix` + `prettier --write` (via `lint-staged`)
- Staged `worker/**.py` → `ruff check` + `ruff format --check` (skipped if Ruff
  isn't installed locally — CI still enforces it)

The hook installs automatically on `npm install` (the `prepare` script). The full
typecheck/build/tests deliberately run in **CI**, not on every commit, so commits
stay snappy.

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs two jobs in parallel on every PR and on pushes to
`main`: **Web (TypeScript)** and **Worker (Python)**. A red check should block the
merge.

> **To make checks REQUIRED:** in GitHub → Settings → Branches → add a branch
> protection rule for `main` → "Require status checks to pass before merging" →
> select `Web (TypeScript)` and `Worker (Python)`. (One-time, dashboard-only.)

## Branching & migrations

- Work on a branch; open a PR into `main`.
- Database changes are **additive migrations** in `supabase/migrations/` (never
  edit an applied migration). Merging to `main` triggers the Supabase GitHub
  integration to apply them to the production DB — so a migration must be correct
  before merge. Validate non-trivial SQL against a scratch/transaction first.
- Never commit secrets. `.env.local` is gitignored; only `.env.example` is tracked.

## Conventions

- Branding strings live only in `src/config/brand.ts`.
- Authorization is defense-in-depth: middleware gate → route guards
  (`requireSession`/`requireAdmin`/`requireSuperadmin`) → security-definer RPCs →
  RLS. Never weaken one assuming another covers it.
- See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`SECURITY.md`](SECURITY.md).
