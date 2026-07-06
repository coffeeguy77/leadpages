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

## Cursor Cloud specific instructions

Durable, non-obvious notes for running LeadPages in the cloud dev VM. Deps are already installed by the startup update script (`npm install`, which pulls the single dependency `@supabase/supabase-js`). Node 22 is used.

### How the app runs
- There is **no build step and no lint/test tooling** in this repo: `package.json` has no `scripts`, and there is no ESLint/Prettier/Jest/Vitest/tsconfig/next config. The product is static root-level `.html` files + `api/**/*.js` Vercel serverless functions + a tiny Next.js App Router slice under `app/`, all wired together by `vercel.json` rewrites.
- The intended dev runner is **`vercel dev`** (via `npx vercel dev`). It is **not runnable headless here**: it triggers an interactive Vercel device-login flow and blocks. To use it you must supply a Vercel login/token (add `VERCEL_TOKEN` as a secret) and link the project; `vercel dev` then pulls the project env (including `SUPABASE_SERVICE_ROLE_KEY`) automatically.

### Supabase access (important gotcha)
- Frontend HTML embeds a **live hosted Supabase URL + anon key** in `window.__LP` (project `jhkjaihkrbvkwayhwgqj.supabase.co`), so browser dashboards (e.g. `manage.html`) talk to hosted Supabase directly and only need a login to proceed.
- Serverless functions read `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from env. Without the **service-role key**, RLS-protected tables (`sites`, `leads`, `partners`, …) return **zero rows**, so the core renderer (`/api/render`, `/s/:slug`) yields 404 and lead capture can't store. Supply `SUPABASE_SERVICE_ROLE_KEY` (and the other service keys) to exercise those flows.
- A subset of tables is anon-readable and powers **public** endpoints that work with only the anon key: `partner_directory` (`/api/partner-directory`), `catalog_*` (`/api/catalog`), `billing_plans`. These are the easiest end-to-end checks when no service-role key is present.

### Running without Vercel auth (fallback used for smoke-testing)
- Because `vercel dev` needs auth, you can emulate Vercel locally with a small Node harness that serves the static files, applies `vercel.json` rewrites, and executes `api/**/*.js` handlers with a Vercel-style `req.query` / `res.status().json()` shim. Point it at Supabase via env (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`). With just the public anon key you can confirm `/find-a-partner`, `/marketplace`, and `/manage` render real data. This harness is a throwaway dev aid, not part of the repo.
