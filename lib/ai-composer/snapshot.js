'use strict';

/**
 * Full-page screenshots for AI Composer, taken with headless Chromium
 * (@sparticuz/chromium + puppeteer-core, sized for Vercel functions).
 *
 *  - kind "site":     a LeadPages page (our own hosts only) — used by the visual check
 *  - kind "external": a public website — used by "copy from a URL"
 *
 * External pages are guarded against server-side request forgery: http(s) only,
 * default ports only, and every request the page makes (including redirects,
 * images and scripts) must resolve to a public IP address.
 *
 * The screenshot is uploaded to Cloudinary under leadpages/ai-composer/snap/ so the
 * existing design pipeline (tiles, crops) can read it like an uploaded design.
 */

const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');

const WIDTH = 1440;
const MAX_HEIGHT = 14000;
const NAV_TIMEOUT_MS = 25000;
const OWN_HOSTS = ['leadpages.com.au', 'www.leadpages.com.au', 'app.leadpages.com.au'];

/** True for loopback, private, link-local, CGNAT, multicast and reserved ranges. */
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 192 && p[1] === 0 && p[2] === 0) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19)) ||
      p[0] >= 224;
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    if (s === '::1' || s === '::') return true;
    const v4 = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) return isPrivateIp(v4[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

const hostCache = new Map();
/** Resolves a hostname and checks every address is public. */
async function hostIsPublic(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false;
  if (net.isIP(h)) return !isPrivateIp(h);
  if (hostCache.has(h)) return hostCache.get(h);
  let ok = false;
  try {
    const addrs = await dns.lookup(h, { all: true, verbatim: true });
    ok = addrs.length > 0 && addrs.every(function (a) { return !isPrivateIp(a.address); });
  } catch (_e) { ok = false; }
  hostCache.set(h, ok);
  return ok;
}

/**
 * Checks a URL the user typed for "copy from a URL".
 * @returns {Promise<URL>}
 */
async function checkExternalUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (_e) { throw new Error('That is not a valid web address.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only http:// and https:// addresses can be copied.');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Only standard web ports can be copied.');
  if (u.username || u.password) throw new Error('Addresses with a username or password cannot be copied.');
  if (!(await hostIsPublic(u.hostname))) throw new Error('That address is not a public website.');
  return u;
}

/** A LeadPages page URL (our own hosts only). */
function checkSiteUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (_e) { throw new Error('Bad site address'); }
  if (u.protocol !== 'https:' || OWN_HOSTS.indexOf(u.hostname) < 0) throw new Error('Only LeadPages pages can be checked.');
  return u;
}

async function launch() {
  // @sparticuz/chromium and puppeteer-core are ES-module only: load them with import()
  // (older Node runtimes cannot require() an ES module).
  const cm = await import('@sparticuz/chromium');
  const chromium = cm.default || cm;
  const pm = await import('puppeteer-core');
  const puppeteer = pm.default || pm;
  // LP_SNAPSHOT_EXTRA_ARGS: extra Chromium flags for local testing only (e.g. a proxy).
  const extra = String(process.env.LP_SNAPSHOT_EXTRA_ARGS || '').split(/\s+/).filter(Boolean);
  return puppeteer.launch({
    args: chromium.args.concat(extra),
    defaultViewport: { width: WIDTH, height: 900, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: true
  });
}

/**
 * Loads a page and takes a full-page JPEG.
 * @param {string} url already checked
 * @param {{ external?: boolean, waitMs?: number }} [opts]
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, title: string, finalUrl: string }>}
 */
async function capture(url, opts) {
  opts = opts || {};
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36 LeadPagesComposer');
    if (opts.external) {
      await page.setRequestInterception(true);
      page.on('request', function (req) {
        let u;
        try { u = new URL(req.url()); } catch (_e) { req.abort().catch(function () {}); return; }
        if (u.protocol === 'data:' || u.protocol === 'blob:') { req.continue().catch(function () {}); return; }
        if ((u.protocol !== 'https:' && u.protocol !== 'http:') || (u.port && u.port !== '80' && u.port !== '443')) {
          req.abort().catch(function () {}); return;
        }
        hostIsPublic(u.hostname).then(function (ok) {
          if (ok) req.continue().catch(function () {});
          else req.abort().catch(function () {});
        });
      });
    }
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });
    // Scroll through once so lazy images and scroll reveals load, then back to the top.
    await page.evaluate(async function (maxH) {
      const step = 700;
      for (let y = 0; y < Math.min(document.documentElement.scrollHeight, maxH); y += step) {
        window.scrollTo(0, y);
        await new Promise(function (r) { setTimeout(r, 120); });
      }
      window.scrollTo(0, 0);
      // Reveal-on-scroll content often starts at opacity 0.
      document.querySelectorAll('[class*="reveal"],[class*="fade"],[data-aos]').forEach(function (el) {
        el.style.opacity = '1'; el.style.transform = 'none';
      });
    }, MAX_HEIGHT);
    await new Promise(function (r) { setTimeout(r, opts.waitMs || 800); });
    const height = await page.evaluate(function (maxH) {
      return Math.min(maxH, Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0));
    }, MAX_HEIGHT);
    const title = await page.title();
    const finalUrl = page.url();
    // External pages ("copy from a URL"): the visible text with its position, the
    // site's own internal links (other pages) and the meta description, so the copy
    // is word for word and other pages can be listed.
    let page_ = null;
    if (opts.extract) {
      page_ = await page.evaluate(function (maxH) {
        const out = { blocks: [], links: [], description: '' };
        const md = document.querySelector('meta[name="description"]');
        out.description = md ? String(md.getAttribute('content') || '').slice(0, 300) : '';
        const seen = new Set();
        const els = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dt,dd,td,th,label,button,a,span,small,strong');
        for (let i = 0; i < els.length && out.blocks.length < 600; i++) {
          const el = els[i];
          if (el.closest('script,style,noscript,svg')) continue;
          // Skip containers whose text is mostly made of child blocks already listed.
          const inBlock = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,button,td,th,dd,dt,figcaption,label';
          if (el.tagName === 'A' && ((el.parentElement && el.parentElement.closest(inBlock)) || el.querySelector(inBlock))) continue;
          if (/^(SPAN|STRONG|SMALL)$/.test(el.tagName) && el.closest(inBlock + ',a')) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
          const t = String(el.innerText || '').replace(/\s+/g, ' ').trim();
          if (!t || t.length < 2) continue;
          const y = Math.round(r.top + window.scrollY);
          if (y > maxH) continue;
          const key = t + '|' + Math.round(y / 10);
          if (seen.has(key)) continue;
          seen.add(key);
          out.blocks.push({ tag: el.tagName.toLowerCase(), x: Math.round(r.left), y: y, w: Math.round(r.width), h: Math.round(r.height), text: t.slice(0, 600) });
        }
        const here = location.host.replace(/^www\./, '');
        const linkSeen = new Set();
        document.querySelectorAll('a[href]').forEach(function (a) {
          try {
            const u = new URL(a.getAttribute('href'), location.href);
            if (u.host.replace(/^www\./, '') !== here || !/^https?:$/.test(u.protocol)) return;
            if (/\.(pdf|jpe?g|png|gif|webp|zip|docx?)$/i.test(u.pathname)) return;
            const path = u.pathname.replace(/\/+$/, '') || '/';
            if (path === '/' || linkSeen.has(path)) return;
            linkSeen.add(path);
            out.links.push({ path: path, label: String(a.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60) });
          } catch (_e) {}
        });
        out.links = out.links.slice(0, 40);
        return out;
      }, MAX_HEIGHT);
    }
    // LeadPages pages: where each app section sits (for comparing section by section),
    // with preview-only tags hidden so the screenshot matches the public page.
    let sections = [];
    if (opts.sections) {
      await page.addStyleTag({ content: '.lp-seclabel{display:none!important}' }).catch(function () {});
      sections = await page.evaluate(function () {
        return Array.prototype.slice.call(document.querySelectorAll('[data-sec]'))
          .filter(function (n) { return n.offsetHeight > 20 && getComputedStyle(n).display !== 'none' && !n.parentElement.closest('[data-sec]'); })
          .map(function (n) { const r = n.getBoundingClientRect(); return { sec: n.getAttribute('data-sec'), y: Math.round(r.top + window.scrollY), h: Math.round(r.height) }; });
      });
    }
    // Make the window as tall as the page: screenshots "beyond the viewport" repeat the
    // top of the page past a few thousand pixels, and lazy images below stay unloaded.
    await page.setViewport({ width: WIDTH, height: Math.max(200, height), deviceScaleFactor: 1 });
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await new Promise(function (r) { setTimeout(r, 900); });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: WIDTH, height: Math.max(200, height) } });
    return { buffer: buffer, width: WIDTH, height: Math.max(200, height), title: title, finalUrl: finalUrl, sections: sections, page: page_ };
  } finally {
    await browser.close().catch(function () {});
  }
}

