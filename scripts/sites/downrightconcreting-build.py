#!/usr/bin/env python3
"""
Builds the sites.config for Down Right Concreting (slug: downrightconcreting),
migrated from https://www.downrightconcreting.com.au (Joomla, Oct 2026).

All customer-facing copy is taken verbatim from the old site (content.json,
extracted by scripts/sites/downrightconcreting-extract.py); images are served
from /assets/sites/downrightconcreting/ (same pattern as kitchens-canberra).

Usage: python3 scripts/sites/downrightconcreting-build.py <content.json> <gallery-html-dir> <dims.json> > config.json
"""
import json, re, sys, html as H, os

CONTENT = json.load(open(sys.argv[1]))
GAL_DIR = sys.argv[2]
DIMS = json.load(open(sys.argv[3]))
A = 'https://www.leadpages.com.au/assets/sites/downrightconcreting'
ORANGE, INK, MUTED = '#E96D20', '#232323', '#5B6470'
PHONE, PHONE_TXT = '+61419635520', '0419 635 520'


def blocks(key):
    out = []
    for b in CONTENT[key]['blocks']:
        t = b.get('text') or ''
        if 'Canberra Web' in t or t.startswith('©'):
            continue
        out.append(b)
    return out


def md(bl, skip_h1=True, start=0, stop=None):
    """Old-site blocks → page body Markdown (## headings, - lists, paragraphs)."""
    parts = []
    run = []  # consecutive one-line items ("Bobcat", "Dingo for smaller areas") → list

    def flush():
        if run:
            parts.append('\n'.join('- ' + x for x in run))
            run.clear()
    for b in bl[start:stop]:
        t = b['t']
        if t == 'h1' and skip_h1:
            continue
        if t in ('h1', 'h2', 'h3', 'h4'):
            flush(); parts.append('## ' + b['text']); continue
        if t == 'ul':
            flush(); parts.append('\n'.join('- ' + x for x in b['items'])); continue
        txt = b['text']
        if len(txt.split()) <= 5 and not re.search(r'[.!?:;]$', txt):
            run.append(txt); continue
        flush(); parts.append(txt)
    flush()
    return '\n\n'.join(parts)


def img(name):
    d = DIMS.get(name)
    return A + '/' + name, d


# ---------------------------------------------------------------- gallery data
ALBUMS = [
    ('exposed-aggregate', 'Exposed Aggregate', 'exposed-aggregate.html', 'exposed-aggregate'),
    ('decorative', 'Decorative Concrete', 'decorative-concrete.html', 'decorative'),
    ('plain-coloured', 'Plain & Coloured Concrete', 'plain-coloured-concrete.html', 'plain-coloured'),
    ('commercial', 'Commercial Concrete', 'commercial.html', 'commercial'),
    ('polished', 'Polished Concrete', 'polished-concrete.html', 'polished'),
]


def album_alts(fn):
    s = open(os.path.join(GAL_DIR, fn), encoding='utf-8', errors='replace').read()
    # main list items: <a href=".../NAME-800-600-80..."> ... alt="..."
    alts = []
    for m in re.finditer(r'<a class="ig-lightbox-link"[^>]*href="[^"]*-800-600-80[^"]*"[^>]*>([^<]*)</a>', s):
        alts.append(H.unescape(m.group(1)).strip())
    return alts


def nice_caption(t):
    t = re.sub(r'\s+', ' ', t or '').strip()
    if not t:
        return ''
    t = t[0].upper() + t[1:]
    return t


IMAGES, CATS = [], []
for cid, name, fn, folder in ALBUMS:
    CATS.append({'id': 'cat-' + cid, 'on': True, 'name': name, 'slug': cid})
    alts = album_alts(fn)
    files = sorted(k for k in DIMS if k.startswith('gallery/' + folder + '/'))
    for i, f in enumerate(files):
        w, h = DIMS[f]
        cap = nice_caption(alts[i]) if i < len(alts) else ''
        IMAGES.append({
            'id': 'drc-%s-%02d' % (cid, i + 1), 'on': True, 'src': A + '/' + f, 'width': w, 'height': h,
            'orientation': 'landscape' if w > h * 1.05 else ('portrait' if w < h * 0.95 else 'square'),
            'title': name, 'caption': cap,
            'alt': (cap + ' — ' if cap and cap.lower() != name.lower() else '') + name + ' by Down Right Concreting, Canberra',
            'categoryId': 'cat-' + cid, 'albumId': '', 'tags': [name], 'size': '', 'featured': False,
        })


def imgs_of(*cats, limit=None):
    out = [dict(i) for i in IMAGES if i['categoryId'] in ['cat-' + c for c in cats]]
    return out[:limit] if limit else out


