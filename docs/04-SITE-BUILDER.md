# LeadPages Site Builder

The production builder is primarily `manage.html`.

## Purpose

The site builder allows users to create, edit, preview, and publish tenant websites.

## Important Builder Concepts

- Site list
- Create site modal
- Template selection
- Trade/service packs
- Theme settings
- Section editing
- Autosave
- Live preview iframe
- SEO/page editor
- Image uploads
- Domain linking
- Analytics/leads
- Backups
- Marketplace apps

## Site Lifecycle

1. User creates a site.
2. A row is inserted into `sites`.
3. Config is edited in memory.
4. Autosave writes changes to Supabase.
5. Preview renders the draft.
6. Publishing makes it live.

## Editor Rules

- Do not remove settings.
- Reorganising settings is allowed if functionality is preserved.
- Important account controls should live in the main editor layout.
- Do not leave important tools floating in awkward locations.
- Keep UI professional and grouped.
- Make large sections easier to navigate.

## Safe Improvement Path

Recommended improvement order:

1. Document functions and globals.
2. Group editor settings more clearly.
3. Extract reusable CSS.
4. Extract reusable JavaScript helpers.
5. Add tests around save/load/render.
6. Only later consider deeper framework migration.

## AI Task Prompt

Use this prompt inside Cursor when working on the builder:

Read every file associated with `manage.html`. Do not edit anything. Document every major function, menu, option, global variable, API endpoint, and database table used. Then propose a safe refactor plan that preserves all functionality.
