# Lead file uploads (Quote form → File uploads)

**Status:** Shipped Oct 2026. Off by default; switched on per site.
**Editor:** Page → Quote form → **File uploads** card (`LPL_LAYOUT_SPECS.quote` in `manage.html`).

Customers can attach plans or photos to a website enquiry. Files are private, kept for
90 days, and opened through links in the lead email and in **Captured leads**.

## Config (`sections.quote`)

| Key | Meaning |
|---|---|
| `uploadsOn` | `true` shows the upload box (anything else = off) |
| `uploadsLabel` | Label, default "Upload plans or photos" |
| `uploadsHelp` | Help line, default "Photos or PDFs — up to N files, 10 MB each. Optional." |
| `uploadsMax` | Files per enquiry, 1–5 (default 3) |

## Flow

1. `assets/lp-lead-files.js` draws the box after the extra fields. Photos are shrunk in the
   browser (longest side 2000px, JPEG 0.82; kept as-is when that isn't smaller or the browser
   can't decode it, e.g. HEIC outside Safari).
2. On **Send**, `submitLead()` (trade template) calls `LPLeadFiles.upload()`:
   `POST /api/lead-files/sign { siteId, files:[{name,type,size}] }` → one-time signed upload
   URLs → each file is `PUT` straight to Supabase Storage (never through Vercel's 4.5 MB body limit).
3. The lead is posted with `files: { uploadId, month, items }`. `api/leads.js` lists the upload
   folder in storage and keeps only files that are really there, stored as `details.files`
   (`[{name,path,size,type}]`) and `details.filesExpireAt`.
4. The lead email gets a **Files** row with links to `GET /api/lead-files/open?t=<token>`
   (HMAC, valid for the 90 days), which redirects to a 5-minute storage link.
   Captured leads → **Open files** calls `POST /api/lead-files/open { leadId }` with the
   editor session (same access rule as site backups) and shows 5-minute links.
5. If the upload fails, the enquiry is still sent, with `details.filesNote` explaining it
   ("File upload" row in the email).

## Storage and limits (Supabase Free: 1 GB for the whole org)

- Bucket `lead-files`, **private**, 10 MB per file, types: JPEG, PNG, WEBP, HEIC/HEIF, PDF
  (`db/lead_files.sql`). No storage policies, so only the service role can read or list it.
- Path: `<siteId>/<yyyymm>/<uploadId>/<n>-<safe-name>`.
- App caps (`lib/lead-files.js` `LIMITS`): 5 files per enquiry, **100 MB per site per month**,
  **500 MB total**. Over a cap the visitor is told to send without files.
- `/api/lead-files/sign` is rate-limited (8 per IP per 10 min) and only works for live sites
  with uploads switched on.
- **Daily clean-up** `/api/cron/lead-files-cleanup` (16:35 UTC ≈ 3:35am Canberra): removes files
  older than 90 days and uploads not attached to any lead after 24 hours (through the Storage API),
  then sets `details.filesExpired = true` on those leads.
- SQL helpers (service role only): `lead_files_usage(site)`, `lead_files_due(keep_days, orphan_hours, limit)`,
  `lead_files_mark_expired(paths)`.

Optional env: `LEAD_FILES_SECRET` (token signing key; falls back to the service role key).
Rotating it invalidates links in emails already sent (Captured leads still works).

## Files

`assets/lp-lead-files.{js,css}`, `trade.template.json` (loads them; `submitLead` hook),
`api/lead-files/sign.js`, `api/lead-files/open.js`, `api/cron/lead-files-cleanup.js`,
`lib/lead-files.js`, `api/leads.js`, `lib/lead-notify-email.js`, `manage.html`,
`vercel.json` (cron), `db/lead_files.sql`. Tests: `tests/lead-files.test.js`.

## Not covered

- Only the trade template's quote form. Broker templates, Online Quote and Bookings forms don't have uploads.
- No virus scanning; only file type and size are checked. Files are only ever downloaded, never shown on the site.