GALLERY_BASE = {
    'radius': 10, 'gap': 10, 'hover': 'zoom', 'overlay': 'none', 'lightboxOn': True, 'lightboxStyle': 'dark',
    'lightboxCaptions': True, 'lightboxThumbnails': True, 'lightboxZoom': True, 'smartPreset': '',
    'columnsDesktop': 4, 'columnsTablet': 3, 'columnsMobile': 2, 'urlMode': 'hash', 'analyticsOn': True,
    'seoIndex': True, 'eyebrowColor': ORANGE, 'activeFilterColor': ORANGE, 'badgeBg': ORANGE,
}

# ---------------------------------------------------------------- services (cards)
home = blocks('home')


def home_para(h3):
    for i, b in enumerate(home):
        if b['t'] == 'h3' and b['text'] == h3:
            return home[i + 1]['text']
    raise KeyError(h3)


def first_para(key):
    return next(b['text'] for b in blocks(key) if b['t'] == 'p')


SERVICES = [
    ('Residential Concrete', home_para('Residential'), 'service-residential.jpg', 'residential-concrete', 'home'),
    ('Commercial Concrete', home_para('Commercial'), 'service-commercial.jpg', 'commercial-concrete', 'building-2'),
    ('Exposed Aggregate Concrete', home_para('Exposed Aggregate Concrete'), 'service-exposed-aggregate.jpg', 'exposed-aggregate-concrete', 'layers'),
    ('Stencil Pattern Concrete', home_para('Concrete Stenciling'), 'service-decorative.jpg', 'stencil-pattern-concrete', 'star'),
    ('Coloured Concrete', home_para('Concrete Colour Solutions'), 'page-coloured.jpg', 'coloured-concrete', 'award'),
    ('Polished Concrete', first_para('services_polished-concrete-canberra'), 'service-polished.jpg', 'polished-concrete', 'badge-check'),
    ('Grey Concrete', first_para('services_grey-concrete'), 'service-plain-grey.jpg', 'grey-concrete', 'ruler'),
    ('Concrete Driveways', first_para('services_concrete-driveways-canberra'), 'hero-1.jpg', 'concrete-driveways', 'truck'),
    ('Excavation', first_para('services_excavation') if False else blocks('services_excavation')[1]['text'], 'page-excavation.jpg', 'excavation', 'hard-hat'),
]
services_cfg = [{
    'on': True, 'title': t, 'body': body, 'image': A + '/' + im, 'icon': ic,
    'cta': {'on': True, 'label': 'Learn more', 'linkAction': 'page', 'linkPage': slug},
} for (t, body, im, slug, ic) in SERVICES]

# ---------------------------------------------------------------- FAQ
faq_bl = blocks('faqs')
FAQ = []
i = 0
while i < len(faq_bl):
    b = faq_bl[i]
    if b['t'] == 'h3':
        ans = []
        j = i + 1
        while j < len(faq_bl) and faq_bl[j]['t'] != 'h3':
            if faq_bl[j]['t'] == 'p':
                ans.append(faq_bl[j]['text'])
            elif faq_bl[j]['t'] == 'ul':
                ans.append(', '.join(faq_bl[j]['items']) + '.')
            j += 1
        FAQ.append({'on': True, 'q': b['text'], 'a': '\n\n'.join(ans)})
        i = j
    else:
        i += 1
AREAS = next(b['items'] for b in faq_bl if b['t'] == 'ul')

# ---------------------------------------------------------------- testimonials
tb = blocks('testimonials')
# The old page splits each sign-off ("Thanks, Amanda") into its own paragraph and the
# third letter sits outside the article markup, so it is carried over verbatim here.
SHANE = ("As the owner-builder of the construction project at our residence at 1 Demaine Crescent Fadden ACT I would like to take this "
         "opportunity to thank you and your team for the excellent concreting services provided as part of our construction project. "
         "The suspended house slabs are first class. The finish and sealing of the Bluestone pathways is excellent. As importantly, the "
         "teamwork and good humour of your team members made it a pleasure for us to have Down Right at our residence. I unreservedly "
         "recommend your concreting services. Please be assured I am happy for you to use this communication as testimony of our "
         "satisfaction with Down Right services.")
REVIEWS = [
    {'who': 'Amanda', 'text': tb[0]['text'], 'stars': 5, 'source': ''},
    {'who': 'Ryan & Mel', 'text': tb[2]['text'], 'stars': 5, 'source': ''},
    {'who': 'Shane Gilbert — owner-builder, Fadden ACT', 'text': SHANE, 'stars': 5, 'source': ''},
]

