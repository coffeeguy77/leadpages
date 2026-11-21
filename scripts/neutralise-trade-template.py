#!/usr/bin/env python3
"""
Remove the plumbing demo copy from trade.template.json (Nov 2026).

The trade theme is used by every kind of business, but its built-in defaults (what shows wherever a site hasn't
filled a field in) were written for a plumber: plumbing services, reviews, quote-form options, FAQs, a
"Plumber" schema.org type, and a made-up 4.9 / 212-review rating. This swaps all of it for neutral copy that
reads correctly for any business, and replaces the structured data with plain LocalBusiness details only.

Sites' own content (sites.config) is untouched — applyCfg still paints it over these defaults as before.
Every old phrase must be found (the script stops otherwise), so it can't half-apply. Run from the repo root:
  python3 scripts/neutralise-trade-template.py
"""
import json, re, sys

PATH = "trade.template.json"
data = json.load(open(PATH, encoding="utf-8"))
t = data["html"]

def swap(old, new, regex=False):
    global t
    n = len(re.findall(old, t)) if regex else t.count(old)
    if n == 0:
        sys.exit(f"Not found: {old[:90]!r}")
    t = re.sub(old, new, t) if regex else t.replace(old, new)

# ---- Structured data: plain LocalBusiness (no invented type, rating, hours or area); no plumbing FAQ schema
swap(r'<!-- Structured data — Plumber \(drives the local pack\) \+ FAQ -->\s*<script type="application/ld\+json">[\s\S]*?</script>\s*<script type="application/ld\+json">\s*\{\s*"@context":"https://schema.org","@type":"FAQPage"[\s\S]*?</script>',
     '<!-- Structured data — business details (sites add more via SEO Command → seoJsonLd) -->\n'
     '<script type="application/ld+json">\n{\n  "@context":"https://schema.org",\n  "@type":"LocalBusiness",\n'
     '  "name":"{{businessName}}",\n  "image":"https://{{domain}}/og.jpg",\n  "url":"https://{{domain}}/",\n  "telephone":"{{phone}}"\n}\n</script>', regex=True)

# ---- Hero badges
swap('<span class="b-ic">★</span>4.9 from 212 reviews', '<span class="b-ic">★</span>Locally owned')

# ---- Services
swap('<span class="eyebrow">What we fix</span><h2>One call sorts the lot.</h2><p>From a slow kitchen sink to a flooded laundry at 2am — we handle the everyday and the emergencies.</p>',
     '<span class="eyebrow">What we do</span><h2>Here\'s how we can help.</h2><p>From small jobs to big projects — we look after the lot, properly.</p>')
for old_ic, old_h, old_p, ic, h, p in [
    ("🚿", "Blocked Drains", r"High-pressure water jetting and electric eel to clear blockages fast — kitchen, bathroom, sewer and stormwater.",
     "💬", "Quotes &amp; advice", "Tell us what you need and we'll give you clear advice and a fixed price before any work starts."),
    ("💧", "Burst &amp; Leaking Pipes", r"Burst mains, slab leaks and dripping joints found and repaired before they wreck your floors and walls.",
     "🔧", "Repairs", "Fast, tidy repairs done properly the first time — with the right gear on hand."),
    ("🔥", "Hot Water Systems", r"No hot water? Repairs and same-day replacement on gas, electric and heat-pump systems.",
     "🧰", "Installations", "New installs and upgrades, planned around you and finished to a high standard."),
    ("📹", "CCTV Drain Camera", r"We send a camera down the line to find the real problem — tree roots, cracks, collapses — and show you the footage.",
     "🗓️", "Maintenance", "Regular servicing that keeps everything running and stops small problems becoming big ones."),
    ("🔎", "Leak Detection", r"Hidden leak driving up your water bill? We pinpoint it without tearing the place apart.",
     "🔍", "Inspections", "A proper look before anything is done, with photos and a straight answer."),
    ("🛠️", "General Plumbing", r"Taps, toilets, gas fitting, renovations and the jobs you've been putting off. Done properly, first time.",
     "✅", "Everything else", "The smaller jobs you've been putting off. Done properly, first time."),
]:
    swap(f'<div class="ic">{old_ic}</div><h3>{old_h}</h3><p>{old_p}</p>', f'<div class="ic">{ic}</div><h3>{h}</h3><p>{p}</p>')

# ---- Why us
swap("No call-out games. No surprise bills.", "Clear prices. No surprises.")
swap("Real emergencies", "Fast response")
swap("Burst pipe at midnight? We answer the phone and get someone moving, day or night.", "We answer the phone and get back to you quickly — no chasing us up.")
swap("Properly licensed", "Properly qualified")
swap("Fully licensed ACT plumbers, fully insured. Licence details on every invoice.", "Qualified, insured and proud of our work. Happy to show the details.")
swap("Canberra-based, Canberra-owned. We know the suburbs, the soil and the old pipework.", "Locally owned and run. We know the area and look after our neighbours.")
swap(r'<div class="n">24/7</div>', '<div class="n">02</div>') if '<div class="n">24/7</div>' in t else None

# ---- Reviews
swap("212 five-star reviews and counting.", "What our customers say.")
swap('"Blocked sewer on a Sunday, total panic. {{businessName}} had someone out within the hour and jetted it clear. Fixed price, no fuss."',
     '"Got back to us the same day, explained everything and did a great job. Fixed price, no fuss."')
swap(r'"Hot water died the morning we had guests\. New system in and running by lunch\. Couldn(\'|&#39;|’)t fault them\."',
     '"On time, tidy and easy to deal with. Couldn\\1t fault them."', regex=True)
