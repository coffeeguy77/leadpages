# Mum's Book

Matthews & friends — 216 scanned pages, 194 recipes typed out, 8 paintings.

Static files, no build step. Open `index.html`.

```
index.html      the whole site
recipes.json    all 216 pages: titles, her categories, page numbers, typed recipes
pages/p001.jpg  her scanned pages, cropped to the card
thumbs/         grid thumbnails
```

## Her data

Each recipe carries her own section (Primi, Contorni, Secondi, Dolce, Bits and
bobs), her sub-category (Pasta, Chicken, Cake…) and the page number printed in
the book. `pages/p007.jpg` is PDF page 7, which is page 1 of her book — the
printed number runs six behind the file number. Both are in `recipes.json`.

Temperature and time are separate fields (`temp_c`, `time_value`, `time_unit`),
pulled from her own method text. They stay hidden wherever she didn't say.

## Notes and attribution

`note` holds only her own words — tips, "opt:" lines, remarks she wrote on the
page. Observations made while transcribing (title spellings, index
discrepancies) were stripped out, and contributor credits moved to `credit`.
A note is labelled "Mum's note" only when it came from her page; anything a
family member writes is an "Author's note".

Where a word or number genuinely wasn't legible, it is listed under
"Worth checking against her page" rather than guessed at.

## Letting the family sign in and add recipes

Optional. Without it the book is open to anyone with the link and nothing new is
saved. Create a free Supabase project, run the SQL below, then paste your
Project URL and anon public key into the top of `index.html`.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null, relation text, joined_at timestamptz not null default now());
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null, sub text, section text, kind text default 'recipe',
  serves text, temp_c int, time_value text, time_unit text,
  source text default 'family', image text, thumb text,
  ingredients jsonb not null default '[]'::jsonb,
  method jsonb not null default '[]'::jsonb,
  note text, serve_with text, credit text, tags text[] not null default '{}',
  cooks jsonb not null default '[]'::jsonb, "check" jsonb default '[]'::jsonb,
  book_page int, added_by uuid references public.profiles(id) on delete set null,
  added_by_name text, created_at date not null default current_date);
create table if not exists public.photos (
  id bigserial primary key, recipe_key text not null, recipe_title text,
  url text not null, by_name text, created_at timestamptz not null default now());
create table if not exists public.cooks (
  id bigserial primary key, recipe_key text not null, recipe_title text,
  by_name text, on_date date not null default current_date);

alter table public.profiles enable row level security;
alter table public.recipes  enable row level security;
alter table public.photos   enable row level security;
alter table public.cooks    enable row level security;
create policy "family reads profiles"  on public.profiles for select to authenticated using (true);
create policy "own profile write"      on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "family reads recipes"   on public.recipes  for select to authenticated using (true);
create policy "family adds recipes"    on public.recipes  for insert to authenticated with check (auth.uid() = added_by);
create policy "family updates recipes" on public.recipes  for update to authenticated using (true);
create policy "family reads photos"    on public.photos   for select to authenticated using (true);
create policy "family adds photos"     on public.photos   for insert to authenticated with check (true);
create policy "family reads cooks"     on public.cooks    for select to authenticated using (true);
create policy "family logs cooks"      on public.cooks    for insert to authenticated with check (true);

insert into storage.buckets (id, name, public) values ('photos','photos',true) on conflict (id) do nothing;
create policy "anyone views photos"   on storage.objects for select using (bucket_id = 'photos');
create policy "family uploads photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos');
```