# ---------------------------------------------------------------- shared sections
OFF = ["emerg", "hero", "serviceProcess", "featureStrip", "why", "crew", "aboutUs", "seoText", "searchCanvas", "instaGallery",
       "igProjectFeed", "beforeAfter", "responseCards", "projectStats", "serviceAreas", "reviewHighlights", "featuredProjects",
       "specialOffer", "scrollingSponsorBanner", "heroBeforeAfter", "splitHero", "activityCounter", "proofStream",
       "projectFeed", "jobsFeed", "beforeAfterFeed", "videoReels", "activityTimeline", "customerReactions", "onlineQuote",
       "orderStorefront", "bookingStorefront", "customHtml", "estimateBuilder", "finance", "serviceAreaMap",
       "emergencyAvailability", "certifications", "promotions", "storyTimeline", "storyRows", "mapHours", "lpAccessibility"]
S = {k: {'on': False} for k in OFF}

S['header'] = {'on': True, 'cta': 'Call us now', 'button': 'Book a Quote', 'action': 'page', 'linkPage': 'book-a-quote',
               'btnBg': ORANGE, 'btnFg': '#FFFFFF', 'phoneFg': INK, 'textColor': '#6B7280', 'btnShape': 'rect', 'btnArrow': False}

nav_children = [{'label': t, 'target': 'page:' + slug, 'url': '', 'icon': '', 'opens': '_self', 'kind': 'link'} for (t, _, _, slug, _) in SERVICES]
nav_children.insert(0, {'label': 'All services', 'target': 'page:services', 'url': '', 'icon': '', 'opens': '_self', 'kind': 'link'})
S['navMenu'] = {'on': True, 'placement': 'header', 'style': 'links', 'textStyle': 'caps', 'icons': 'none',
                'fg': INK, 'linkColor': INK, 'hoverFg': ORANGE, 'hamFg': INK, 'hamStroke': INK,
                'items': [
                    {'label': 'Home', 'target': 'home', 'url': '', 'icon': '', 'opens': '_self', 'kind': 'link'},
                    {'label': 'About', 'target': 'page:about', 'url': '', 'icon': '', 'opens': '_self', 'kind': 'link'},
                    {'label': 'Services', 'kind': 'parent', 'icon': '', 'children': nav_children},
                    {'label': 'Gallery', 'target': 'page:gallery', 'url': '', 'icon': '', 'opens': '_self', 'kind': 'link'},
                    {'label': 'Testimonials', 'target': 'page:testimonials', 'url': '', 'icon': '', 'opens': '_self', 'kind': 'link'},
                    {'label': 'FAQs', 'target': 'page:faqs', 'url': '', 'icon': '', 'opens': '_self', 'kind': 'link'},
                    {'label': 'Contact', 'target': 'page:contact-us', 'url': '', 'icon': '', 'opens': '_self', 'kind': 'link'},
                ]}

hero_slides = []
for n, eb in [(1, "Canberra's concrete specialists"), (2, 'Plain grey concrete'), (3, 'Cove finish concrete'), (4, 'Exposed aggregate concrete')]:
    hero_slides.append({
        'on': True, 'imageUrl': A + '/hero-%d.jpg' % n, 'eyebrow': eb.upper(),
        'heading': "To be done right, it's gotta be", 'highlightText': 'Down Right',
        'subText': "Stylish, beautiful and functional concrete solutions for your home or commercial property — driveways, paths, pergolas, house slabs, pool surrounds and more.",
        'primaryCtaText': 'Book a Free Quote', 'primaryCtaAction': 'page', 'primaryCtaPage': 'book-a-quote', 'primaryCtaBg': ORANGE, 'primaryCtaFg': '#FFFFFF',
        'secondaryCtaText': 'Call ' + PHONE_TXT, 'secondaryCtaAction': 'call', 'secondaryCtaFg': INK, 'secondaryCtaFill': False, 'secondaryCtaOutline': True, 'secondaryCtaIcon': 'phone',
    })
S['heroSlider'] = {'on': True, 'layout': 'split', 'splitH1': 'Concrete Contractors Canberra', 'splitTone': 'soft', 'splitSide': 'right',
                   'slides': hero_slides, 'badges': [{'title': 'Established 2003'}, {'title': 'HIA member'}, {'title': 'Fully licensed & insured'}],
                   'autoplay': True, 'autoplaySeconds': 6, 'textCase': 'normal', 'textAlign': 'left', 'transitionEffect': 'fade',
                   'minHeightDesktop': 620, 'minHeightMobile': 520, 'overlayStrength': 55}

