/**
 * Cause House — editorial section renderers with strict presentation rules.
 */
const { esc } = require('./shared');
const {
  DEFAULT_SECTION_COPY,
  CAUSEHOUSE_PROCESS,
  groupServicesByCategory,
  splitParagraphs
} = require('../partner-website/causehouse-theme');
const { isValidImageUrl } = require('../partner-website/demo-cards');

const COPY = DEFAULT_SECTION_COPY;

function shell(inner) {
  return '<div class="ch-shell">' + inner + '</div>';
}

function chapter(band, inner, opts) {
  opts = opts || {};
  const id = opts.id ? ' id="' + esc(opts.id) + '"' : '';
  const cls = opts.className ? ' ' + esc(opts.className) : '';
  return '<section class="ch-chapter ch-chapter-' + band + cls + '"' + id + '>' + shell(inner) + '</section>';
}

function eyebrow(text, variant) {
  if (!text) return '';
  return '<span class="ch-eyebrow ch-eyebrow-' + (variant || 'lime') + '">' + esc(text) + '</span>';
}

function pickHighlightPhrase(headline, hint) {
  const text = String(headline || '').trim();
  const hintStr = String(hint || '').trim();
  if (hintStr && text.toLowerCase().includes(hintStr.toLowerCase())) {
    return { phrase: hintStr, idx: text.toLowerCase().indexOf(hintStr.toLowerCase()) };
  }
  const words = text.replace(/\.$/, '').split(/\s+/).filter(function(w) {
    return w.length > 3 && !/^(for|and|the|your|with|that|from|into|over)$/i.test(w);
  });
  const word = words[Math.min(1, words.length - 1)] || words[0] || '';
  if (!word) return null;
  const idx = text.toLowerCase().indexOf(word.toLowerCase());
  return idx >= 0 ? { phrase: word, idx: idx } : null;
}

function displayHeadline(headline, hint) {
  const text = String(headline || '').trim();
  if (!text) return '';
  const hit = pickHighlightPhrase(text, hint);
  if (!hit) return '<span class="ch-display">' + esc(text) + '</span>';
  const before = text.slice(0, hit.idx);
  const match = text.slice(hit.idx, hit.idx + hit.phrase.length);
  const after = text.slice(hit.idx + hit.phrase.length);
  return '<span class="ch-display">' + esc(before)
    + '<span class="ch-lime-word">' + esc(match) + '</span>'
    + esc(after) + '</span>';
}

function sectionTitle(text, hint) {
  const t = String(text || '').trim();
  if (!t) return '';
  const hit = pickHighlightPhrase(t, hint);
  if (hit) {
    return '<h2 class="ch-h1">' + esc(t.slice(0, hit.idx))
      + '<span class="ch-lime-inline">' + esc(t.slice(hit.idx, hit.idx + hit.phrase.length)) + '</span>'
      + esc(t.slice(hit.idx + hit.phrase.length)) + '</h2>';
  }
  return '<h2 class="ch-h1">' + esc(t) + '</h2>';
}

function brandName(c, ctx) {
  return (c.partner && c.partner.agencyName) || ctx.name || 'Your agency';
}

function navBlock(c, ctx) {
  const hero = c.hero || {};
  const brand = brandName(c, ctx);
  const logo = c.partner && c.partner.logoUrl;
  return '<header class="ch-header">'
    + shell(
      (logo ? '<a href="#top" class="ch-brand"><img src="' + esc(logo) + '" alt="' + esc(brand) + '"></a>'
        : '<a href="#top" class="ch-brand ch-brand-text">' + esc(brand) + '</a>')
      + '<nav class="ch-nav ch-nav-links" aria-label="Primary">'
      + COPY.nav.map(function(link) {
        return '<a href="' + esc(link.href) + '">' + esc(link.label) + '</a>';
      }).join('')
      + '</nav>'
      + '<a class="ch-btn ch-btn-primary ch-header-cta" href="#contact">' + esc(hero.primaryCta) + '</a>'
      + '<button class="ch-pill ch-menu-btn" type="button" aria-label="Menu" data-pt-menu>Menu</button>'
    )
    + '</header>';
}

