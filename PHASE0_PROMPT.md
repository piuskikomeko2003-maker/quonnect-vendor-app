# Prompt to send to your AI agent (Phase 0 only)

Paste everything below the line.

---

You're working on my existing app, a Next.js + Supabase business finance app for small vendors in Uganda (UGX).

Read these first, in order:
1. `SPEC.md`: what we're building and the design decisions already made.
2. `docs/finance-logic.md` (the finance/stock/profit doc). If it disagrees with the code, the code wins.
3. `FUTURE.md`: Stage 2/3 ideas. DO NOT build any of it. Only avoid blocking it.

## Your task: PHASE 0, AUDIT ONLY

Inspect the repo, the Supabase migrations, RLS policies, server actions, data loaders, screens and existing tests (`scripts/acceptance-tests.ts`, `scripts/unit-tests.ts`).

Run the existing tests and report the real output.

Then write `AUDIT.md` containing:
1. **What works** and should be kept.
2. **What's financially wrong**, ranked by severity. Cite file + function for each.
3. **Security / data-integrity risks** (RLS gaps, direct writes that bypass RPCs, missing idempotency).
4. **Gaps vs SPEC.md**: what's missing for Stage 1.
5. **Proposed migrations**: list each one with its purpose and whether it's destructive. Include how existing production data gets backfilled (see SPEC.md section 8).
6. **Recommended order** of implementation, split into small milestones (1a, 1b, 1c...).
7. **Open questions** for me.

## Hard rules
- **No code changes, no migrations, no schema changes.** The only file you create is `AUDIT.md`.
- When done, **STOP**. Do not start Phase 1. I'll review and approve first.
- If something is ambiguous, especially anything touching money, ask me. Don't guess.
- Don't claim anything works unless you ran it. Show test output.