S['trustBar'] = {'on': True, 'bg': INK, 'fg': '#FFFFFF', 'badges': [
    {'icon': 'calendar-days', 'label': 'Est. 2003'},
    {'icon': 'award', 'label': 'HIA member'},
    {'icon': 'shield-check', 'label': 'Fully licensed & insured'},
    {'icon': 'badge-check', 'label': 'Built to Australian Standards'},
    {'icon': 'truck', 'label': 'Our own excavation gear'},
]}

S['services'] = {'on': True, 'mode': 'photo', 'photoCols': '3', 'photoClamp': '4', 'photoHeadSplit': True,
                 'eyebrow': 'WHAT WE DO', 'heading': 'Concrete solutions for every job',
                 'intro': 'We cater for a wide variety of concreting requirements in Canberra — big or small, decorative or functional. Choose a service to see more.'}

welcome = [b['text'] for b in home if b['t'] == 'p']
# home paragraphs: 0 welcome · 1-4 intro · 5 "We cater for…" · (service blurbs are h3+p, used on the cards)
# then "At Down Right…" · "Take a look inside…" · "Let your concrete welcome you home." · quote prompt
HOME_P = [b['text'] for b in home if b['t'] == 'p' and not any(home[k]['t'] == 'h3' and home[k + 1] is b for k in range(len(home) - 1))]
intro_paras = HOME_P[0:5]
closing = HOME_P[6:9]
S['textBox'] = {'on': True, 'layout': 'bleed', 'imageSide': 'right', 'textAlign': 'left', 'imageLayout': 'wrap',
                'eyebrow': 'WELCOME', 'heading': 'Down Right Concreting Canberra',
                'intro': "Canberra's first choice of stylish, beautiful, and functional concrete solutions.",
                'content': '\n\n'.join(intro_paras[1:] + closing[:1]),
                'image': A + '/gallery/decorative/13.jpg', 'imageAlt': 'Stencil pattern concrete path by Down Right Concreting',
                'features': [{'on': True, 'icon': 'check', 'text': x} for x in next(b['items'] for b in home if b['t'] == 'ul')],
                'ctaLabel': 'More about us', 'ctaHref': '/about'}

home_gallery_pick = ['drc-exposed-aggregate-01', 'drc-decorative-13', 'drc-decorative-01', 'drc-polished-01', 'drc-plain-coloured-01',
                     'drc-commercial-02', 'drc-decorative-16', 'drc-exposed-aggregate-03', 'drc-decorative-20', 'drc-polished-03']
by_id = {i['id']: i for i in IMAGES}
S['premiumGallery'] = dict(GALLERY_BASE, **{
    'on': True, 'structureMode': 'simple', 'filtersEnabled': False, 'layout': 'smart-mosaic', 'mosaicLocked': True,
    'mosaicLayout': [{'id': 'drc-exposed-aggregate-01', 'size': 'large'}, {'id': 'drc-polished-01', 'size': 'wide'}, {'id': 'drc-commercial-02', 'size': 'wide'}],
    'headerLayout': 'split', 'eyebrow': 'OUR WORK', 'heading': 'Recent projects',
    'intro': 'Driveways, paths, slabs, pool surrounds and commercial floors across Canberra and the region.',
    'showCount': False, 'loadMoreCount': 10, 'autoLoad': False, 'showCta': True, 'ctaText': 'View the full gallery', 'ctaAction': 'page:gallery',
    'categories': CATS, 'albums': [], 'images': [dict(by_id[k]) for k in home_gallery_pick if k in by_id],
})

S['reviews'] = {'on': True, 'eyebrow': 'TESTIMONIALS', 'heading': 'What our customers say', 'layout': 'quotes', 'items': REVIEWS}

home_faq_q = ['What is included in the base pricing', 'How soon can you start', 'How thick should my concrete be', 'How long before I can use']
S['faq'] = {'on': True, 'eyebrow': "FAQ'S", 'heading': 'Good questions, straight answers', 'columns': 2,
            'items': [f for f in FAQ if any(f['q'].startswith(q) for q in home_faq_q)]}

S['ctaBanner'] = {'on': True, 'tone': 'photo', 'width': 'full', 'align': 'left', 'bgImage': A + '/gallery/decorative/15.jpg',
                  'eyebrow': "LET'S TALK CONCRETE",
                  'heading': closing[2],
                  'text': closing[1],
                  'btn1Label': 'Book a Free Quote', 'btn1Action': 'link', 'btn1Url': '/book-a-quote',
                  'btn2Label': 'Call ' + PHONE_TXT, 'btn2Action': 'call'}