function heroVisual(c) {
  const p = c.partner || {};
  if (p.headshotUrl && isValidImageUrl(p.headshotUrl)) {
    return '<div class="ch-hero-visual ch-hero-frame">'
      + '<img src="' + esc(p.headshotUrl) + '" alt="' + esc(p.displayName) + '" class="ch-hero-photo" loading="eager">'
      + '</div>';
  }
  const brand = p.agencyName || p.displayName || 'Partner';
  const initial = brand.charAt(0).toUpperCase();
  return '<div class="ch-hero-visual ch-hero-brand-graphic" aria-hidden="true">'
    + '<div class="ch-brand-mark"><span class="ch-brand-initial">' + esc(initial) + '</span></div>'
    + '<div class="ch-brand-frames"><span></span><span></span><span></span></div>'
    + '<div class="ch-brand-lime-blob"></div>'
    + '</div>';
}

function heroTrustDetails(c) {
  const pos = c.positioning || {};
  const items = [];
  if (pos.partnerPromise) items.push({ strong: pos.partnerPromise, label: 'Partner promise' });
  if (pos.localCredibilityStatement) items.push({ strong: pos.localCredibilityStatement, label: 'Local credibility' });
  if (pos.platformBackingStatement) items.push({ strong: pos.platformBackingStatement, label: 'Platform backing' });
  if (!items.length) return '';
  return '<div class="ch-hero-trust">'
    + items.slice(0, 3).map(function(it) {
      return '<div class="ch-hero-trust-item"><p>' + esc(it.strong) + '</p></div>';
    }).join('')
    + '</div>';
}

function heroSection(c) {
  const hero = c.hero || {};
  return chapter('bg', ''
    + '<div class="ch-hero-grid" id="top">'
    + '<div class="ch-hero-copy">'
    + eyebrow(hero.eyebrow, 'lime')
    + '<h1>' + displayHeadline(hero.headline, hero.highlightedPhrase) + '</h1>'
    + '<p class="ch-lead">' + esc(hero.supportingText) + '</p>'
    + '<div class="ch-hero-actions">'
    + '<a class="ch-btn ch-btn-primary ch-btn-hero-primary" href="#contact">' + esc(hero.primaryCta) + '</a>'
    + '<a class="ch-btn ch-btn-ghost-paper" href="' + esc(hero.secondaryCtaHref || '#demos') + '">' + esc(hero.secondaryCta) + '</a>'
    + '</div>'
    + heroTrustDetails(c)
    + '</div>'
    + heroVisual(c)
    + '</div>', { className: 'ch-hero-section' });
}

function proofSection(content) {
  if (!content.visibility || content.visibility.trust === false) return '';
  const proof = COPY.proof;
  const pos = content.positioning || {};
  const statement = pos.platformBackingStatement
    ? 'Local website guidance, backed by a complete digital platform.'
    : proof.statement;
  return chapter('ink', ''
    + '<div class="ch-proof-band">'
    + '<p class="ch-proof-statement">' + esc(statement) + '</p>'
    + '<div class="ch-proof-items">'
    + proof.items.map(function(it) {
      return '<div class="ch-proof-item">'
        + '<span class="ch-proof-marker" aria-hidden="true"></span>'
        + '<div><strong>' + esc(it.label) + '</strong>'
        + '<span>' + esc(it.value) + '</span></div></div>';
    }).join('')
    + '</div></div>', { className: 'ch-proof-section', id: 'proof' });
}

