'use strict';

/**
 * AI Composer "design blocks": new layouts for existing apps, created by AI Composer
 * (full mode only) when no existing layout matches a design section.
 *
 * A block is DATA, not code: an HTML template with placeholders for the app's own
 * content fields plus CSS, rendered on the page by /assets/lp-blocks.js. Because it
 * reads the same fields as the app, the content stays editable in the normal editor.
 *
 * Everything here is strict on purpose — templates come from AI output:
 *   - allowed tags and attributes only (no scripts, iframes, forms, inline styles,
 *     event handlers); src/href only from a placeholder (or "#…" for href)
 *   - placeholders must be the app's own field / list names
 *   - CSS: no @import / url() / expressions / escapes; every selector is scoped
 *     under the block's class; only @media at-rules
 *
 * Template syntax (rendered by assets/lp-blocks.js):
 *   {{field}}                text of a field (escaped)
 *   {{#list}} … {{/list}}    repeat for each list item; inside, {{field}} is the item's
 *   {{?field}} … {{/field}}  only when the field (or list) is not empty
 *   {{icon:field}}           the field's value as a LeadPages stroke icon
 *   {{@n}} / {{@nn}}         item number (1, 2 … / 01, 02 …) inside a list
 *   {{brand.name}} {{brand.phone}}   business name / phone
 */

const MAX_TEMPLATE = 20000;
const MAX_CSS = 20000;
const TAGS = ['div', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span',
  'strong', 'em', 'b', 'i', 'small', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'blockquote', 'br', 'hr', 'dl', 'dt', 'dd'];
