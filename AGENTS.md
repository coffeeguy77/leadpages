# LeadPages Agent Instructions

This file is for Cursor, Claude Code, GitHub Copilot, and any future coding agent.

## Read First

Before working on LeadPages, read:

1. `CLAUDE.md`
2. `docs/00-VISION.md`
3. `docs/01-ARCHITECTURE.md`
4. The files directly related to the requested task

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