function valueSection(content) {
  if (!content.visibility || content.visibility.included === false) return '';
  const v = COPY.value;
  const pos = content.positioning || {};
  const body = v.body.slice();
  if (pos.platformBackingStatement) {
    body[1] = pos.platformBackingStatement;
  }
  return chapter('ink', ''
    + '<div class="ch-value-split">'
    + '<div class="ch-value-intro">'
    + eyebrow(v.eyebrow, 'outline')
    + '<h2 class="ch-h1 ch-on-dark">' + esc(v.heading) + '</h2>'
    + body.map(function(p) { return '<p class="ch-body-muted">' + esc(p) + '</p>'; }).join('')
    + '</div>'
    + '<div class="ch-value-cards">'
    + v.cards.map(function(card, i) {
      return '<article class="ch-card-ink ch-value-card">'
        + '<span class="ch-num">' + String(i + 1).padStart(2, '0') + '</span>'
        + '<div><h3 class="ch-h3 ch-on-dark">' + esc(card.title) + '</h3>'
        + '<p class="ch-body-muted">' + esc(card.body) + '</p></div>'
        + '</article>';
    }).join('')
    + '</div></div>', { id: 'included', className: 'ch-value-section' });
}

function industriesSection(content) {
  if (!content.visibility || content.visibility.industries === false) return '';
  const list = content.industries || [];
  if (!list.length) return '';
  const ic = COPY.industries;
  return chapter('bg', ''
    + eyebrow(ic.eyebrow, 'outline-paper')
    + sectionTitle(ic.heading)
    + '<p class="ch-section-sub">' + esc(ic.sub) + '</p>'
    + '<div class="ch-pill-row ch-pill-row-tight">'
    + list.map(function(i) { return '<span class="ch-pill">' + esc(i) + '</span>'; }).join('')
    + '</div>', { id: 'industries' });
}

function demoImageHtml(d) {
  const hasImg = d.thumbnail && isValidImageUrl(d.thumbnail);
  const bg = d.thumbnailColor ? ' style="background:' + esc(d.thumbnailColor) + '"' : '';
  if (hasImg) {
    return '<a class="ch-demo-img" href="' + esc(d.url) + '" target="_blank" rel="noopener"' + bg + '>'
      + '<img src="' + esc(d.thumbnail) + '" alt="' + esc(d.name) + '" loading="lazy" '
      + 'onerror="this.style.display=\'none\';this.parentElement.classList.add(\'is-fallback\');">'
      + '</a>';
  }
  return '<a class="ch-demo-img is-fallback" href="' + esc(d.url) + '" target="_blank" rel="noopener"' + bg + '>'
    + '<span class="ch-demo-fallback-label">' + esc(d.industry || 'Live demo') + '</span></a>';
}

function demosSection(content) {
  if (!content.visibility || content.visibility.demos === false) return '';
  const demos = (content.demos || []).slice(0, 3);
  if (!demos.length) return '';
  const dc = COPY.demos;
  return chapter('surface', ''
    + eyebrow(dc.eyebrow, 'outline-paper')
    + sectionTitle(dc.heading)
    + '<p class="ch-section-sub">' + esc(dc.sub) + '</p>'
    + '<div class="ch-demo-grid ch-demo-grid-featured">'
    + demos.map(function(d) {
      return '<article class="ch-card-hard ch-demo-card ch-demo-card-lg">'
        + demoImageHtml(d)
        + '<div class="ch-demo-body">'
        + '<span class="ch-demo-cat">' + esc(d.industry) + '</span>'
        + '<h3><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.name) + '</a></h3>'
        + (d.description ? '<p class="ch-demo-summary">' + esc(d.description) + '</p>' : '')
        + (d.features && d.features.length ? '<ul class="ch-demo-tags">' + d.features.slice(0, 3).map(function(f) {
          return '<li>' + esc(f) + '</li>';
        }).join('') + '</ul>' : '')
        + '<div class="ch-demo-actions">'
        + '<a class="ch-btn ch-btn-primary" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.ctaExplore) + '</a>'
        + '<a class="ch-btn ch-btn-ghost-paper" href="#contact" data-demo-ref="' + esc(d.slug) + '">' + esc(d.ctaBuild) + '</a>'
        + '</div></div></article>';
    }).join('')
    + '</div>', { id: 'demos' });
}

