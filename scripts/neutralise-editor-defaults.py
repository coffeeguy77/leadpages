#!/usr/bin/env python3
"""
Remove the plumbing starter content (and invented ratings) from the editor's per-section defaults in
manage.html and api/manage.html — what a section is filled with when someone adds it to a site (Nov 2026).
Matches scripts/neutralise-trade-template.py. Every phrase must be found in each file or nothing is written.
"""
import sys

PAIRS = [
    ('{"icon": "star", "text": "4.9 from 212 reviews"}', '{"icon": "star", "text": "Locally owned"}'),
    ('{"n": "24/7", "title": "Real emergencies", "body": "Burst pipe at midnight? We answer the phone and get someone moving, day or night."}',
     '{"n": "02", "title": "Fast response", "body": "We answer the phone and get back to you quickly — no chasing us up."}'),
    ('{"n": "★", "title": "Properly licensed", "body": "Fully licensed ACT plumbers, fully insured. Licence details on every invoice."}',
     '{"n": "★", "title": "Properly qualified", "body": "Qualified, insured and proud of our work. Happy to show the details."}'),
    ('"body": "Canberra-based, Canberra-owned. We know the suburbs, the soil and the old pipework."',
     '"body": "Locally owned and run. We know the area and look after our neighbours."'),
    ('"text": "\\"Blocked sewer on a Sunday, total panic. {{businessName}} had someone out within the hour and jetted it clear. Fixed price, no fuss.\\""',
     '"text": "\\"Got back to us the same day, explained everything and did a great job. Fixed price, no fuss.\\""'),
    ('"text": "\\"Hot water died the morning we had guests. New system in and running by lunch. Couldn\'t fault them.\\""',
     '"text": "\\"On time, tidy and easy to deal with. Couldn\'t fault them.\\""'),
    ('"text": "\\"Used the drain camera to show me the tree root problem instead of just guessing. Honest and proper work.\\""',
     '"text": "\\"Honest advice instead of a sales pitch. Proper work at a fair price.\\""'),
    ('{"q": "Can you really come same-day?", "a": "For blocked drains, burst pipes and no-hot-water jobs we aim to be on site the same day, and we run a 24/7 line for emergencies across the ACT."}',
     '{"q": "How quickly can you help?", "a": "We get back to you quickly and book the work in at a time that suits you — often the same week."}'),
    ('{"q": "Are you licensed and insured?", "a": "Yes — fully licensed ACT plumbers and fully insured. Our licence number is on every invoice and we\'re happy to show it before any work begins."}',
     '{"q": "Are you insured?", "a": "Yes — fully insured, and happy to show the details before any work begins."}'),
    ('{"text": "Upfront fixed price, no call-out surprises"}', '{"text": "Clear, upfront pricing"}'),
    ('[{"text": "Blocked drain"}, {"text": "Burst or leaking pipe"}, {"text": "No hot water"}, {"text": "Hidden leak / high water bill"}, {"text": "General plumbing / other"}]',
     '[{"text": "A new job / quote"}, {"text": "A repair"}, {"text": "An installation"}, {"text": "Maintenance"}, {"text": "Something else"}]'),
    ('"task": "Hot water system replacement"', '"task": "Installation"'),
    ('"task": "Blocked drain cleared"', '"task": "Repair completed"'),
    ('"task": "Burst pipe repair"', '"task": "On-site repair"'),
    ('"detail": "Blocked drain specialist"', '"detail": "Lead technician"'),
    ('"detail": "Hot water expert"', '"detail": "Technician"'),
    ('{"on":true,"text":"Drain cleared in Belconnen","time":"2 hours ago"},{"on":true,"text":"Burst pipe repaired in Gungahlin","time":"Yesterday"},{"on":true,"text":"New hot water system installed","time":"3 days ago"},{"on":true,"text":"Emergency callout in Woden","time":"Last week"}',
     '{"on":true,"text":"Job completed in Belconnen","time":"2 hours ago"},{"on":true,"text":"Repair finished in Gungahlin","time":"Yesterday"},{"on":true,"text":"New installation in Weston","time":"3 days ago"},{"on":true,"text":"Same-day visit in Woden","time":"Last week"}'),
    ('"title":"Blocked drain cleared","location":"Belconnen, ACT","time":"2 hours ago","text":"Cleared a full blockage and camera-checked the line before leaving."',
     '"title":"Job completed","location":"Belconnen, ACT","time":"2 hours ago","text":"Finished on time and left the site spotless."'),
    ('"text":"Fast, fair and tidy \\u2014 sorted our burst pipe the same day we called."', '"text":"Fast, fair and tidy \\u2014 sorted the same day we called."'),
    ('"title":"Watch us clear a tree-root blockage"', '"title":"Watch us on the job"'),
    ('"title":"Hot water system replaced"', '"title":"New installation finished"'),
    ('{"on":true,"title":"Blocked Drain","location":"Mitchell, ACT","time":"4 hours ago","result":"Cleared and camera-checked the line.","image":""},{"on":true,"title":"Hot Water System","location":"Woden, ACT","time":"Yesterday","result":"Old unit out, new one installed.","image":""}',
     '{"on":true,"title":"Repair","location":"Mitchell, ACT","time":"4 hours ago","result":"Fixed first visit and tested before we left.","image":""},{"on":true,"title":"Installation","location":"Woden, ACT","time":"Yesterday","result":"Old one out, new one installed.","image":""}'),
    ('"title":"How we clear a blocked drain"', '"title":"How we work"'),
    ('"title":"Hot water swap in under an hour"', '"title":"A day on the job"'),
    ('"text":"Called at 8am. Drain fixed by 10am. Couldn\\u2019t fault them."', '"text":"Called in the morning, sorted by lunch. Couldn\\u2019t fault them."'),
    ('"message": "Mate that’s sorted now, water pressure’s perfect. Thanks heaps — will be calling you again!"', '"message": "Mate that’s sorted now, all working perfectly. Thanks heaps — will be calling you again!"'),
    ('"message": "Quick response on an emergency call-out late at night. Absolute lifesavers."', '"message": "Quick response when we needed it most. Absolute lifesavers."'),
    ('{"on":true,"icon":"timer","title":"24/7 Emergency","text":"Call any hour, day or night \\u2014 someone answers."}', '{"on":true,"icon":"timer","title":"Quick replies","text":"Call or message and we get back to you fast."}'),
    ('{"on":true,"text":"No callout fee"}', '{"on":true,"text":"Free quotes"}'),
    # invented ratings — leave an obvious slot for the real figure instead
    ('{"on":true,"value":"4.9\\u2605","label":"Google Rating"}', '{"on":true,"value":"\\u2605","label":"Add your Google rating"}'),
    ('{"on":true,"value":"4.9","label":"Google Rating"}', '{"on":true,"value":"\\u2605","label":"Add your Google rating"}'),
]

for path in ["manage.html", "api/manage.html"]:
    s = open(path, encoding="utf-8").read()
    for old, new in PAIRS:
        if old not in s:
            sys.exit(f"{path}: not found: {old[:100]!r}")
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)
    print(path, "updated")