swap('"Used the drain camera to show me the tree root problem instead of just guessing. Honest and proper work."',
     '"Honest advice instead of a sales pitch. Proper work at a fair price."')

# ---- Quote form
swap("Tell us the problem.", "Tell us what you need.")
swap("Two minutes now saves you a flooded weekend. Send the details and a plumber calls you — usually within the hour during the day.",
     "Send the details and we'll get back to you quickly with a clear price.")
swap("Upfront fixed price, no call-out surprises", "Clear, upfront pricing")
swap("What's the problem?", "What do you need?")
swap(r"<option>Blocked drain</option><option>Burst or leaking pipe</option><option>No hot water</option>\s*<option>Hidden leak / high water bill</option><option>General plumbing / other</option>",
     "<option>A new job / quote</option><option>A repair</option><option>An installation</option>\n              <option>Maintenance</option><option>Something else</option>", regex=True)
swap("Genuine emergency? Don't wait —", "Rather talk? Don't wait —") if "Genuine emergency? Don't wait —" in t else None
swap("Genuine emergency? Don’t wait —", "Rather talk? Don’t wait —")
swap("If it's an emergency, please call {{phoneText}} so we can get moving now.", "If it's urgent, please call {{phoneText}}.")

# ---- FAQ
swap("Do you charge a call-out fee?", "How does pricing work?")
swap("We quote a fixed price for the job before we start, so you're never surprised. For genuine emergencies we'll always be straight with you about costs over the phone first.",
     "We give you a clear price before any work starts, so you're never surprised. If anything changes, we talk to you first.")
swap("Can you really come same-day?", "How quickly can you help?")
swap("For blocked drains, burst pipes and no-hot-water jobs we aim to be on site the same day, and we run a 24/7 line for emergencies across the ACT.",
     "We get back to you quickly and book the work in at a time that suits you — often the same week.")
swap("Are you licensed and insured?", "Are you insured?")
swap("Yes — fully licensed ACT plumbers and fully insured. Our licence number is on every invoice and we're happy to show it before any work begins.",
     "Yes — fully insured, and happy to show the details before any work begins.")

# ---- Split hero (static + script default)
swap("Canberra&#39;s most active drain cleaning team", "Busy, local and on the job")
swap("\"Canberra's most active drain cleaning team\"", "\"Busy, local and on the job\"")

# ---- Script demo data shown when an app is switched on but not filled in yet
for old, new in [
    ("{icon:'clock',title:'24/7 Emergency',text:'Call any hour, day or night \\u2014 someone answers.'}", "{icon:'clock',title:'Quick replies',text:'Call or message and we get back to you fast.'}"),
    ("{text:'No callout fee'}", "{text:'Free quotes'}"),
    ("'Called at 8am. Drain fixed by 10am. Couldn\\u2019t fault them.'", "'Called in the morning, sorted by lunch. Couldn\\u2019t fault them.'"),
    ("title:'Blocked drain cleared',location:'Belconnen, ACT',time:'2 hours ago',text:'Cleared a full blockage and camera-checked the line before leaving.'", "title:'Job completed',location:'Belconnen, ACT',time:'2 hours ago',text:'Finished on time and left the site spotless.'"),
    ("'Fast, fair and tidy \\u2014 sorted our burst pipe the same day we called.'", "'Fast, fair and tidy \\u2014 sorted the same day we called.'"),
    ("'Hot water system replaced'", "'New installation finished'"),
    ("'Drain cleared in Belconnen'", "'Job completed in Belconnen'"),
    ("'Burst pipe repaired in Gungahlin'", "'Repair finished in Gungahlin'"),
    ("'New hot water system installed'", "'New installation in Weston'"),
    ("'Emergency callout in Woden'", "'Same-day visit in Woden'"),
    ("'Blocked drain specialist'", "'Lead technician'"),
    ("'Hot water expert'", "'Technician'"),
    ("{title:'Blocked Drain',location:'Mitchell, ACT',time:'4 hours ago',result:'Cleared and camera-checked the line.'}", "{title:'Repair',location:'Mitchell, ACT',time:'4 hours ago',result:'Fixed first visit and tested before we left.'}"),
    ("{title:'Hot Water System',location:'Woden, ACT',time:'Yesterday',result:'Old unit out, new one installed.'}", "{title:'Installation',location:'Woden, ACT',time:'Yesterday',result:'Old one out, new one installed.'}"),
    ("'How we clear a blocked drain'", "'How we work'"),
    ("'Hot water swap in under an hour'", "'A day on the job'"),
    ("task:'Hot water system replacement'", "task:'Installation'"),
    ("task:'Blocked drain cleared'", "task:'Repair completed'"),
    ("task:'Burst pipe repair'", "task:'On-site repair'"),
]:
    swap(old, new)

# ---- Nothing plumbing-specific may remain in what visitors or Google read (the starter-service filter keeps
# its old plumbing names on purpose: it hides those legacy defaults if a site's config still holds them)
body = re.sub(r"var __plumb=[^;]*;\s*var __starter=\{[^}]*\};", "", t)
left = re.findall(r"[^<>'\"]{0,40}(?:(?<!__)plumb|blocked drain|burst pipe|hot water|sewer|drain clean|drain camera|leak detection|jetting|212 (?:five-star|reviews)|4\.9 from)[^<>'\"]{0,40}", body, re.I)
if left:
    sys.exit("Still plumbing-specific:\n  " + "\n  ".join(sorted(set(x.strip() for x in left))))

data["html"] = t
json.dump(data, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("trade.template.json neutralised.")