function cloudConfig() {
  const url = String(process.env.CLOUDINARY_URL || '');
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dzx6x1hou';
  let apiKey = process.env.CLOUDINARY_API_KEY || '';
  let apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (m) { apiKey = apiKey || m[1]; apiSecret = apiSecret || m[2]; cloudName = cloudName || m[3]; }
  return { cloudName: cloudName, apiKey: apiKey, apiSecret: apiSecret };
}

/**
 * Signed upload of a screenshot to Cloudinary (leadpages/ai-composer/snap/).
 * @returns {Promise<{ url: string, width: number, height: number }>}
 */
async function uploadSnapshot(buffer, label, fetchImpl) {
  const cfg = cloudConfig();
  if (!cfg.apiKey || !cfg.apiSecret) throw new Error('Cloudinary is not configured on the server (CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).');
  const ts = Math.floor(Date.now() / 1000);
  const month = new Date().toISOString().slice(0, 7).replace('-', '');
  const publicId = 'leadpages/ai-composer/snap/' + month + '/' + String(label || 'page').replace(/[^a-z0-9-]+/gi, '-').slice(0, 40) + '-' + crypto.randomBytes(5).toString('hex');
  const params = { overwrite: 'false', public_id: publicId, timestamp: ts };
  const toSign = Object.keys(params).sort().map(function (k) { return k + '=' + params[k]; }).join('&');
  const signature = crypto.createHash('sha1').update(toSign + cfg.apiSecret).digest('hex');
  const fd = new URLSearchParams();
  fd.append('file', 'data:image/jpeg;base64,' + buffer.toString('base64'));
  fd.append('api_key', cfg.apiKey);
  fd.append('timestamp', String(ts));
  fd.append('public_id', publicId);
  fd.append('overwrite', 'false');
  fd.append('signature', signature);
  const r = await (fetchImpl || fetch)('https://api.cloudinary.com/v1_1/' + cfg.cloudName + '/image/upload', { method: 'POST', body: fd });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok || !j.secure_url) throw new Error('Screenshot upload failed: ' + ((j.error && j.error.message) || r.status));
  return { url: j.secure_url, width: j.width, height: j.height };
}

module.exports = {
  WIDTH,
  MAX_HEIGHT,
  isPrivateIp,
  hostIsPublic,
  checkExternalUrl,
  checkSiteUrl,
  capture,
  uploadSnapshot
};
