# Mum's Book

Matthews & friends — the family cookbook, digitised.

216 scanned pages · 194 recipes, all typed out · 8 paintings.

Open `index.html`. Everything works from static files; no build step.

## What's here

```
index.html      the whole site, one file
recipes.json    all 216 pages: titles, sections, and the full typed recipes
pages/p001.jpg  her scanned pages, one per book page
thumbs/p001.jpg grid thumbnails
```

## Page numbering

`pages/p007.jpg` is PDF page 7, which is page 1 of her book — the printed
number at the foot of each page runs six behind the file number. Both are in
`recipes.json` as `pdf_page` and `book_page`.

## Letting the family sign in and add recipes

Optional. Without it the book is open to anyone with the link and nothing new
is saved. To turn it on, create a free Supabase project, run the SQL below,
then paste your Project URL and anon public key into the top of `index.html`:

```js
const CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
```

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null, relation text,
  joined_at timestamptz not null default now()
);
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null, sub text, section text, kind text default 'recipe',
  serves text, prep text, cook text, source text default 'family',
  image text, thumb text,
  ingredients jsonb not null default '[]'::jsonb,
  method jsonb not null default '[]'::jsonb,
  note text, serve_with text, tags text[] not null default '{}',
  cooks jsonb not null default '[]'::jsonb,
  book_page int, added_by uuid references public.profiles(id) on delete set null,
  added_by_name text, created_at date not null default current_date
);
create table if not exists public.cooks (
  id bigserial primary key, recipe_key text not null, recipe_title text,
  by_name text, on_date date not null default current_date
);
alter table public.profiles enable row level security;
alter table public.recipes  enable row level security;
alter table public.cooks    enable row level security;
create policy "family reads profiles" on public.profiles for select to authenticated using (true);
create policy "own profile write"     on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "family reads recipes"  on public.recipes  for select to authenticated using (true);
create policy "family adds recipes"   on public.recipes  for insert to authenticated with check (auth.uid() = added_by);
create policy "family updates recipes" on public.recipes for update to authenticated using (true);
create policy "family reads cooks"    on public.cooks    for select to authenticated using (true);
create policy "family logs cooks"     on public.cooks    for insert to authenticated with check (true);
insert into storage.buckets (id, name, public) values ('scans','scans',true) on conflict (id) do nothing;
create policy "anyone views scans"   on storage.objects for select using (bucket_id = 'scans');
create policy "family uploads scans" on storage.objects for insert to authenticated with check (bucket_id = 'scans');
```

## Transcription

Every recipe was read from her handwriting and typed out — OCR is useless on
cursive. A sample of 14 pages spanning the book was independently checked
against the scans: no wrong quantities, no missing or invented steps.

Where a word or number genuinely wasn't certain, it is listed under
"Worth checking against her page" on that recipe, rather than guessed at.
