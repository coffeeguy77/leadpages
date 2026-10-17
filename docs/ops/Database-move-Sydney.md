# Database move: Tokyo → Sydney (Supabase)

- Source: `jhkjaihkrbvkwayhwgqj` (ap-northeast-1, Tokyo). Target: `fgzkuwhulgnewcazirvy` "leadpages" (ap-southeast-2, Sydney).
- Supabase can't change a project's region; the documented route is a new project + CLI backup/restore (`supabase db dump` roles / schema / data, restored with `psql`).
- `.github/workflows/db-copy-sydney.yml` runs it on GitHub (needs secrets `OLD_DB_URL`, `NEW_DB_URL` = Session pooler connection strings). Modes: `full` (first copy), `data` (re-copy at switch-over), `check` (row counts only).
- Switch-over: pause writes, run `data`, update Vercel env (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and the hard-coded project URL/anon key in the HTML pages, deploy, test. Re-enter Auth URL configuration / SMTP in the new dashboard. Keep Tokyo untouched for a week as fallback.
- After the move, delete the two GitHub secrets and this workflow.
