// lib/ig/igSync.mjs
// Core sync: for one site, read its Project Feed rules, pull Instagram media,
// filter by hashtags, enrich new posts with AI, and write items[] back to the config.
//
// Key behaviours:
//  - Reads rules the owner set in manage.html: includeTags, excludeTags, sortOrder,
//    postsToShow, aiEnrich, source.
//  - Preserves any MANUAL items (those without _ig) untouched.
//  - Only enriches NEW posts (by Instagram id) — existing IG items keep the owner's edits
//    and don't re-spend AI tokens.

import { getSiteConfig, saveSiteConfig, getConnection, updateConnection } from './store.mjs';
import { fetchMedia, mediaImage } from './instagramApi.mjs';
import { enrichCaption } from './enrich.mjs';

function parseTags(s) {
  return String(s || '')
    .split(',')
    .map((t) => t.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);
}

function captionMatches(caption, include, exclude) {
  const c = String(caption || '').toLowerCase();
  if (exclude.length && exclude.some((t) => c.includes(t))) return false;
  if (include.length && !include.some((t) => c.includes(t))) return false;
  return true;
}

function fallbackTitle(caption) {
  const first = String(caption || '')
    .split(/\n|\.|!|\?/)[0]
    .replace(/#[^\s]+/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF]/gu, '')
    .trim();
  const words = first.split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
  return words || 'Recent project';
}

export async function syncSite(slug, opts) {
  opts = opts || {};
  const conn = await getConnection(slug);
  if (!conn || conn.enabled === false) return { slug, skipped: 'no enabled connection' };
  if (!conn.ig_user_id || !conn.access_token) return { slug, skipped: 'missing ig credentials' };

  const config = await getSiteConfig(slug);
  if (!config) return { slug, skipped: 'site not found' };
  config.sections = config.sections || {};
  const pf = (config.sections.projectFeed = config.sections.projectFeed || {});

  if ((pf.source || 'manual') !== 'instagram' && !opts.force) {
    return { slug, skipped: 'projectFeed source is not "instagram"' };
  }

  // 1) Fetch media
  let media;
  try {
    media = await fetchMedia(conn.ig_user_id, conn.access_token, 50);
  } catch (e) {
    await updateConnection(slug, {
      last_error: String(e.message).slice(0, 300),
      last_sync: new Date().toISOString(),
    });
    return { slug, error: e.message, igError: e.igError || null, status: e.status || null };
  }

  // 2) Filter + partition existing
  const include = parseTags(pf.includeTags);
  const exclude = parseTags(pf.excludeTags);
  const existing = Array.isArray(pf.items) ? pf.items : [];
  const manual = existing.filter((it) => it && !it._ig);
  const byId = {};
  existing.filter((it) => it && it._ig && it.igId).forEach((it) => { byId[it.igId] = it; });

  const aiEnrich = pf.aiEnrich !== false; // default ON
  let newCount = 0;

  // 3) Add new posts (preserve edits on ones we already have)
  for (const m of media) {
    if (!captionMatches(m.caption, include, exclude)) continue;
    if (byId[m.id]) continue;
    const img = mediaImage(m);
    if (!img) continue;

    let title = fallbackTitle(m.caption);
    let service = '';
    let location = '';
    if (aiEnrich) {
      const en = await enrichCaption(m.caption);
      if (en) {
        title = en.title || title;
        service = en.service || '';
        location = en.location || '';
      }
    }
    byId[m.id] = {
      _ig: true,
      igId: m.id,
      source: 'instagram',
      title,
      service,
      location,
      caption: String(m.caption || ''),
      image: img,
      permalink: m.permalink || '',
      date: m.timestamp || '',
    };
    newCount++;
  }

  // 4) Sort + cap IG items (the public page slices to postsToShow itself)
  let igItems = Object.values(byId);
  igItems.sort((a, b) =>
    pf.sortOrder === 'oldest'
      ? String(a.date).localeCompare(String(b.date))
      : String(b.date).localeCompare(String(a.date))
  );
  const want = parseInt(pf.postsToShow, 10) || 12;
  const cap = Math.min(Math.max(want, 24), 60);
  igItems = igItems.slice(0, cap);

  // 5) Persist: manual items first, then IG items
  pf.items = manual.concat(igItems);
  await saveSiteConfig(slug, config);
  await updateConnection(slug, {
    last_sync: new Date().toISOString(),
    last_error: null,
    last_count: igItems.length,
  });

  return { slug, fetched: media.length, new: newCount, igTotal: igItems.length, manual: manual.length };
}