S['quote'] = {
    'on': True, 'eyebrow': 'BOOK A QUOTE', 'heading': 'Get a free, no-obligation quote.',
    'sub': 'Make use of our online quotation form, or feel free to give us a call on ' + PHONE_TXT + ' today to further discuss your options.',
    'points': [{'on': True, 'text': 'On-site quotes, valid for 30 days'}, {'on': True, 'text': 'No unexpected or hidden charges'}, {'on': True, 'text': 'Canberra, Queanbeyan, Yass & surrounds'}],
    'formTitle': 'Book a Quote', 'button': 'Request my quote',
    'lblName': 'Name', 'lblPhone': 'Phone', 'showEmail': True, 'reqEmail': True,
    'showJob': False, 'showSuburb': False,
    'lblDetail': 'Tell us about your project', 'detailPh': 'Size of the area, finish you like, timing — anything that helps.',
    'extraFields': [
        {'on': True, 'label': 'Address', 'type': 'text', 'placeholder': 'Where is the job?', 'required': True},
        {'on': True, 'label': 'I am interested in', 'type': 'checkboxes', 'required': True,
         'options': 'Driveway\nPath\nPoolside\nColoured Concrete\nStencilled Concrete\nExposed Aggregate\nExcavation'},
    ],
    # photos/plans: the Quote form's own File uploads setting (private storage, 90-day expiry)
    'uploadsOn': True, 'uploadsLabel': 'Upload files', 'uploadsMax': '5',
    'uploadsHelp': 'Photos or plans of the area — optional. Up to 5 files, 10 MB each.',
    'successTitle': "Thanks — we've got your request.",
    'successSub': "Dave will be in touch to arrange your quote. If it's urgent, call " + PHONE_TXT + '.',
    'fineText': 'Prefer to talk it through?', 'callText': 'Call ' + PHONE_TXT, 'callOn': True,
    'appearance': {'custom': True, 'eyebrowColor': ORANGE},
}

S['area'] = {'on': True, 'eyebrow': 'WHERE WE WORK', 'heading': 'Canberra, Queanbeyan, Yass & surrounds',
             'intro': FAQ[0]['a'].split('\n\n')[0], 'suburbs': AREAS,
             'ctaTitle': 'Want a free quote?', 'ctaSub': 'Talk to Dave about your driveway, path, slab or decorative finish.'}

company_links = [('About', 'about'), ('Gallery', 'gallery'), ('Testimonials', 'testimonials'), ('FAQs', 'faqs'), ('Book a Quote', 'book-a-quote'), ('Contact', 'contact-us')]
S['footer'] = {
    'on': True, 'bg': '#1C1D1F', 'ink': '#FFFFFF', 'muted': '#B8BBBF', 'accent': ORANGE,
    'blurb': "Canberra's concrete specialists since 2003 — decorative and functional concrete for homes and businesses across Canberra, Queanbeyan, Yass and surrounds.",
    'legal': '© 2026 Down Right Concreting (ACT) Pty Ltd. All rights reserved.',
    'taglineLead': "To be done right,", 'taglineAccent': "it's gotta be Down Right.",
    'columns': [
        {'on': True, 'title': 'Services', 'mode': 'links', 'links': [{'on': True, 'label': t, 'action': 'page', 'page': slug} for (t, _, _, slug, _) in SERVICES]},
        {'on': True, 'title': 'Company', 'mode': 'links', 'links': [{'on': True, 'label': l, 'action': 'page', 'page': p} for (l, p) in company_links]},
    ],
    'supportTitle': 'Talk to Dave', 'supportHelp': 'Call for a free quote', 'showSupportMap': False,
    'social': [{'on': True, 'network': 'facebook', 'url': 'https://www.facebook.com/downrightconcreting/'}], 'socialTitle': 'Follow us',
}
S['lpFooter'] = {'on': True, 'bg': '#1C1D1F', 'accent': ORANGE}
S['mobileBar'] = {'on': True}
S['seoTokens'] = {'city': 'Canberra', 'trade': 'Concreter', 'region': 'Canberra', 'suburb': 'Canberra', 'location': 'Canberra'}

# ---------------------------------------------------------------- pages
PAGES = []


def page(slug, title, meta, h1, body, apps, order, image='', img_mode='wrap-right'):
    pa, ps = [], {}
    for key, sec in apps:
        if sec is None:
            pa.append({'key': key})
        else:
            pa.append({'key': key, 'mode': 'unique', 'homeCopied': True})
            ps[key] = dict(sec, on=True, _own=True)
    PAGES.append({'id': 'pg-' + slug, 'kind': 'apps', 'title': title, 'slug': slug, 'meta': meta, 'h1': h1, 'body': body,
                  'img': image, 'imgMode': img_mode, 'menu': 'top', 'status': 'published',
                  'pageApps': pa, 'pageSections': ps, 'pageLayoutOrder': order, 'removedApps': []})