function servicesSection(content) {
  if (!content.visibility || content.visibility.services === false) return '';
  const categories = groupServicesByCategory(content.services);
  if (!categories.length) return '';
  const sc = COPY.services;
  return chapter('bg', ''
    + eyebrow(sc.eyebrow, 'outline-paper')
    + sectionTitle(sc.heading)
    + '<div class="ch-category-grid">'
    + categories.map(function(cat) {
      return '<article class="ch-card-hard ch-category-card">'
        + '<span class="ch-num-badge">' + esc(cat.num) + '</span>'
        + '<h3 class="ch-category-title">' + esc(cat.heading) + '</h3>'
        + '<p class="ch-category-summary">' + esc(cat.summary) + '</p>'
        + '<ul class="ch-category-list">'
        + cat.services.map(function(s) {
          const note = s.personalNote || s.description;
          return '<li><strong>' + esc(s.name) + '</strong>'
            + (note ? '<span>' + esc(note) + '</span>' : '') + '</li>';
        }).join('')
        + '</ul>'
        + '<a class="ch-btn ch-btn-primary ch-btn-sm" href="#contact">Plan my website</a>'
        + '</article>';
    }).join('')
    + '</div>', { id: 'services' });
}

function processSection(content) {
  if (!content.visibility || content.visibility.process === false) return '';
  const steps = CAUSEHOUSE_PROCESS;
  const pc = COPY.process;
  return chapter('bg', ''
    + eyebrow(pc.eyebrow, 'outline-paper')
    + sectionTitle(pc.heading)
    + '<ol class="ch-process-timeline">'
    + steps.map(function(s) {
      return '<li class="ch-process-step">'
        + '<span class="ch-process-num">' + String(s.step).padStart(2, '0') + '</span>'
        + '<div class="ch-process-copy">'
        + '<h3>' + esc(s.title) + '</h3>'
        + '<p>' + esc(s.description) + '</p>'
        + '</div></li>';
    }).join('')
    + '</ol>', { id: 'process' });
}

function bioVisual(p) {
  if (p.headshotUrl && isValidImageUrl(p.headshotUrl)) {
    return '<img src="' + esc(p.headshotUrl) + '" alt="' + esc(p.displayName) + '" class="ch-bio-headshot" loading="lazy">';
  }
  const brand = p.agencyName || p.displayName || 'Partner';
  return '<div class="ch-bio-brand-graphic" aria-hidden="true">'
    + '<div class="ch-brand-mark ch-brand-mark-lg"><span class="ch-brand-initial">' + esc(brand.charAt(0).toUpperCase()) + '</span></div>'
    + '<p class="ch-bio-graphic-label">' + esc(brand) + '</p>'
    + '</div>';
}

