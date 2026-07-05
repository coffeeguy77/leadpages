# LeadPages Agent Instructions

This file is for Cursor, Claude Code, GitHub Copilot, and any future coding agent.

## Read First

Before working on LeadPages, read in this order:

1. `README.md`
2. `docs/INDEX.md`
3. `CLAUDE.md`
4. `AGENTS.md` (this file)
5. Relevant docs from `docs/INDEX.md` for the task at hand
6. Source code for the files you will change

Minimum topic docs for common work:

- Platform intent: `docs/00-VISION.md`
- Architecture: `docs/01-ARCHITECTURE.md`
- Database / config: `docs/02-DATABASE.md`
- Editor: `docs/10-EDITOR.md`
- Standards: `docs/12-CODING-STANDARDS.md`

Use `docs/INDEX.md` § **Which document to read by task** to pick the right topic docs before step 6.

## Agent Behaviour

- Ask for confirmation before destructive changes.
- Prefer small, reviewable commits.
- Never make broad unrelated cleanup changes.
- Never remove features while refactoring.
- Never assume unused code is safe to delete.
- When uncertain, document the uncertainty instead of guessing.

## Required Output Before Editing

For any non-trivial task, produce:

- Current behaviour
- Relevant files
- Proposed change
- Risk level
- Rollback plan
- Test checklist

## Approved Style

- Pragmatic code over clever code.
- Plain JavaScript is acceptable.
- Static HTML is acceptable.
- Avoid introducing heavy dependencies unless clearly justified.
- Keep Vercel serverless constraints in mind.
- Keep Supabase access patterns clear and secure.