def svc_gallery(heading, imgs):
    return dict(GALLERY_BASE, **{'structureMode': 'simple', 'filtersEnabled': False, 'layout': 'justified', 'imageSize': 'standard',
                                  'headerLayout': 'left', 'eyebrow': 'RECENT WORK', 'heading': heading, 'intro': '', 'showCount': False,
                                  'loadMoreCount': 12, 'autoLoad': False, 'showCta': True, 'ctaText': 'View the full gallery',
                                  'ctaAction': 'page:gallery', 'categories': CATS, 'albums': [], 'images': imgs, 'mosaicLayout': []})


SVC_PAGES = [
    ('residential-concrete', 'services_residential-concrete', 'Residential Concrete Canberra', 'page-residential.jpg', ('exposed-aggregate', 'decorative'), 'Residential concrete projects'),
    ('commercial-concrete', 'services_commercial-concrete', 'Commercial Concrete Canberra', 'page-commercial.jpg', ('commercial',), 'Commercial concrete projects'),
    ('grey-concrete', 'services_grey-concrete', 'Grey Concrete Canberra', 'page-grey.jpg', ('plain-coloured',), 'Grey & coloured concrete projects'),
    ('exposed-aggregate-concrete', 'services_exposed-aggregate-concrete', 'Exposed Aggregate Concrete Canberra', 'page-exposed-aggregate.jpg', ('exposed-aggregate',), 'Exposed aggregate projects'),
    ('stencil-pattern-concrete', 'services_stencil-pattern-concrete', 'Stencil Pattern Concrete Canberra', 'page-stencil.jpg', ('decorative',), 'Stencil & decorative concrete projects'),
    ('coloured-concrete', 'services_coloured-concrete', 'Coloured Concrete Canberra', 'page-coloured.jpg', ('plain-coloured',), 'Coloured concrete projects'),
    ('excavation', 'services_excavation', 'Excavation Services Canberra', 'page-excavation.jpg', (), ''),
    ('concrete-driveways', 'services_concrete-driveways-canberra', 'Concrete Driveways Canberra', 'hero-1.jpg', ('exposed-aggregate', 'decorative', 'plain-coloured'), 'Driveway projects'),
    ('polished-concrete', 'services_polished-concrete-canberra', 'Polished Concrete Canberra', 'polished-full-exposure.jpg', ('polished',), 'Polished concrete projects'),
]
for slug, key, h1, image, cats, gh in SVC_PAGES:
    bl = blocks(key)
    body = md(bl)
    apps, order = [], ['__lpArticle']
    if key == 'services_stencil-pattern-concrete':
        body = body.replace('Download Stencil Brochure Download Colour Chart Brochure', 'Download our stencil pattern and colour chart brochures below to start planning your finish.')
        apps.append(('ctaBanner', {'tone': 'light', 'width': 'contained', 'align': 'left', 'bgImage': '',
                                   'eyebrow': 'COLOUR CHARTS', 'heading': "Down Right's concrete stencilling — patterns & colours",
                                   'text': 'Choosing colours and patterns can be time consuming. Download our brochures, and ask to see our sample boards — you can place them around your home to see how each option suits it.',
                                   'btn1Label': 'Stencil patterns (PDF)', 'btn1Action': 'link', 'btn1Url': A + '/stencilpatterns.pdf',
                                   'btn2Label': 'Colour chart (PDF)', 'btn2Action': 'link', 'btn2Url': A + '/colour-chart.pdf'}))
        order.append('ctaBanner')
    if key == 'services_polished-concrete-canberra':
        apps.append(('featuredProjects', {'layout': 'cards', 'columns': 3, 'eyebrow': 'THREE LEVELS OF EXPOSURE', 'heading': 'Choose the look that suits your lifestyle', 'intro': '',
                                          'projects': [
                                              {'title': 'Minimal Polished Concrete', 'tag': 'Industrial warehouse feel', 'image': A + '/polished-minimal.jpg', 'link': '', 'location': 'New and existing slabs'},
                                              {'title': 'Rustic Polished Concrete', 'tag': 'Hit and miss feature', 'image': A + '/polished-rustic.jpg', 'link': '', 'location': 'New and existing slabs'},
                                              {'title': 'Full Stone Exposure', 'tag': 'All aggregate exposed', 'image': A + '/polished-full-exposure.jpg', 'link': '', 'location': 'Best on new slabs'}],
                                          'imageHeight': 240, 'strokeOn': False}))
        order.append('featuredProjects')
    if cats:
        apps.append(('premiumGallery', svc_gallery(gh, imgs_of(*cats, limit=12))))
        order.append('premiumGallery')
    apps.append(('quote', None)); order.append('quote')
    title = CONTENT[key]['title'].replace(' - Down Right Concreting Canberra', '') + ' Canberra'
    title = title.replace('Canberra Canberra', 'Canberra')
    meta = (bl[0]['text'] if bl[0]['t'] == 'p' else bl[1]['text'])
    meta = re.sub(r'\s+', ' ', meta)
    meta = meta if len(meta) <= 158 else meta[:155].rsplit(' ', 1)[0] + '…'
    page(slug, title, meta, h1, body, apps, order, A + '/' + image)