const VOID = ['img', 'br', 'hr'];
const ATTRS = ['class', 'href', 'src', 'alt', 'role', 'loading', 'aria-label', 'aria-hidden'];
const PLACEHOLDER_RE = /\{\{\s*([#?/]?)\s*([a-zA-Z@][a-zA-Z0-9_.:@]*)\s*\}\}/g;

/** Field and list names a block for this app may use (from its catalogue sheet). */
function fieldNames(sheet) {
  const scalars = {};
  const lists = {};
  (sheet && sheet.fields || []).forEach(function (f) {
    const name = String(f.path).split('.').pop();
    scalars[name] = { path: f.path, kind: f.kind };
  });
  (sheet && sheet.lists || []).forEach(function (l) {
    const name = String(l.path).split('.').pop();
    lists[name] = { path: l.path, fields: (l.itemFields || []).map(function (x) { return x.name; }) };
  });
  return { scalars: scalars, lists: lists };
}

/**
 * Check a template against the rules. Returns problems (empty = ok).
 * @param {string} tpl @param {{ scalars: object, lists: object }} names
 */
function validateTemplate(tpl, names) {
  const problems = [];
  const t = String(tpl == null ? '' : tpl);
  if (!t.trim()) return ['template is empty'];
  if (t.length > MAX_TEMPLATE) problems.push('template is too long');
  if (/<!--|<!\[|<\?/.test(t)) problems.push('comments / CDATA are not allowed');
  if (/javascript:|vbscript:|data:/i.test(t)) problems.push('script URLs are not allowed');
  // Tags and attributes.
  const tagRe = /<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*)>/g;
  let m;
  const stack = [];
  while ((m = tagRe.exec(t))) {
    const closing = !!m[1];
    const tag = m[2].toLowerCase();
    if (TAGS.indexOf(tag) < 0) { problems.push('tag <' + tag + '> is not allowed'); continue; }
    if (closing) {
      const top = stack.pop();
      if (top !== tag) problems.push('</' + tag + '> does not match <' + (top || 'nothing') + '>');
      continue;
    }
    const rest = m[3].replace(/\/\s*$/, '');
    const attrRe = /([a-zA-Z-:]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    const stripped = rest.replace(attrRe, '').trim();
    if (stripped) problems.push('<' + tag + '> has an attribute that is not quoted or not allowed: ' + stripped.slice(0, 40));
    let a;
    while ((a = attrRe.exec(rest))) {
      const an = a[1].toLowerCase();
      const av = a[3] != null ? a[3] : a[4];
      if (ATTRS.indexOf(an) < 0) { problems.push('attribute ' + an + ' is not allowed'); continue; }
      if (an === 'src' && !/^\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}$/.test(av)) problems.push('src must be a single placeholder like {{image}}');
      if (an === 'src' && tag !== 'img') problems.push('src is only allowed on <img>');
      if (an === 'href' && !/^\{\{\s*[a-zA-Z][a-zA-Z0-9_]*\s*\}\}$/.test(av) && !/^#[a-zA-Z0-9_-]*$/.test(av)) problems.push('href must be a placeholder like {{ctaHref}} or a "#section" link');
      if (/[<>]/.test(av)) problems.push('attribute values may not contain < or >');
    }
    if (VOID.indexOf(tag) < 0) stack.push(tag);
  }
  if (stack.length) problems.push('unclosed tags: ' + stack.join(', '));
  // Placeholders must use this app's fields.
  const open = [];
  let p;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((p = PLACEHOLDER_RE.exec(t))) {
    const kind = p[1];
    let name = p[2];
    if (name === '@n' || name === '@nn' || name === 'brand.name' || name === 'brand.phone') continue;
    if (name.indexOf('icon:') === 0) name = name.slice(5);
    const inList = open.length ? names.lists[open[open.length - 1]] : null;
    if (kind === '#') {
      if (!names.lists[name]) problems.push('{{#' + name + '}} is not a list of this app');
      open.push(name);
    } else if (kind === '/') {
      if (open.length && open[open.length - 1] === name) open.pop();
    } else {
      const ok = (inList && inList.fields.indexOf(name) >= 0) || names.scalars[name] || (kind === '?' && names.lists[name]);
      if (!ok) problems.push('{{' + p[2] + '}} is not a field of this app' + (inList ? ' list item' : ''));
    }
  }
  // Raw braces left over (malformed placeholders).
  if (/\{\{|\}\}/.test(t.replace(PLACEHOLDER_RE, ''))) problems.push('malformed placeholder');
  return problems.filter(function (x, i, arr) { return arr.indexOf(x) === i; }).slice(0, 12);
}

/**
 * Scope and check CSS: every selector is prefixed with ".lpb-<id>", only @media
 * at-rules are kept, dangerous constructs refused.
 * @returns {{ css: string, problems: string[] }}
 */
function scopeCss(css, id) {
  const problems = [];
  let s = String(css == null ? '' : css);
  if (s.length > MAX_CSS) problems.push('CSS is too long');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@import|url\s*\(|expression\s*\(|behavio[u]?r\s*:|javascript:|-moz-binding|<\/|\\/i.test(s)) {
    problems.push('CSS may not use @import, url(), expressions or escapes');
    return { css: '', problems: problems };
  }
  const scope = '.lpb-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  function scopeSelectors(sel) {
    return sel.split(',').map(function (x) {
      x = x.trim();
      if (!x) return '';
      if (/^(html|body|:root)\b/i.test(x)) x = x.replace(/^(html|body|:root)\b\s*/i, '');
      return x ? scope + ' ' + x : scope;
    }).filter(Boolean).join(',');
  }
  let out = '';
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('{', i);
    if (open < 0) break;
    const head = s.slice(i, open).trim();
    if (/^@media\b/i.test(head)) {
      // Find the matching close of the @media block.
      let depth = 1, j = open + 1;
      while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      const inner = scopeCss(s.slice(open + 1, j - 1), id);
      inner.problems.forEach(function (x) { problems.push(x); });
      out += head + '{' + inner.css + '}';
      i = j;
      continue;
    }
    const close = s.indexOf('}', open);
    if (close < 0) { problems.push('unbalanced CSS braces'); break; }
    const body = s.slice(open + 1, close).trim();
    if (head.charAt(0) === '@') { problems.push('only @media is allowed (dropped ' + head.split(/\s/)[0] + ')'); i = close + 1; continue; }
    if (head && body && !/[{}]/.test(body)) out += scopeSelectors(head) + '{' + body + '}';
    i = close + 1;
  }
  return { css: out, problems: problems };
}

/**
 * Validate a generated block and return the stored definition.
 * @param {{ name?: string, looks?: string, template: string, css: string }} raw
 * @param {string} appKey @param {object} sheet catalogue field sheet @param {string} id
 */
function prepareBlock(raw, appKey, sheet, id) {
  const names = fieldNames(sheet);
  const problems = validateTemplate(raw && raw.template, names);
  const scoped = scopeCss(raw && raw.css, id);
  // Dropped at-rules are only a warning; the rest are errors.
  const errors = problems.concat(scoped.problems.filter(function (x) { return !/^only @media/.test(x); }));
  return {
    ok: errors.length === 0,
    errors: errors,
    block: {
      id: id,
      app: appKey,
      name: String((raw && raw.name) || 'New layout').trim().slice(0, 60),
      looks: String((raw && raw.looks) || '').trim().slice(0, 300),
      template: String((raw && raw.template) || ''),
      css: scoped.css,
      fields: names
    }
  };
}

module.exports = {
  MAX_TEMPLATE,
  MAX_CSS,
  TAGS,
  ATTRS,
  fieldNames,
  validateTemplate,
  scopeCss,
  prepareBlock
};
