'use strict';

/**
 * "Built on LeadPages" gallery for partner pages (Nov 2026).
 *
 * Each site is a browser-window card showing the real site live (a scaled, non-interactive
 * preview that loads when scrolled into view), with its logo, name and trade underneath and a
 * link to the live site. A site with a showcase picture set (config.showcase.image) shows that
 * picture instead of the live preview.
 *
 * Layout: up to 3 featured cards (the first one large), then up to 6 more behind "See more".
 * Colours come from the page's tokens, so Try colours and every design restyle it.
 */

const { esc } = require('./shared');
const { DEFAULT_COPY, MAX } = require('../partner-website/showcase-library');

const ARROW = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';

function initial(name) {
  return esc(String(name || '?').trim().charAt(0).toUpperCase() || '?');
}

function hexOk(v) {
  return /^#[0-9a-f]{3,8}$/i.test(String(v || ''));
}

function card(d, i, lead, copy) {
  const vars = [];
  if (hexOk(d.color)) vars.push('--lpsl-c:' + d.color);
  if (hexOk(d.dark)) vars.push('--lpsl-d:' + d.dark);
  const logoMark = d.logo
    ? '<img src="' + esc(d.logo) + '" alt="" loading="lazy">'
    : '<b>' + initial(d.name) + '</b>';
  const posterImg = d.poster || d.image || '';
  const poster = '<span class="lpsl-poster' + (posterImg ? ' has-img' : '') + '"' + (posterImg ? ' style="background-image:url(\'' + esc(posterImg).replace(/'/g, '%27') + '\')"' : '') + '>'
    + '<span class="lpsl-poster-mark"' + (hexOk(d.logoBg) ? ' style="background:' + d.logoBg + '"' : '') + '>' + logoMark + '</span></span>';
  // Auto-scroll always uses the live page (its picture is the backdrop while it loads);
  // otherwise a feature picture wins over the live preview.
  const live = d.autoScroll || !d.image;
  const view = live
    ? '<iframe class="lpsl-frame" data-lpsl-src="' + esc(d.frameUrl + (d.autoScroll ? '&lp_scroll=1' : '')) + '" title="' + esc(d.name) + ' preview" tabindex="-1" aria-hidden="true" scrolling="no"></iframe>'
    : '<img class="lpsl-shot" src="' + esc(d.image) + '" alt="" loading="lazy">';
  return '<article class="lpsl-card' + (lead ? ' lpsl-card--lead' : '') + (d.autoScroll ? ' lpsl-card--scroll' : '') + '"' + (vars.length ? ' style="' + vars.join(';') + '"' : '') + ' data-lpsl-card>'
    + '<div class="lpsl-chrome" aria-hidden="true"><i></i><i></i><i></i><span class="lpsl-url">' + esc(d.host) + '</span></div>'
    + '<div class="lpsl-view">' + poster + view + '</div>'
    + '<div class="lpsl-meta">'
    + '<span class="lpsl-logo"' + (hexOk(d.logoBg) ? ' style="background:' + d.logoBg + '"' : '') + '>' + logoMark + '</span>'
    + '<span class="lpsl-txt"><strong>' + esc(d.name) + '</strong>' + (d.industry ? '<small>' + esc(d.industry) + '</small>' : '') + '</span>'
    + '<span class="lpsl-go">' + esc(copy.view) + ' ' + ARROW + '</span>'
    + '</div>'
    + '<a class="lpsl-hit" href="' + esc(d.url) + '" target="_blank" rel="noopener" aria-label="' + esc(copy.view + ': ' + d.name) + '"></a>'
    + '</article>';
}

/**
 * c.library = { cards: [...], title, sub } (set by the renderer). variant: 'studio' | 'culture'.
 * opts.id: section id (default "built-on-leadpages"); opts.cls: extra classes.
 */
function librarySection(c, variant, opts) {
  opts = opts || {};
  const lib = (c && c.library) || null;
  const cards = (lib && lib.cards ? lib.cards : []).slice(0, MAX);
  if (!cards.length) return '';
  const copy = Object.assign({}, DEFAULT_COPY, {
    title: (lib.title || '').trim() || DEFAULT_COPY.title,
    sub: (lib.sub || '').trim() || DEFAULT_COPY.sub,
    view: (lib.view || '').trim() || DEFAULT_COPY.view
  });
  const featured = cards.slice(0, 3);
  const rest = cards.slice(3);
  const n = featured.length;
  const id = opts.id || 'built-on-leadpages';
  return '<link rel="stylesheet" href="/assets/partner-templates/showcase-library.css?v=2">'
    + '<section class="lpsl lpsl--' + esc(variant || 'studio') + (opts.cls ? ' ' + esc(opts.cls) : '') + '" id="' + esc(id) + '" data-lpsl>'
    + '<div class="lpsl-in">'
    + '<header class="lpsl-head">'
    + '<p class="lpsl-kicker"><span class="lpsl-pulse" aria-hidden="true"></span>' + esc(copy.kicker) + '</p>'
    + '<h2 class="lpsl-title">' + esc(copy.title) + '</h2>'
    + '<p class="lpsl-sub">' + esc(copy.sub) + '</p>'
    + '</header>'
    + '<div class="lpsl-feature lpsl-n' + n + '">' + featured.map(function(d, i) { return card(d, i, i === 0 && n === 3, copy); }).join('') + '</div>'
    + (rest.length
      ? '<div class="lpsl-grid" id="' + esc(id) + '-more" hidden>' + rest.map(function(d, i) { return card(d, i + 3, false, copy); }).join('') + '</div>'
        + '<div class="lpsl-foot"><button type="button" class="lpsl-more" data-lpsl-more aria-expanded="false" aria-controls="' + esc(id) + '-more"'
        + ' data-more="' + esc(copy.more + ' (' + rest.length + ')') + '" data-less="' + esc(copy.less) + '">' + esc(copy.more + ' (' + rest.length + ')') + '</button></div>'
      : '')
    + '</div></section>'
    + '<script src="/assets/partner-templates/showcase-library.js?v=2" defer></script>';
}

module.exports = { librarySection };