# Services overview
sv = blocks('services')
sv_md = []
for b in sv:
    if b['t'] == 'h1':
        continue
    if b['t'] in ('h2', 'h3'):
        sv_md.append('## ' + b['text'])
    elif b['t'] == 'p' and b['text'].strip():
        sv_md.append(b['text'])
page('services', 'Concreting Services Canberra', 'Residential, commercial, polished, stencil pattern, coloured, exposed aggregate and plain grey concrete, plus excavation — Down Right Concreting, Canberra.',
     'Our Concreting Services', 'Here are the services we provide. Choose one below to read more.',
     [('services', {'mode': 'photo', 'photoCols': '3', 'photoClamp': '0', 'photoHeadSplit': False, 'eyebrow': '', 'heading': '', 'intro': ''}), ('quote', None)], ['__lpArticle', 'services', 'quote'])
# keep the old overview copy as a long-form section below the cards
PAGES[-1]['pageApps'].insert(1, {'key': 'seoText', 'mode': 'unique', 'homeCopied': True})
PAGES[-1]['pageSections']['seoText'] = {'on': True, '_own': True, 'eyebrow': 'IN DETAIL', 'h1': '', 'intro': '', 'h2': 'Services we provide',
                                        'content': '\n\n'.join(sv_md), 'faq': [], 'image': '', 'imageSide': 'right', 'imageLayout': 'beside', 'textAlign': 'left'}
PAGES[-1]['pageLayoutOrder'] = ['__lpArticle', 'services', 'seoText', 'quote']

# About
ab = blocks('about-down-right-concrete')
page('about', 'About Down Right Concreting', 'Established in 2003, Down Right Concreting creates beautiful, durable concrete surfaces across Canberra. Fully insured, HIA member, licensed with NSW Fair Trading.',
     'About Down Right Concreting', md(ab), [
         ('certifications', {'eyebrow': 'RECOGNITION', 'heading': 'Licensed, insured and award-winning',
                             'items': [{'name': 'Most Popular 2016', 'body': 'Homeimprovement2day', 'image': A + '/award-2016.png'},
                                       {'name': 'Most Popular 2017', 'body': 'Homeimprovement2day', 'image': A + '/award-2017.png'},
                                       {'name': 'HIA member', 'body': 'Housing Industry Association', 'image': ''},
                                       {'name': 'Licensed & fully insured', 'body': 'NSW Fair Trading', 'image': ''}]}),
         ('trustBar', None), ('quote', None)], ['__lpArticle', 'certifications', 'trustBar', 'quote'], A + '/gallery/commercial/01.jpg')

# Gallery
page('gallery', 'Concreting Gallery', 'Photos of exposed aggregate, decorative stencil, plain & coloured, commercial and polished concrete by Down Right Concreting, Canberra.',
     'Our Concreting Gallery', 'Browse our recent work — tap any photo to see it larger.', [
         ('premiumGallery', dict(GALLERY_BASE, **{'structureMode': 'filtered', 'filterSource': 'categories', 'filtersEnabled': True, 'filterStyle': 'pills',
                                                  'showAllTab': True, 'showFilterCounts': True, 'layout': 'smart-mosaic', 'mosaicLocked': True, 'mosaicLayout': [],
                                                  'headerLayout': 'minimal', 'showTitle': False, 'showEyebrow': False, 'showIntro': False, 'showCount': True,
                                                  'loadMoreCount': 24, 'autoLoad': True, 'showCta': False, 'heading': 'Gallery', 'eyebrow': '', 'intro': '',
                                                  'categories': CATS, 'albums': [], 'images': [dict(i) for i in IMAGES]})),
         ('ctaBanner', None), ('quote', None)], ['__lpArticle', 'premiumGallery', 'ctaBanner', 'quote'])