function biographySection(content) {
  if (!content.visibility || content.visibility.biography === false) return '';
  const b = content.biography || {};
  const p = content.partner || {};
  const c = content.contact || {};
  if (!b.shortIntro && !b.fullBio) return '';
  const paras = splitParagraphs(b.fullBio);
  const pc = COPY.partner;
  return chapter('surface', ''
    + '<div class="ch-bio-grid">'
    + '<div class="ch-bio-photo">' + bioVisual(p) + '</div>'
    + '<div class="ch-bio-copy">'
    + eyebrow(pc.eyebrow, 'outline-paper')
    + '<h2 class="ch-h1">' + esc(pc.headingPrefix) + ' ' + esc(p.displayName) + '.</h2>'
    + '<p class="ch-bio-role">' + esc(p.agencyName) + ' · Local LeadPages Partner</p>'
    + (b.shortIntro ? '<p class="ch-bio-intro">' + esc(b.shortIntro) + '</p>' : '')
    + paras.map(function(para) { return '<p class="ch-bio-para">' + esc(para) + '</p>'; }).join('')
    + (b.professionalBackground ? '<p class="ch-bio-detail"><strong>Background:</strong> ' + esc(b.professionalBackground) + '</p>' : '')
    + (b.workingStyle ? '<p class="ch-bio-detail"><strong>How I work:</strong> ' + esc(b.workingStyle) + '</p>' : '')
    + (b.whyPartner ? '<p class="ch-bio-detail"><strong>Why LeadPages:</strong> ' + esc(b.whyPartner) + '</p>' : '')
    + '<div class="ch-bio-meta">'
    + (b.yearsExperience ? '<span>' + esc(b.yearsExperience) + ' experience</span>' : '')
    + (b.industriesWorked ? '<span>' + esc(b.industriesWorked) + '</span>' : '')
    + '</div>'
    + '<div class="ch-bio-actions">'
    + (c.phone ? '<a class="ch-btn ch-btn-outline-paper" href="tel:' + c.phone.replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a>' : '')
    + (c.email ? '<a class="ch-btn ch-btn-outline-paper" href="mailto:' + esc(c.email) + '">Email ' + esc(p.firstName || p.displayName) + '</a>' : '')
    + (c.bookingUrl ? '<a class="ch-btn ch-btn-primary" href="' + esc(c.bookingUrl) + '" target="_blank" rel="noopener">Book consultation</a>'
      : '<a class="ch-btn ch-btn-primary" href="#contact">' + esc(c.ctaLabel || 'Plan my website') + '</a>')
    + '</div></div></div>', { id: 'partner' });
}

function serviceAreaSection(content) {
  if (!content.visibility || content.visibility.serviceArea === false) return '';
  const sa = content.serviceArea || {};
  const areas = sa.areas || [];
  if (!areas.length && !sa.headline) return '';
  const sac = COPY.serviceArea;
  const note = sac.sub;
  return chapter('bg', ''
    + eyebrow(sac.eyebrow, 'outline-paper')
    + sectionTitle(sa.headline || 'Website design for local businesses')
    + '<p class="ch-section-sub">' + esc(note) + '</p>'
    + '<div class="ch-pill-row ch-pill-row-tight">'
    + areas.map(function(a) { return '<span class="ch-pill">' + esc(a.label) + '</span>'; }).join('')
    + '</div>', { id: 'areas' });
}

function platformBackingSection(content) {
  if (!content.visibility || content.visibility.platformBacking === false) return '';
  const pb = content.platformBacking || {};
  const p = content.partner || {};
  const plc = COPY.platform;
  const agency = p.agencyName || p.displayName;
  return chapter('ink', ''
    + eyebrow(plc.eyebrow, 'outline')
    + sectionTitle(plc.heading)
    + '<div class="ch-platform-bridge">'
    + '<article class="ch-card-ink ch-platform-panel">'
    + '<span class="ch-platform-label">' + esc(agency) + '</span>'
    + '<h3 class="ch-h3 ch-on-dark">Strategy and relationship</h3>'
    + '<ul class="ch-platform-list">' + plc.agencyItems.map(function(item) {
      return '<li>' + esc(item) + '</li>';
    }).join('') + '</ul>'
    + '<p class="ch-body-muted">' + esc(pb.personalStatement || '') + '</p>'
    + '</article>'
    + '<div class="ch-platform-connector" aria-hidden="true"><span>+</span></div>'
    + '<article class="ch-card-ink ch-platform-panel">'
    + '<span class="ch-platform-label">LeadPages</span>'
    + '<h3 class="ch-h3 ch-on-dark">Platform and infrastructure</h3>'
    + '<ul class="ch-platform-list">' + plc.platformItems.map(function(item) {
      return '<li>' + esc(item) + '</li>';
    }).join('') + '</ul>'
    + '<p class="ch-body-muted">' + esc(pb.copy || '') + '</p>'
    + '</article>'
    + '</div>', { id: 'support' });
}

function testimonialsSection(content) {
  if (!content.visibility || content.visibility.testimonials === false) return '';
  const list = content.testimonials || [];
  if (!list.length) return '';
  const tc = COPY.testimonials;
  const featured = list.find(function(t) { return t.featured; }) || list[0];
  const rest = list.filter(function(t) { return t !== featured; }).slice(0, 2);
  function renderCard(t, large) {
    const label = t.isPlatform ? tc.platformLabel : tc.partnerLabel;
    return '<blockquote class="ch-card-hard ch-testimonial' + (large ? ' ch-testimonial-featured' : '') + '">'
      + '<span class="ch-testimonial-label">' + esc(label) + '</span>'
      + '<p>&ldquo;' + esc(t.text) + '&rdquo;</p>'
      + '<footer><strong>' + esc(t.customerName || 'Client') + '</strong>'
      + (t.businessName ? '<span>' + esc(t.businessName) + '</span>' : '')
      + (t.location ? '<span>' + esc(t.location) + '</span>' : '')
      + '</footer></blockquote>';
  }
  return chapter('surface', ''
    + eyebrow(tc.eyebrow, 'outline-paper')
    + sectionTitle(tc.heading)
    + '<div class="ch-testimonial-layout">'
    + renderCard(featured, true)
    + '<div class="ch-testimonial-supporting">' + rest.map(function(t) { return renderCard(t, false); }).join('') + '</div>'
    + '</div>', { id: 'testimonials' });
}

function faqsSection(content) {
  if (!content.visibility || content.visibility.faqs === false) return '';
  const faqs = content.faqs || [];
  if (!faqs.length) return '';
  const fc = COPY.faqs;
  const featured = faqs.slice(0, fc.featuredCount);
  const more = faqs.slice(fc.featuredCount);
  return chapter('surface', ''
    + eyebrow(fc.eyebrow, 'outline-paper')
    + sectionTitle(fc.heading)
    + '<div class="ch-faq-list" data-ch-faq-list>'
    + featured.map(function(f, i) {
      return faqItem(f, i === 0);
    }).join('')
    + (more.length ? '<div class="ch-faq-more" hidden data-ch-faq-more>'
      + more.map(function(f) { return faqItem(f, false); }).join('')
      + '</div>'
      + '<button type="button" class="ch-btn ch-btn-outline-paper ch-faq-expand" data-ch-faq-expand>'
      + esc(fc.expandLabel) + ' (' + more.length + ')</button>' : '')
    + '</div>', { id: 'faqs' });
}

function faqItem(f, open) {
  return '<details class="ch-card-hard ch-faq-item"' + (open ? ' open' : '') + '>'
    + '<summary><span class="ch-faq-q">' + esc(f.question) + '</span>'
    + '<span class="ch-faq-icon" aria-hidden="true"></span></summary>'
    + '<div class="ch-faq-answer"><p>' + esc(f.answer) + '</p></div></details>';
}

function stagedEnquiryForm(content) {
  const c = content.contact || {};
  const ef = content.enquiryForm || {};
  const goals = ef.goals || [];
  const features = ef.features || [];
  const cc = COPY.contact;
  const showExt = ef.showExtended !== false;

  let html = '<form class="ch-form pt-enquiry-form" data-pl-lead-form data-pl-kind="partner-consultation" data-pl-extended="1" data-ch-staged-form method="post" action="#">'
    + '<h3>' + esc(cc.formTitle) + '</h3>'
    + '<p class="pt-form-sub">' + esc(cc.formSub) + '</p>'
    + '<div class="ch-form-essential pt-form-grid">'
    + '<label><span>Name *</span><input name="name" type="text" required autocomplete="name"></label>'
    + '<label><span>Email</span><input name="email" type="email" autocomplete="email"></label>'
    + '<label><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label>'
    + '<label><span>Business name</span><input name="businessName" type="text"></label>'
    + '<label><span>Existing website</span><input name="existingWebsite" type="url" placeholder="https://"></label>'
    + '<label class="pt-form-full"><span>Main goal</span><select name="mainGoal"><option value="">Choose…</option>'
    + goals.map(function(g) { return '<option>' + esc(g) + '</option>'; }).join('') + '</select></label>'
    + '<label class="pt-form-full"><span>Message</span><textarea name="message" rows="4" placeholder="Tell us what you need"></textarea></label>'
    + '</div>';

  if (showExt) {
    html += '<button type="button" class="ch-form-more-toggle" data-ch-form-more>' + esc(cc.moreLabel) + '</button>'
      + '<div class="ch-form-extended pt-form-grid" hidden data-ch-form-extended>'
      + '<label><span>Industry</span><input name="industry" type="text"></label>'
      + '<label><span>Suburb / region</span><input name="suburb" type="text"></label>'
      + '<label><span>New site or redesign?</span><select name="projectType"><option value="">Choose…</option><option>New website</option><option>Redesign</option><option>Not sure</option></select></label>'
      + '<label class="pt-form-full"><span>Features needed</span><select name="features" multiple size="4">'
      + features.map(function(f) { return '<option>' + esc(f) + '</option>'; }).join('') + '</select></label>'
      + '<label><span>Approx. budget</span><select name="budget"><option value="">Prefer not to say</option><option>Under $2,000</option><option>$2,000–$5,000</option><option>$5,000–$10,000</option><option>$10,000+</option></select></label>'
      + '<label><span>Launch timeframe</span><select name="timeframe"><option value="">Flexible</option><option>ASAP</option><option>1–3 months</option><option>3–6 months</option></select></label>'
      + '<label><span>Preferred contact</span><select name="contactMethod"><option>Email</option><option>Phone</option><option>Either</option></select></label>'
      + '</div>';
  }

  html += '<label class="pt-form-consent"><input type="checkbox" name="consent" required> I agree to be contacted about my website enquiry.</label>'
    + '<button class="ch-btn ch-btn-primary ch-form-submit" type="submit">' + esc(c.ctaLabel || 'Plan my website') + '</button>'
    + '<p class="pl-form-err"></p><p class="pl-form-ok" hidden>Thanks — we\'ll be in touch shortly.</p>'
    + '</form>';
  return html;
}

function contactSection(content) {
  if (!content.visibility || content.visibility.contact === false) return '';
  const p = content.partner || {};
  const c = content.contact || {};
  const cc = COPY.contact;
  const offer = content.leadOffer || {};
  const offerHtml = (offer.enabled && content.visibility.leadOffer !== false)
    ? '<div class="ch-contact-offer">'
      + '<h3 class="ch-h3 ch-on-dark">' + esc(offer.title) + '</h3>'
      + '<p class="ch-body-muted">' + esc(offer.description) + '</p>'
      + '<a class="ch-btn ch-btn-ghost-paper ch-on-dark" href="#contact" data-offer="review">' + esc(offer.ctaLabel || 'Request review') + '</a>'
      + '</div>' : '';

  return chapter('ink', ''
    + '<div class="ch-contact-grid">'
    + '<div class="ch-contact-info">'
    + eyebrow(cc.eyebrow, 'outline')
    + '<h2 class="ch-h1 ch-on-dark">' + esc(cc.headingPrefix) + '</h2>'
    + '<p class="ch-body-muted ch-read-width">' + esc(cc.sub) + '</p>'
    + '<ul class="ch-contact-list">'
    + (c.email ? '<li><strong>Email</strong> <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : '')
    + (c.phone ? '<li><strong>Phone</strong> <a href="tel:' + c.phone.replace(/[^+0-9]/g, '') + '">' + esc(c.phone) + '</a></li>' : '')
    + (c.responseTime ? '<li><strong>Response</strong> ' + esc(c.responseTime) + '</li>' : '')
    + (c.contactHours ? '<li><strong>Hours</strong> ' + esc(c.contactHours) + '</li>' : '')
    + '</ul>'
    + offerHtml
    + '<div class="ch-lp-disclosure">'
    + '<span class="ch-lp-disclosure-logo leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
    + '<span class="ch-lp-disclosure-text">Powered by LeadPages platform infrastructure with local partner support.</span>'
    + '</div>'
    + '</div>'
    + stagedEnquiryForm(content)
    + '</div>', { id: 'contact', className: 'ch-contact-section' });
}

function closingCtaSection(content) {
  const hero = content.hero || {};
  const cc = COPY.closingCta;
  return chapter('lime', ''
    + '<div class="ch-cta-band">'
    + '<div class="ch-cta-copy">'
    + eyebrow(cc.eyebrow, 'ink')
    + '<h2 class="ch-display ch-on-primary">' + esc(cc.heading) + '</h2>'
    + '</div>'
    + '<a class="ch-btn ch-btn-ink" href="#contact">' + esc(hero.primaryCta) + '</a>'
    + '</div>', { className: 'ch-closing-cta' });
}

function footerBlock(ctx, c) {
  const brand = (c && c.partner && c.partner.agencyName) || ctx.name;
  const p = c && c.partner ? c.partner : {};
  const logo = p.logoUrl || ctx.logoUrl;
  const tagline = (c && c.positioning && c.positioning.partnerPromise)
    || (c && c.hero && c.hero.supportingText)
    || ctx.intro;
  const sa = c && c.serviceArea ? c.serviceArea : {};
  const areaNote = sa.areas && sa.areas.length
    ? sa.areas.slice(0, 4).map(function(a) { return a.label; }).join(', ')
    : '';
  return '<footer class="ch-footer">'
    + shell(
      '<div class="ch-footer-grid">'
      + '<div class="ch-footer-brand">'
      + (logo ? '<img src="' + esc(logo) + '" alt="' + esc(brand) + '" class="ch-footer-logo">'
        : '<strong class="ch-footer-name">' + esc(brand) + '</strong>')
      + '<p class="ch-read-width">' + esc(tagline) + '</p>'
      + (areaNote ? '<p class="ch-footer-area">Serving ' + esc(areaNote) + (sa.areas.length > 4 ? ' and surrounding regions' : '') + '</p>' : '')
      + '</div>'
      + '<nav class="ch-footer-nav" aria-label="Footer">'
      + '<a href="#services">Websites</a><a href="#demos">Live demos</a><a href="#partner">About</a><a href="#faqs">FAQs</a><a href="#contact">Contact</a>'
      + '<a href="/privacy-policy.html">Privacy</a><a href="/terms-of-use.html">Terms</a>'
      + '</nav>'
      + '</div>'
      + '<div class="ch-footer-bottom">'
      + '<p class="ch-footer-copy">&copy; ' + ctx.year + ' ' + esc(brand) + '</p>'
      + '<a href="https://www.leadpages.com.au" target="_blank" rel="noopener" class="ch-lp-badge">'
      + '<span class="ch-lp-badge-logo leadpages-logo" data-lp-logo="auto" data-lp-logo-ink="auto" data-lp-logo-pulse="false" role="img" aria-label="LeadPages"></span>'
      + '<span class="ch-lp-badge-label">Powered by <strong>LeadPages</strong></span>'
      + '</a>'
      + '</div>'
    )
    + '</footer>';
}

function allSections(content) {
  return ''
    + proofSection(content)
    + valueSection(content)
    + industriesSection(content)
    + demosSection(content)
    + servicesSection(content)
    + processSection(content)
    + biographySection(content)
    + serviceAreaSection(content)
    + platformBackingSection(content)
    + testimonialsSection(content)
    + faqsSection(content)
    + contactSection(content)
    + closingCtaSection(content);
}

module.exports = {
  navBlock, heroSection, footerBlock, allSections,
  proofSection, valueSection, industriesSection, demosSection,
  servicesSection, processSection, biographySection, serviceAreaSection,
  platformBackingSection, testimonialsSection, faqsSection,
  contactSection, closingCtaSection
};
