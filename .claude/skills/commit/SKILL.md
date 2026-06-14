---
name: commit
description: Commit (and push) the current changes for this repo. Invoke after completing any major change — a feature, a fix, a migration, a worker change, a docs update — so work is never left uncommitted. Handles the project's verify gate, commit-message conventions, branch safety, and the PowerShell-on-Windows commit quirks.
---

# Commit skill

The standing rule for this project: **after any major change, commit it.** Don't
leave finished work sitting uncommitted across turns. A "major change" = a
feature, a bug fix, a migration, a worker change, a docs update that accompanies
code — anything you'd describe to the user as "done". Trivial scratch edits or
half-finished work-in-progress do not need a commit yet.

## When to run

- You just finished a coherent unit of work and told (or are about to tell) the
  user it's done.
- The user says "commit", "commit and push", "nicht vergessen zu committen",
  "good work push and commit", or similar.
- You're about to switch to an unrelated task and the current one is complete.

If you're only partway through and the build is broken, finish first — don't
commit a knowingly-broken tree unless the user asks for a checkpoint.

## Procedure

1. **See what changed.** `git status --short` + `git diff --stat`. Make sure you
   understand every modified/new file and that nothing unintended (secrets,
   scratch scripts, temp files) is staged. Remove one-off scripts you created
   for verification before committing.

2. **Run the gate.** This repo's pre-push gate is `npm run verify` (typecheck +
   lint + format:check + tests + build + both secret scans). Run it and make it
   green before committing a web change. For worker-only changes the gate is
   `cd worker && ruff check . && ruff format --check . && mypy && pytest -q`.
   The pre-commit hook also runs `check:source-secrets` + lint-staged, so a
   commit can still be rejected — fix the cause, never bypass with `--no-verify`.

3. **Branch safety.** Check the current branch (`git branch --show-current`).
   - If the change is substantial and you're on `main`, consider a topic branch
     first — but note this project's normal flow has historically committed
     feature work and fast-forwarded into `main`, which both Vercel and the VPS
     worker deploy from. If unsure whether to land on `main` directly, ask.
   - **Before merging a topic branch into `main`, sync `main` first**
     (`git checkout main && git pull --ff-only`) — local `main` has been found
     21 commits behind origin before, which silently breaks a `--ff-only` merge.

4. **Write the commit.** Conventional-commit subject (`feat:`, `fix(worker):`,
   `fix(db):`, `docs:`, …), a body explaining the _why_ and the notable choices,
   and **always** end with the required trailer:

   ```
   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```

5. **Commit — PowerShell-safe.** PowerShell (the primary shell here) has **no
   heredoc**, and German quotes/umlauts in `-m` break the parser. So for any
   multi-line message: Write the message to `.git/COMMIT_MSG_TMP.txt`, then
   `git commit -F .git/COMMIT_MSG_TMP.txt`, then delete the temp file. The Bash
   tool's `cd` does not affect PowerShell's CWD and vice-versa — if a prior Bash
   `cd` left you in a subdir, prefix PowerShell git calls with
   `Set-Location f:\DIGITnews;`.

6. **Push when asked (or when it should go live).** `git push` (or
   `git push -u origin <branch>` for a new branch). Pushing `main` triggers the
   Vercel deploy; a **worker** change additionally needs a VPS redeploy (pull +
   `docker build` + recreate the container) — that is NOT automatic, so call it
   out or do it.

7. **Confirm.** Report the commit hash + branch, whether it was pushed, and any
   follow-up the user still has to do (apply a migration in the SQL editor,
   redeploy the worker, set a Vercel env var).

## Don't

- Don't `--no-verify` / skip hooks or signing unless the user explicitly says so.
- Don't commit secrets — the scans will block it; if they do, find the real leak.
- Don't amend or force-push shared history without being asked.
- Don't bundle unrelated changes into one commit; split them.