# Testimonials
page('testimonials', 'Testimonials', 'What Canberra homeowners and builders say about Down Right Concreting.', 'Testimonials', '',
     [('reviews', None), ('quote', None)], ['__lpArticle', 'reviews', 'quote'])

# FAQs
page('faqs', "FAQ's", CONTENT['faqs']['meta'][:158].rsplit(' ', 1)[0] + '…', "FAQ's",
     'Concrete is very versatile for enhancing outdoor spaces — it offers unlimited flexibility in terms of shape, colour and texture. Here are answers to the questions our customers ask most.',
     [('faq', {'eyebrow': '', 'heading': '', 'columns': 1, 'items': FAQ}), ('area', None), ('quote', None)], ['__lpArticle', 'faq', 'area', 'quote'])

# Book a quote
page('book-a-quote', 'Book a Quote', 'Request a free, no-obligation concreting quote from Down Right Concreting, Canberra.', 'Book a Quote',
     'Make use of our online quotation form below, or give us a call on **' + PHONE_TXT + '** today to discuss your options.',
     [('quote', None)], ['__lpArticle', 'quote'])

# Contact
page('contact-us', 'Contact Us', 'Contact Down Right Concreting — call 0419 635 520 or send us a message. Servicing Canberra, Queanbeyan, Yass and surrounds.',
     'Contact Down Right Concreting', '**Phone:** ' + PHONE_TXT + '\n\n**Based in:** Royalla, just outside the ACT — servicing all of Canberra, the Queanbeyan region, Yass and surrounding areas.\n\n**Facebook:** facebook.com/downrightconcreting',
     [('quote', {'eyebrow': 'CONTACT FORM', 'heading': 'Send us a message.', 'sub': 'Fill out the form for more information relevant to your requirements, or call ' + PHONE_TXT + '.',
                 'formTitle': 'Contact Form', 'lblDetail': 'Message', 'detailPh': 'How can we help?', 'reqDetail': True, 'button': 'Send message',
                 'extraFields': [{'on': True, 'label': 'Subject', 'type': 'text', 'placeholder': 'Contact Form Enquiry', 'required': False}],
                 'points': [], 'successTitle': 'Thanks — message received.', 'successSub': "We'll get back to you shortly."}),
      ('area', None)], ['__lpArticle', 'quote', 'area'])

# ---------------------------------------------------------------- top level
CONFIG = {
    'name': 'Down Right Concreting', 'businessName': 'Down Right Concreting',
    'phone': PHONE, 'phoneText': PHONE_TXT, 'email': '',
    'trade': 'Concreting', 'region': 'Canberra', 'layout': 'classic', 'fontSet': 'montserrat',
    'theme': {'pipe': ORANGE, 'hivis': ORANGE, 'steel': INK, 'accent': ORANGE, 'safety': ORANGE, 'lightBg': '#F6F5F3', 'presetKey': '', 'presetName': 'Down Right orange'},
    'logo': {'mode': 'image', 'text': 'Down Right Concreting', 'imageUrl': A + '/logo.png', 'headerBg': '#FFFFFF',
             'headerStrokeBottomOn': True, 'headerStrokeBottomColor': '#ECECEC', 'headerStrokeBottomWidth': 1},
    'seoTitle': 'Concrete Contractors Canberra | Down Right Concreting',
    'seoDescription': 'Down Right Concreting in Canberra offers decorative and functional concrete services: driveways, paths, pergolas, house slabs, exposed aggregate, stencil and coloured concrete. Call 0419 635 520.',
    'seoTokens': S['seoTokens'],
    'services': services_cfg,
    'sections': S,
    'pages': PAGES,
    'sectionOrder': ['heroSlider', 'trustBar', 'services', 'textBox', 'premiumGallery', 'reviews', 'faq', 'ctaBanner', 'quote', 'area', 'navMenu', 'footer'],
    'colorOverrides': [],
    'previousUrls': ['https://www.downrightconcreting.com.au/'],
    'visitorAppearance': {'siteTheme': 'classic-light', 'colorScheme': 'brand', 'defaultContrast': 'standard', 'defaultTextSize': 'standard',
                          'allowColorSchemes': True, 'allowVisitorControls': False, 'reducedMotionSupport': True, 'showAccessibilityButton': True,
                          'accessibilityButtonPosition': 'bottom-right'},
    '_aiComposer': {'version': 1, 'note': 'Migrated by Claude from downrightconcreting.com.au (18 Oct 2026); copy verbatim from the old site.', 'gaps': [],
                    'createdAt': '2026-10-18T11:00:00.000Z'},
}
json.dump(CONFIG, sys.stdout, ensure_ascii=False)
