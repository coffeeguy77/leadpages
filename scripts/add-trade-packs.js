#!/usr/bin/env node
/**
 * Add 10 popular missing trades + 10 common small-business packs to manage.html,
 * lp-trade-picker.js, and TRADE_COLOUR_PRESETS.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function pack(def) {
  const b = def.business || 'us';
  const loc = def.location || 'your area';
  return {
    label: def.label,
    tradeType: def.tradeType,
    theme: def.theme,
    services: def.services,
    sections: {
      header: { cta: def.headerCta || `Speak to ${def.tradeType.toLowerCase()}`, button: 'Call now' },
      emerg: { text: def.emerg },
      hero: {
        eyebrow: def.heroEyebrow,
        title: def.heroTitle,
        titleHl: def.heroHl,
        sub: def.heroSub,
        badges: def.badges || [
          { icon: '✓', text: 'Licensed & insured' },
          { icon: '★', text: '5-star rated' },
          { icon: '$', text: 'Clear pricing' },
          { icon: '⚡', text: 'Fast response' },
        ],
      },
      services: {
        eyebrow: 'What we do',
        heading: def.servicesHeading,
        intro: def.servicesIntro,
      },
      why: {
        eyebrow: 'Why {{businessName}}',
        heading: def.whyHeading,
        items: def.whyItems || [
          { n: '01', title: 'Local crew', body: `We know ${loc} and turn up when we say we will.` },
          { n: '★', title: 'Quality work', body: 'Skilled, tidy and proud of every job we finish.' },
          { n: '✓', title: 'Clear quotes', body: 'Upfront pricing before we start — no surprises on the bill.' },
          { n: '⌂', title: 'Trusted locally', body: 'Neighbours recommend us because we make it easy.' },
        ],
      },
      area: {
        eyebrow: 'Where we work',
        heading: def.areaHeading || 'Across the local area',
        intro: def.areaIntro || 'If you are nearby, we will come and quote — free and no obligation.',
        suburbs: def.suburbs || [
          'North', 'South', 'East', 'West', 'Central',
          'Inner suburbs', 'Outer suburbs', 'Nearby towns', 'Coastal', 'Hills',
        ],
      },
      reviews: {
        eyebrow: 'From the neighbours',
        heading: def.reviewsHeading,
        items: def.reviews || [
          { who: 'Sarah M.', text: `"{{businessName}} was professional, on time and easy to deal with."` },
          { who: 'James T.', text: '"Clear quote, great result — would recommend."' },
          { who: 'Priya K.', text: '"Exactly what we needed. Friendly team and tidy finish."' },
        ],
      },
      quote: {
        eyebrow: 'Fast quote',
        sub: def.quoteSub,
        button: 'Send & get my free quote',
        formTitle: 'Get my quote',
        lblName: 'Name',
        lblPhone: 'Phone',
        lblSuburb: 'Suburb',
        lblDetail: 'Anything else? (optional)',
        successTitle: 'Got it — sit tight. ✓',
        heading: def.quoteHeading,
        lblJob: def.quoteJobLabel || 'What do you need?',
        points: def.quotePoints || [
          { text: 'Free, no-obligation quotes' },
          { text: 'Clear pricing upfront' },
          { text: 'Local & fully insured' },
        ],
        jobOptions: def.jobOptions,
      },
      faq: {
        eyebrow: 'Good to know',
        heading: 'Quick answers.',
        items: def.faq,
      },
      footer: {
        blurb: def.footerBlurb,
        legal: '{{businessName}} — ABN 00 000 000 000. Fully insured. © 2026 {{businessName}}.',
        services: def.footerServices,
      },
    },
  };
}

const NEW_TRADES = {
  'duct-cleaning': pack({
    label: 'Duct Cleaning',
    tradeType: 'Duct Cleaning Specialist',
    theme: { pipe: '#0284C7', hivis: '#22C55E', steel: '#0F172A', safety: '#BAE6FD' },
    emerg: '⚠ Dusty vents or musty air? Cleaner ducts mean healthier air.',
    heroEyebrow: 'Duct cleaning · HVAC hygiene',
    heroTitle: 'Breathe easier',
    heroHl: 'with clean ducts.',
    heroSub: 'Professional duct and vent cleaning for homes and offices — less dust, better airflow and healthier indoor air.',
    servicesHeading: 'Cleaner air, better airflow.',
    servicesIntro: 'From return-air vents to full duct runs — we remove built-up dust, debris and allergens.',
    whyHeading: 'Healthier air at home.',
    reviewsHeading: 'Fresh air, happy homes.',
    quoteSub: 'Tell us about your property and we will call with a fixed quote.',
    quoteHeading: 'Book a duct clean — we will call you back.',
    jobOptions: [
      { text: 'Whole-home duct clean' },
      { text: 'Return-air vents only' },
      { text: 'Commercial / office' },
      { text: 'After renovation dust' },
      { text: 'Annual maintenance' },
    ],
    faq: [
      { q: 'How often should ducts be cleaned?', a: 'Every 3–5 years for most homes, or sooner if you have pets, allergies or recent building work.' },
      { q: 'Will it make a mess?', a: 'We use professional extraction gear and protect your floors — the dust comes out of the ducts, not into your rooms.' },
    ],
    footerBlurb: 'Professional duct cleaning for healthier indoor air and better HVAC performance.',
    footerServices: [
      { label: 'Home ducts', href: '#quote' },
      { label: 'Commercial', href: '#quote' },
      { label: 'Vent cleaning', href: '#quote' },
      { label: 'Maintenance', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🌀', title: 'Full Duct Clean', body: 'Complete supply and return ductwork cleaned with professional extraction.' },
      { on: true, icon: '💨', title: 'Vent & Grill Clean', body: 'Ceiling vents, floor registers and grilles degreased and sanitised.' },
      { on: true, icon: '🏢', title: 'Commercial HVAC', body: 'Office, retail and strata duct cleaning with minimal disruption.' },
      { on: true, icon: '🏠', title: 'Residential', body: 'Family homes, townhouses and apartments — less dust and allergens.' },
      { on: true, icon: '🔧', title: 'Post-Reno Dust', body: 'Building dust cleared from ducts after renovations or new carpet.' },
      { on: true, icon: '📅', title: 'Maintenance Plans', body: 'Scheduled cleans to keep airflow strong and filters lasting longer.' },
    ],
  }),

  'mobile-mechanic': pack({
    label: 'Mobile Mechanic',
    tradeType: 'Mobile Mechanic',
    theme: { pipe: '#DC2626', hivis: '#FACC15', steel: '#111827', safety: '#FDE047' },
    emerg: '⚠ Car won\'t start? We come to you — home, work or roadside.',
    heroEyebrow: 'Mobile mechanic · We come to you',
    heroTitle: 'Car trouble?',
    heroHl: 'Fixed at your door.',
    heroSub: 'Logbook services, brakes, batteries and diagnostics at your home or workplace — no workshop wait.',
    servicesHeading: 'Servicing where you are.',
    servicesIntro: 'Qualified mobile mechanics with fully equipped vans for most makes and models.',
    whyHeading: 'Workshop quality. Your driveway.',
    reviewsHeading: 'Sorted without the tow truck.',
    quoteSub: 'Tell us the car and issue — we will call with availability and price.',
    quoteHeading: 'Describe the problem — we will call back.',
    jobOptions: [
      { text: 'Logbook service' },
      { text: 'Won\'t start / battery' },
      { text: 'Brakes & safety' },
      { text: 'Pre-purchase inspection' },
      { text: 'Fleet / workplace' },
    ],
    faq: [
      { q: 'Do you service all makes?', a: 'Most popular passenger vehicles and light commercials — tell us your make, model and year when you enquire.' },
      { q: 'What if you can\'t fix it on-site?', a: 'We diagnose first and only recommend a workshop if specialist equipment is genuinely needed.' },
    ],
    footerBlurb: 'Mobile mechanic services at your home or workplace — servicing, repairs and diagnostics.',
    footerServices: [
      { label: 'Logbook service', href: '#quote' },
      { label: 'Repairs', href: '#quote' },
      { label: 'Diagnostics', href: '#quote' },
      { label: 'Fleet', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🔧', title: 'Logbook Service', body: 'Manufacturer-scheduled services with genuine or quality parts and stamps.' },
      { on: true, icon: '🔋', title: 'Batteries & Starts', body: 'Battery tests, replacements and no-start diagnostics at your location.' },
      { on: true, icon: '🛑', title: 'Brakes & Safety', body: 'Pads, rotors, fluid and safety checks without losing your car for a day.' },
      { on: true, icon: '🔍', title: 'Diagnostics', body: 'Check-engine lights, warning codes and honest advice on what matters.' },
      { on: true, icon: '📋', title: 'Pre-Purchase Checks', body: 'Independent inspections before you buy — peace of mind on the driveway.' },
      { on: true, icon: '🚐', title: 'Fleet & Workplace', body: 'Regular servicing for small fleets at your depot or staff car park.' },
    ],
  }),

  'chimney-sweep': pack({
    label: 'Chimney Sweep',
    tradeType: 'Chimney Sweep',
    theme: { pipe: '#78350F', hivis: '#F97316', steel: '#1C1917', safety: '#FDE68A' },
    emerg: '⚠ Wood-fire season? Book a sweep before you light the first fire.',
    heroEyebrow: 'Chimney sweep · Wood fires',
    heroTitle: 'Safe fires',
    heroHl: 'start with a clean flue.',
    heroSub: 'Professional chimney and flue cleaning for open fireplaces and slow-combustion heaters — reduce creosote and fire risk.',
    servicesHeading: 'Clean flues. Safer fires.',
    servicesIntro: 'Sweeping, inspection and basic flue maintenance for homes with wood heating.',
    whyHeading: 'Experienced. Tidy. Certified.',
    reviewsHeading: 'Warmer winters, safer fires.',
    quoteSub: 'Tell us your heater type and suburb — we will book you in.',
    quoteHeading: 'Book your chimney sweep — we will call back.',
    jobOptions: [
      { text: 'Open fireplace' },
      { text: 'Slow-combustion heater' },
      { text: 'Flue inspection' },
      { text: 'Creosote removal' },
      { text: 'Annual maintenance' },
    ],
    faq: [
      { q: 'How often should I sweep?', a: 'At least once a year for regular use — more often if you burn pine or damp wood.' },
      { q: 'Do you make a mess?', a: 'We use drop sheets and HEPA vacuums — your hearth and room stay clean.' },
    ],
    footerBlurb: 'Chimney and flue cleaning for safer, more efficient wood fires.',
    footerServices: [
      { label: 'Fireplace sweep', href: '#quote' },
      { label: 'Flue clean', href: '#quote' },
      { label: 'Inspection', href: '#quote' },
      { label: 'Maintenance', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🔥', title: 'Fireplace Sweep', body: 'Soot and creosote removed from open fireplaces and hearths.' },
      { on: true, icon: '🏠', title: 'Slow-Combustion', body: 'Flues cleaned on wood heaters and inbuilt fireboxes.' },
      { on: true, icon: '🔍', title: 'Flue Inspection', body: 'Camera or visual checks for cracks, blockages and bird nests.' },
      { on: true, icon: '🪵', title: 'Creosote Removal', body: 'Heavy build-up cleared to reduce chimney fire risk.' },
      { on: true, icon: '🛡️', title: 'Bird Nest Clear', body: 'Blocked flues cleared and cowls checked for safe drafting.' },
      { on: true, icon: '📅', title: 'Annual Service', body: 'Reminder-friendly yearly sweeps before winter.' },
    ],
  }),

  'bore-drilling': pack({
    label: 'Bore Drilling',
    tradeType: 'Bore Driller',
    theme: { pipe: '#0369A1', hivis: '#22C55E', steel: '#0F172A', safety: '#BAE6FD' },
    emerg: '⚠ Low tank levels or dry paddock? Talk to us about a new bore.',
    heroEyebrow: 'Bore drilling · Water bores',
    heroTitle: 'Reliable water',
    heroHl: 'from your own bore.',
    heroSub: 'Domestic, rural and irrigation bores — drilling, pumps and flow testing by experienced drillers.',
    servicesHeading: 'Water where you need it.',
    servicesIntro: 'From site assessment to pump install — one team for your groundwater solution.',
    whyHeading: 'Licensed drillers. Local knowledge.',
    reviewsHeading: 'Water problems solved.',
    quoteSub: 'Tell us the property and intended use — we will call to discuss options.',
    quoteHeading: 'Need a bore? We will call you back.',
    jobOptions: [
      { text: 'New domestic bore' },
      { text: 'Farm / irrigation' },
      { text: 'Pump replacement' },
      { text: 'Bore rehabilitation' },
      { text: 'Flow test' },
    ],
    faq: [
      { q: 'Do I need a permit?', a: 'Most states require licensing and permits — we guide you through local requirements.' },
      { q: 'How deep will it need to be?', a: 'Depends on geology and aquifers on your block — we assess before quoting.' },
    ],
    footerBlurb: 'Bore drilling, pumps and water solutions for homes, farms and irrigation.',
    footerServices: [
      { label: 'New bores', href: '#quote' },
      { label: 'Pumps', href: '#quote' },
      { label: 'Irrigation', href: '#quote' },
      { label: 'Testing', href: '#quote' },
    ],
    services: [
      { on: true, icon: '💧', title: 'New Bore Drilling', body: 'Domestic and stock-water bores drilled and cased to spec.' },
      { on: true, icon: '🌾', title: 'Irrigation Bores', body: 'Higher-flow bores for crops, pastures and horticulture.' },
      { on: true, icon: '⚙️', title: 'Pump Supply & Install', body: 'Submersible and surface pumps matched to your flow and pressure needs.' },
      { on: true, icon: '📊', title: 'Flow & Yield Tests', body: 'Know your litres per minute before you invest in storage.' },
      { on: true, icon: '🔧', title: 'Bore Rehabilitation', body: 'Revive old or silting bores instead of drilling anew.' },
      { on: true, icon: '🏡', title: 'Rural & Lifestyle', body: 'Tank top-up and garden irrigation for acreage blocks.' },
    ],
  }),

  'mobile-tyres': pack({
    label: 'Mobile Tyres',
    tradeType: 'Mobile Tyre Fitter',
    theme: { pipe: '#111827', hivis: '#FACC15', steel: '#030712', safety: '#FDE047' },
    emerg: '⚠ Flat tyre? We come to you — roadside, home or work.',
    heroEyebrow: 'Mobile tyres · We come to you',
    heroTitle: 'New tyres',
    heroHl: 'fitted where you are.',
    heroSub: 'Mobile tyre fitting, puncture repairs and replacements at your home, workplace or roadside.',
    servicesHeading: 'Tyres fitted on-site.',
    servicesIntro: 'Quality brands, balanced and fitted without the workshop wait.',
    whyHeading: 'Fast. Fair. Mobile.',
    reviewsHeading: 'Back on the road quickly.',
    quoteSub: 'Tell us tyre size or rego — we will call with price and ETA.',
    quoteHeading: 'Need tyres? We will call you back.',
    jobOptions: [
      { text: 'Tyre replacement' },
      { text: 'Puncture repair' },
      { text: 'Fleet / workplace' },
      { text: 'Wheel balance' },
      { text: 'Emergency roadside' },
    ],
    faq: [
      { q: 'Which brands do you carry?', a: 'A range of budget to premium tyres — we recommend options for your driving and budget.' },
      { q: 'Can you fit at my workplace?', a: 'Yes — car park fits are popular for busy weekdays.' },
    ],
    footerBlurb: 'Mobile tyre fitting and puncture repairs at your location.',
    footerServices: [
      { label: 'New tyres', href: '#quote' },
      { label: 'Punctures', href: '#quote' },
      { label: 'Fleet', href: '#quote' },
      { label: 'Roadside', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🛞', title: 'Tyre Replacement', body: 'New tyres supplied and fitted at your home, work or roadside.' },
      { on: true, icon: '🔧', title: 'Puncture Repairs', body: 'Safe repairs where appropriate — or honest advice to replace.' },
      { on: true, icon: '⚖️', title: 'Balance & Fit', body: 'Wheels balanced for a smooth ride before you drive away.' },
      { on: true, icon: '🚗', title: 'All Common Sizes', body: 'Passenger, SUV and light commercial tyres in stock or next-day.' },
      { on: true, icon: '🏢', title: 'Fleet Fitting', body: 'Multiple vehicles done in your staff car park.' },
      { on: true, icon: '🆘', title: 'Emergency Call-out', body: 'Stranded with a flat? We aim to get you moving fast.' },
    ],
  }),

  'home-automation': pack({
    label: 'Smart Home',
    tradeType: 'Smart Home Installer',
    theme: { pipe: '#7C3AED', hivis: '#22C55E', steel: '#111827', safety: '#C4B5FD' },
    emerg: '⚠ Renovating or building? Wire in smart home while walls are open.',
    heroEyebrow: 'Smart home · Home automation',
    heroTitle: 'Your home',
    heroHl: 'smarter & simpler.',
    heroSub: 'Lighting, climate, security and voice control installed and programmed — one system, easy to use.',
    servicesHeading: 'Automation that just works.',
    servicesIntro: 'Design, install and support for reliable smart home systems.',
    whyHeading: 'Clean installs. Plain-English support.',
    reviewsHeading: 'Homes that feel effortless.',
    quoteSub: 'Tell us what you want to control — we will call to plan a site visit.',
    quoteHeading: 'Plan your smart home — we will call back.',
    jobOptions: [
      { text: 'Lighting control' },
      { text: 'Security & cameras' },
      { text: 'Climate / AC' },
      { text: 'New build pre-wire' },
      { text: 'Upgrade existing' },
    ],
    faq: [
      { q: 'Which systems do you use?', a: 'We work with leading ecosystems and recommend what fits your home and budget — not one-size-fits-all.' },
      { q: 'Can you use what I already own?', a: 'Often yes — we audit existing gear and integrate where it makes sense.' },
    ],
    footerBlurb: 'Smart home design, installation and support for lighting, climate and security.',
    footerServices: [
      { label: 'Lighting', href: '#quote' },
      { label: 'Security', href: '#quote' },
      { label: 'Climate', href: '#quote' },
      { label: 'Support', href: '#quote' },
    ],
    services: [
      { on: true, icon: '💡', title: 'Smart Lighting', body: 'Scenes, dimming and schedules that work from app or voice.' },
      { on: true, icon: '🌡️', title: 'Climate Control', body: 'AC and heating integrated for comfort and efficiency.' },
      { on: true, icon: '🔒', title: 'Security & Locks', body: 'Cameras, alarms and smart locks with remote access.' },
      { on: true, icon: '🏗️', title: 'New Build Pre-Wire', body: 'Structured cabling and racks planned before plaster.' },
      { on: true, icon: '📱', title: 'Voice & App Control', body: 'One dashboard — not ten different apps.' },
      { on: true, icon: '🛠️', title: 'Support & Upgrades', body: 'Ongoing tweaks when you add rooms or change routines.' },
    ],
  }),

  'building-inspection': pack({
    label: 'Building Inspection',
    tradeType: 'Building Inspector',
    theme: { pipe: '#475569', hivis: '#F97316', steel: '#111827', safety: '#CBD5E1' },
    emerg: '⚠ Buying a property? Book inspection before you sign.',
    heroEyebrow: 'Building inspection · Pre-purchase',
    heroTitle: 'Buy with',
    heroHl: 'your eyes open.',
    heroSub: 'Independent building and pest inspections with clear reports — know what you are buying before you commit.',
    servicesHeading: 'Clear reports. No spin.',
    servicesIntro: 'Licensed inspectors for homes, units and small commercial properties.',
    whyHeading: 'Independent. Thorough. On time.',
    reviewsHeading: 'Confidence before settlement.',
    quoteSub: 'Send the address and settlement date — we will call to book.',
    quoteHeading: 'Book an inspection — we will call back.',
    jobOptions: [
      { text: 'Pre-purchase building' },
      { text: 'Pest inspection' },
      { text: 'Combined building & pest' },
      { text: 'Pre-auction' },
      { text: 'Vendor report' },
    ],
    faq: [
      { q: 'How fast is the report?', a: 'Same-day or next-morning reports are standard — ask about urgent settlement dates.' },
      { q: 'Do you inspect apartments?', a: 'Yes — including common property issues we can flag for your solicitor.' },
    ],
    footerBlurb: 'Independent building and pest inspections with plain-English reports.',
    footerServices: [
      { label: 'Building', href: '#quote' },
      { label: 'Pest', href: '#quote' },
      { label: 'Combined', href: '#quote' },
      { label: 'Vendor', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🏠', title: 'Pre-Purchase Building', body: 'Structural, roof, wet areas and safety issues documented clearly.' },
      { on: true, icon: '🐜', title: 'Pest Inspection', body: 'Termites, borers and conducive conditions called out early.' },
      { on: true, icon: '📋', title: 'Combined Reports', body: 'Building and pest in one visit — popular with buyers and agents.' },
      { on: true, icon: '⏱️', title: 'Urgent Settlements', body: 'Short-notice bookings when auction or finance deadlines loom.' },
      { on: true, icon: '📄', title: 'Vendor Reports', body: 'Sellers who want transparency before listing.' },
      { on: true, icon: '🔍', title: 'Defect Advice', body: 'Plain talk on what is serious vs cosmetic.' },
    ],
  }),

  'gutter-guards': pack({
    label: 'Gutter Guards',
    tradeType: 'Gutter Guard Installer',
    theme: { pipe: '#475569', hivis: '#22C55E', steel: '#111827', safety: '#A3E635' },
    emerg: '⚠ Tired of cleaning gutters every season? Guards cut the ladder time.',
    heroEyebrow: 'Gutter guards · Leaf protection',
    heroTitle: 'Stop blocked',
    heroHl: 'gutters for good.',
    heroSub: 'Quality gutter guard supply and install — less leaf build-up, better flow and fewer emergency cleans.',
    servicesHeading: 'Less ladder work. Better flow.',
    servicesIntro: 'Mesh, screen and ember-rated systems fitted to your roofline.',
    whyHeading: 'Neat installs. Honest advice.',
    reviewsHeading: 'Gutters that stay clear.',
    quoteSub: 'Tell us your roof type and storey count — we will measure and quote.',
    quoteHeading: 'Get a gutter guard quote — we will call back.',
    jobOptions: [
      { text: 'Mesh guards' },
      { text: 'Ember-rated (bushfire)' },
      { text: 'Gutter clean + guards' },
      { text: 'Multi-storey' },
      { text: 'Commercial' },
    ],
    faq: [
      { q: 'Will guards stop all leaves?', a: 'They dramatically reduce build-up — fine seeds may still need an occasional rinse.' },
      { q: 'Are they bushfire rated?', a: 'We supply ember-rated systems where required — ask about your BAL rating.' },
    ],
    footerBlurb: 'Gutter guard supply and installation for leaf-free, free-flowing gutters.',
    footerServices: [
      { label: 'Mesh guards', href: '#quote' },
      { label: 'Ember-rated', href: '#quote' },
      { label: 'Install', href: '#quote' },
      { label: 'Cleaning', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🍃', title: 'Leaf Mesh Systems', body: 'Fine mesh that keeps leaves out while letting rain through.' },
      { on: true, icon: '🔥', title: 'Ember-Rated Guards', body: 'Bushfire-conscious systems for ember-prone areas.' },
      { on: true, icon: '🪜', title: 'Professional Install', body: 'Secure fixing to suit tile, metal and colourbond roofs.' },
      { on: true, icon: '🧹', title: 'Clean & Guard Combo', body: 'Full gutter clean before guards go on — start fresh.' },
      { on: true, icon: '🏠', title: 'Residential', body: 'Single and double-storey homes with safe access equipment.' },
      { on: true, icon: '🏢', title: 'Commercial Rooflines', body: 'Strata and commercial buildings with maintenance plans.' },
    ],
  }),

  'solar-panel-cleaning': pack({
    label: 'Solar Panel Cleaning',
    tradeType: 'Solar Cleaner',
    theme: { pipe: '#FACC15', hivis: '#22C55E', steel: '#111827', safety: '#FEF08A' },
    emerg: '⚠ Panels dusty or bird-stained? Clean panels produce more power.',
    heroEyebrow: 'Solar cleaning · More output',
    heroTitle: 'More sun',
    heroHl: 'more savings.',
    heroSub: 'Professional solar panel cleaning for homes and businesses — safer access and better generation.',
    servicesHeading: 'Cleaner panels. Better yield.',
    servicesIntro: 'Purified water and safe roof access — no harsh chemicals on your glass.',
    whyHeading: 'Safe access. Real results.',
    reviewsHeading: 'Panels shining again.',
    quoteSub: 'Tell us panel count and roof height — we will call with a fixed price.',
    quoteHeading: 'Book a solar clean — we will call back.',
    jobOptions: [
      { text: 'Residential array' },
      { text: 'Commercial farm' },
      { text: 'Bird dropping removal' },
      { text: 'Annual maintenance' },
      { text: 'Hard-to-access' },
    ],
    faq: [
      { q: 'How much more power will I get?', a: 'Depends on how dirty they are — many owners see a noticeable bump after heavy dust or bird mess.' },
      { q: 'Is tap water OK?', a: 'We use purified water to avoid mineral spotting on the glass.' },
    ],
    footerBlurb: 'Solar panel cleaning for homes and commercial arrays — safer access, better output.',
    footerServices: [
      { label: 'Residential', href: '#quote' },
      { label: 'Commercial', href: '#quote' },
      { label: 'Maintenance', href: '#quote' },
      { label: 'Inspection', href: '#quote' },
    ],
    services: [
      { on: true, icon: '☀️', title: 'Residential Cleans', body: 'Roof-mounted arrays cleaned without damaging panels or warranties.' },
      { on: true, icon: '🏭', title: 'Commercial Farms', body: 'Large-scale cleans scheduled around your operations.' },
      { on: true, icon: '🐦', title: 'Bird & Lichen Removal', body: 'Stubborn staining treated with panel-safe methods.' },
      { on: true, icon: '💧', title: 'Purified Water', body: 'Deionised rinse — no mineral spots left behind.' },
      { on: true, icon: '🪜', title: 'Safe Roof Access', body: 'Harness work and edge protection where required.' },
      { on: true, icon: '📅', title: 'Annual Plans', body: 'Set-and-forget schedules before summer peak.' },
    ],
  }),

  'traffic-control': pack({
    label: 'Traffic Control',
    tradeType: 'Traffic Controller',
    theme: { pipe: '#FACC15', hivis: '#F97316', steel: '#111827', safety: '#FDE047' },
    emerg: '⚠ Road works starting? Book accredited traffic control early.',
    heroEyebrow: 'Traffic control · Road works',
    heroTitle: 'Safe roads',
    heroHl: 'smooth projects.',
    heroSub: 'Accredited traffic controllers and plans for construction, utilities and events — compliant setups that keep crews and public safe.',
    servicesHeading: 'Compliant setups. Calm roads.',
    servicesIntro: 'TC plans, signage, lane closures and night works across civil and utility jobs.',
    whyHeading: 'Accredited. Reliable crews.',
    reviewsHeading: 'Sites that run on time.',
    quoteSub: 'Tell us the job location and dates — we will call with crew availability.',
    quoteHeading: 'Need traffic control? We will call back.',
    jobOptions: [
      { text: 'Road works' },
      { text: 'Utility shutdown' },
      { text: 'TC plan only' },
      { text: 'Night works' },
      { text: 'Event traffic' },
    ],
    faq: [
      { q: 'Are your controllers accredited?', a: 'Yes — our crews hold current state accreditation and PPE as required.' },
      { q: 'Can you prepare the TC plan?', a: 'We work with certified designers or supply plans where scope allows.' },
    ],
    footerBlurb: 'Traffic control crews and plans for construction, utilities and events.',
    footerServices: [
      { label: 'Road works', href: '#quote' },
      { label: 'TC plans', href: '#quote' },
      { label: 'Night works', href: '#quote' },
      { label: 'Events', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🚧', title: 'Road Works Crews', body: 'Lane closures, stop/slow and signage for civil contractors.' },
      { on: true, icon: '📋', title: 'TC Plans', body: 'Traffic management plans prepared or implemented to spec.' },
      { on: true, icon: '🔦', title: 'Night Works', body: 'Lit setups and extra visibility for after-hours jobs.' },
      { on: true, icon: '⚡', title: 'Utility Shutdowns', body: 'Short-duration holds for power, water and telco crews.' },
      { on: true, icon: '🎪', title: 'Events & Filming', body: 'Pedestrian and vehicle management for public events.' },
      { on: true, icon: '👷', title: 'Long-Term Hire', body: 'Multi-week crews for extended projects.' },
    ],
  }),
};

const NEW_BUSINESSES = {
  cafe: pack({
    label: 'Café',
    tradeType: 'Café Owner',
    theme: { pipe: '#78350F', hivis: '#D97706', steel: '#1C1917', safety: '#FDE68A' },
    emerg: '☕ Fresh coffee, house baking and a table waiting.',
    heroEyebrow: 'Café · Coffee & food',
    heroTitle: 'Your local',
    heroHl: 'coffee ritual.',
    heroSub: 'Specialty coffee, fresh food and a welcoming space — dine in, takeaway or grab a table on the strip.',
    servicesHeading: 'Coffee, food & good vibes.',
    servicesIntro: 'From your morning flat white to long lunches — quality ingredients and friendly service.',
    whyHeading: 'Roasted well. Served with care.',
    reviewsHeading: 'Regulars who keep coming back.',
    quoteSub: 'Catering or large group booking? Send details and we will call back.',
    quoteHeading: 'Book a table or catering — we will call you.',
    quoteJobLabel: 'What are you planning?',
    jobOptions: [
      { text: 'Table booking' },
      { text: 'Catering / office' },
      { text: 'Function space' },
      { text: 'Takeaway order' },
      { text: 'Coffee cart hire' },
    ],
    faq: [
      { q: 'Do you do dietary options?', a: 'Gluten-friendly and plant-based choices are on the menu — ask our team on the day.' },
      { q: 'Can I book for a group?', a: 'Yes — call ahead for groups of six or more so we can seat you together.' },
    ],
    footerBlurb: 'Neighbourhood café serving specialty coffee, fresh food and warm hospitality.',
    footerServices: [
      { label: 'Coffee', href: '#quote' },
      { label: 'Breakfast', href: '#quote' },
      { label: 'Lunch', href: '#quote' },
      { label: 'Catering', href: '#quote' },
    ],
    services: [
      { on: true, icon: '☕', title: 'Specialty Coffee', body: 'Single-origin espresso, batch brew and seasonal blends done right.' },
      { on: true, icon: '🥐', title: 'Breakfast & Brunch', body: 'Eggs, pastries and plates that bring people back on weekends.' },
      { on: true, icon: '🥗', title: 'Fresh Lunch', body: 'Salads, sandwiches and hot plates made to order.' },
      { on: true, icon: '🎂', title: 'House Baking', body: 'Cakes, slices and treats baked in-house where possible.' },
      { on: true, icon: '🎉', title: 'Functions & Catering', body: 'Office catering, birthdays and small events by arrangement.' },
      { on: true, icon: '🪑', title: 'Dine In & Takeaway', body: 'Grab a table, a window seat or order to go.' },
    ],
  }),

  bakery: pack({
    label: 'Bakery',
    tradeType: 'Baker',
    theme: { pipe: '#D97706', hivis: '#F97316', steel: '#1C1917', safety: '#FDE68A' },
    emerg: '🥖 Sourdough out of the oven from 7am — get in early.',
    heroEyebrow: 'Bakery · Baked fresh daily',
    heroTitle: 'Baked this',
    heroHl: 'morning. Sold today.',
    heroSub: 'Artisan bread, pies and pastries from a local oven — wholesale and walk-in welcome.',
    servicesHeading: 'Real dough. Real flavour.',
    servicesIntro: 'Slow-fermented loaves, classic pies and celebration cakes made with care.',
    whyHeading: 'Fresh daily. Local favourite.',
    reviewsHeading: 'The smell that sells itself.',
    quoteSub: 'Cake order or wholesale enquiry? We will call to confirm details.',
    quoteHeading: 'Place an order — we will call back.',
    quoteJobLabel: 'What would you like?',
    jobOptions: [
      { text: 'Celebration cake' },
      { text: 'Wholesale bread' },
      { text: 'Pie order' },
      { text: 'Corporate morning tea' },
      { text: 'Custom catering' },
    ],
    faq: [
      { q: 'How early should I order a cake?', a: 'One to two weeks for custom cakes — longer for weddings and busy seasons.' },
      { q: 'Do you deliver?', a: 'Local delivery available on larger orders — ask when you enquire.' },
    ],
    footerBlurb: 'Local bakery — bread, pies and cakes baked fresh every day.',
    footerServices: [
      { label: 'Bread', href: '#quote' },
      { label: 'Pies', href: '#quote' },
      { label: 'Cakes', href: '#quote' },
      { label: 'Wholesale', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🍞', title: 'Artisan Bread', body: 'Sourdough, tin loaves and rolls baked from scratch daily.' },
      { on: true, icon: '🥧', title: 'Pies & Savouries', body: 'Classic Aussie pies, sausage rolls and lunch favourites.' },
      { on: true, icon: '🎂', title: 'Custom Cakes', body: 'Birthdays, weddings and corporate celebrations made to brief.' },
      { on: true, icon: '🥐', title: 'Pastries & Treats', body: 'Croissants, danishes and sweet shelves that turn heads.' },
      { on: true, icon: '🏪', title: 'Wholesale Supply', body: 'Cafés and venues supplied on standing orders.' },
      { on: true, icon: '☕', title: 'Coffee & Retail', body: 'Grab a coffee with your loaf at the counter.' },
    ],
  }),

  restaurant: pack({
    label: 'Restaurant & Takeaway',
    tradeType: 'Restaurant',
    theme: { pipe: '#B91C1C', hivis: '#F97316', steel: '#1C1917', safety: '#FECACA' },
    emerg: '🍽 Book tonight — walk-ins welcome when tables allow.',
    heroEyebrow: 'Restaurant · Dine in & takeaway',
    heroTitle: 'Dinner done',
    heroHl: 'properly.',
    heroSub: 'Seasonal menu, warm service and takeaway for nights you would rather eat at home.',
    servicesHeading: 'Eat in. Take home.',
    servicesIntro: 'Lunch, dinner and functions with ingredients we are proud to put on the plate.',
    whyHeading: 'Seasonal menu. Consistent quality.',
    reviewsHeading: 'Nights out that deliver.',
    quoteSub: 'Group booking or function? Send your date and headcount.',
    quoteHeading: 'Book a table — we will call back.',
    quoteJobLabel: 'What are you booking?',
    jobOptions: [
      { text: 'Dinner reservation' },
      { text: 'Large group' },
      { text: 'Private function' },
      { text: 'Takeaway order' },
      { text: 'Catering' },
    ],
    faq: [
      { q: 'Do you accommodate allergies?', a: 'Tell us when you book — our kitchen can guide you on allergens.' },
      { q: 'Is there parking nearby?', a: 'Street parking and nearby lots — details on our contact page.' },
    ],
    footerBlurb: 'Restaurant and takeaway with seasonal food and relaxed service.',
    footerServices: [
      { label: 'Dine in', href: '#quote' },
      { label: 'Takeaway', href: '#quote' },
      { label: 'Functions', href: '#quote' },
      { label: 'Drinks', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🍽️', title: 'Dine-In Menu', body: 'Lunch and dinner menus that change with the season.' },
      { on: true, icon: '🥡', title: 'Takeaway', body: 'Order ahead and collect — hot food packed properly.' },
      { on: true, icon: '🍷', title: 'Wine & Drinks', body: 'List matched to the menu — ask staff for a recommendation.' },
      { on: true, icon: '🎉', title: 'Private Functions', body: 'Semi-private areas and set menus for celebrations.' },
      { on: true, icon: '👨‍👩‍👧', title: 'Family Friendly', body: 'Kids options and early sittings on weekends.' },
      { on: true, icon: '📅', title: 'Group Bookings', body: 'Tables held for parties — deposit may apply on busy nights.' },
    ],
  }),

  'hair-salon': pack({
    label: 'Hair Salon',
    tradeType: 'Hairdresser',
    theme: { pipe: '#DB2777', hivis: '#F472B6', steel: '#1F1518', safety: '#FBCFE8' },
    emerg: '✂️ New season, new cut — appointments open this week.',
    heroEyebrow: 'Hair salon · Cut & colour',
    heroTitle: 'Hair that',
    heroHl: 'feels like you.',
    heroSub: 'Cuts, colour and treatments from stylists who listen — walk out feeling like yourself, only sharper.',
    servicesHeading: 'Cut, colour, confidence.',
    servicesIntro: 'From quick trims to full colour transformations in a relaxed salon.',
    whyHeading: 'Skilled stylists. Honest advice.',
    reviewsHeading: 'Clients who trust the chair.',
    quoteSub: 'Tell us the service and preferred day — we will call to book.',
    quoteHeading: 'Book an appointment — we will call back.',
    quoteJobLabel: 'What service?',
    jobOptions: [
      { text: 'Cut & style' },
      { text: 'Colour / highlights' },
      { text: 'Treatment' },
      { text: 'Bridal / formal' },
      { text: 'Kids cut' },
    ],
    faq: [
      { q: 'Do I need a patch test for colour?', a: 'Yes for new colour clients — book 48 hours before your colour appointment.' },
      { q: 'How long does balayage take?', a: 'Typically 2–3 hours depending on hair length and desired result.' },
    ],
    footerBlurb: 'Hair salon for cuts, colour and treatments with experienced stylists.',
    footerServices: [
      { label: 'Cuts', href: '#quote' },
      { label: 'Colour', href: '#quote' },
      { label: 'Treatments', href: '#quote' },
      { label: 'Formal', href: '#quote' },
    ],
    services: [
      { on: true, icon: '✂️', title: 'Cut & Style', body: 'Precision cuts and blow-dries for everyday or special occasions.' },
      { on: true, icon: '🎨', title: 'Colour & Highlights', body: 'Full colour, balayage and toners tailored to your skin tone.' },
      { on: true, icon: '💆', title: 'Treatments', body: 'Hydration, keratin and scalp treatments for healthier hair.' },
      { on: true, icon: '👰', title: 'Bridal & Formal', body: 'Trials and day-of styling for weddings and events.' },
      { on: true, icon: '👧', title: 'Kids Cuts', body: 'Patient stylists for school cuts and first trims.' },
      { on: true, icon: '🛍️', title: 'Retail Products', body: 'Professional take-home care recommended for your hair type.' },
    ],
  }),

  barber: pack({
    label: 'Barber Shop',
    tradeType: 'Barber',
    theme: { pipe: '#1E293B', hivis: '#DC2626', steel: '#0F172A', safety: '#94A3B8' },
    emerg: '💈 Walk-ins welcome — classic cuts and hot towel shaves.',
    heroEyebrow: 'Barber shop · Cuts & shaves',
    heroTitle: 'Sharp cuts',
    heroHl: 'clean finishes.',
    heroSub: 'Classic barbering, skin fades and beard work in a relaxed shop — no appointment stress.',
    servicesHeading: 'Classic barbering done right.',
    servicesIntro: 'Fades, tapers and hot towel shaves from barbers who take pride in the detail.',
    whyHeading: 'Consistent fades. Good banter.',
    reviewsHeading: 'The chair guys recommend.',
    quoteSub: 'Group booking or wedding party? Send numbers and date.',
    quoteHeading: 'Book the chair — we will call back.',
    quoteJobLabel: 'What do you need?',
    jobOptions: [
      { text: 'Skin fade' },
      { text: 'Beard trim' },
      { text: 'Hot towel shave' },
      { text: 'Kids cut' },
      { text: 'Wedding party' },
    ],
    faq: [
      { q: 'Do you take walk-ins?', a: 'Yes — appointments get priority but we fit walk-ins when chairs free.' },
      { q: 'How long does a fade take?', a: 'Around 30–45 minutes depending on hair type and detail.' },
    ],
    footerBlurb: 'Barber shop for fades, classic cuts and beard grooming.',
    footerServices: [
      { label: 'Fades', href: '#quote' },
      { label: 'Beards', href: '#quote' },
      { label: 'Shaves', href: '#quote' },
      { label: 'Kids', href: '#quote' },
    ],
    services: [
      { on: true, icon: '💈', title: 'Skin Fades', body: 'Low to high fades blended clean with scissors finish.' },
      { on: true, icon: '🧔', title: 'Beard Trim & Shape', body: 'Line-ups, tapers and hot towel finishes.' },
      { on: true, icon: '🪒', title: 'Hot Towel Shave', body: 'Traditional straight-razor shave with pre and post care.' },
      { on: true, icon: '✂️', title: 'Classic Cuts', body: 'Scissor cuts and tapers for every age.' },
      { on: true, icon: '👦', title: 'Kids Cuts', body: 'Patient barbers for school cuts and first visits.' },
      { on: true, icon: '🎉', title: 'Wedding Parties', body: 'Groom and groomsmen groomed before the big day.' },
    ],
  }),

  'beauty-salon': pack({
    label: 'Beauty Salon',
    tradeType: 'Beauty Therapist',
    theme: { pipe: '#EC4899', hivis: '#A855F7', steel: '#1F1520', safety: '#F9A8D4' },
    emerg: '💅 Appointments this week — lashes, nails and skin.',
    heroEyebrow: 'Beauty salon · Nails & skin',
    heroTitle: 'Look good',
    heroHl: 'feel better.',
    heroSub: 'Nails, lashes, brows and skin treatments in a calm salon — book time that is just for you.',
    servicesHeading: 'Treatments that polish.',
    servicesIntro: 'From express manis to full pamper sessions with qualified therapists.',
    whyHeading: 'Hygiene first. Results that last.',
    reviewsHeading: 'Clients who leave glowing.',
    quoteSub: 'Tell us the treatment and preferred time — we will call to confirm.',
    quoteHeading: 'Book a treatment — we will call back.',
    quoteJobLabel: 'Which treatment?',
    jobOptions: [
      { text: 'Manicure / pedicure' },
      { text: 'Lash extensions' },
      { text: 'Brow shaping' },
      { text: 'Facial' },
      { text: 'Waxing' },
    ],
    faq: [
      { q: 'How long do lash extensions last?', a: 'Around 2–3 weeks with proper aftercare — infills keep them full.' },
      { q: 'Do you use sterile tools?', a: 'Yes — hospital-grade hygiene for all nail and skin services.' },
    ],
    footerBlurb: 'Beauty salon for nails, lashes, brows and skin treatments.',
    footerServices: [
      { label: 'Nails', href: '#quote' },
      { label: 'Lashes', href: '#quote' },
      { label: 'Brows', href: '#quote' },
      { label: 'Skin', href: '#quote' },
    ],
    services: [
      { on: true, icon: '💅', title: 'Nails', body: 'Gel, BIAB and classic manicures with lasting finishes.' },
      { on: true, icon: '👁️', title: 'Lash Extensions', body: 'Classic, hybrid and volume sets with infill appointments.' },
      { on: true, icon: '✨', title: 'Brows & Laminations', body: 'Shaping, tinting and lamination for defined brows.' },
      { on: true, icon: '🧖', title: 'Facials & Skin', body: 'Deep cleanse, hydration and targeted skin treatments.' },
      { on: true, icon: '🌸', title: 'Waxing', body: 'Face and body waxing with gentle techniques.' },
      { on: true, icon: '🎁', title: 'Packages & Gifts', body: 'Pamper packages and gift vouchers for birthdays.' },
    ],
  }),

  'gym-fitness': pack({
    label: 'Gym & Fitness',
    tradeType: 'Personal Trainer',
    theme: { pipe: '#DC2626', hivis: '#111827', steel: '#030712', safety: '#FCA5A5' },
    emerg: '💪 Free trial week — no lock-in on casual memberships.',
    heroEyebrow: 'Gym & fitness · Train with us',
    heroTitle: 'Stronger',
    heroHl: 'starts here.',
    heroSub: 'Gym floor, group classes and personal training — programs for beginners through to seasoned lifters.',
    servicesHeading: 'Train your way.',
    servicesIntro: 'Memberships, PT and classes with coaches who care about form and progress.',
    whyHeading: 'Coaching. Community. Results.',
    reviewsHeading: 'Members who stick with it.',
    quoteSub: 'Interested in PT or a tour? We will call to book your visit.',
    quoteHeading: 'Start your trial — we will call back.',
    quoteJobLabel: 'What interests you?',
    jobOptions: [
      { text: 'Gym membership' },
      { text: 'Personal training' },
      { text: 'Group classes' },
      { text: 'Corporate wellness' },
      { text: 'Free trial' },
    ],
    faq: [
      { q: 'Is there a joining fee?', a: 'Promotions vary — ask about current trial and no-lock-in options.' },
      { q: 'Do you offer beginner programs?', a: 'Yes — inductions and intro PT sessions so you learn the equipment safely.' },
    ],
    footerBlurb: 'Gym and personal training with memberships, classes and coaching.',
    footerServices: [
      { label: 'Membership', href: '#quote' },
      { label: 'Personal training', href: '#quote' },
      { label: 'Classes', href: '#quote' },
      { label: 'Corporate', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🏋️', title: 'Gym Floor', body: 'Free weights, machines and cardio in a well-maintained space.' },
      { on: true, icon: '🎯', title: 'Personal Training', body: 'One-on-one programs tailored to your goals and schedule.' },
      { on: true, icon: '👥', title: 'Group Classes', body: 'HIIT, strength and mobility sessions with motivating coaches.' },
      { on: true, icon: '📋', title: 'Program Design', body: 'Structured plans so you know what to do each session.' },
      { on: true, icon: '🏢', title: 'Corporate Wellness', body: 'Team memberships and on-site sessions for workplaces.' },
      { on: true, icon: '🆓', title: 'Free Trials', body: 'Try the gym before you commit — book a tour online.' },
    ],
  }),

  childcare: pack({
    label: 'Childcare Centre',
    tradeType: 'Childcare Provider',
    theme: { pipe: '#F97316', hivis: '#22C55E', steel: '#1C1917', safety: '#FDE68A' },
    emerg: '🧸 Enrolment tours available — book a visit with your little one.',
    heroEyebrow: 'Childcare · Early learning',
    heroTitle: 'Happy kids',
    heroHl: 'confident starts.',
    heroSub: 'Long day care and early learning in a safe, nurturing centre — qualified educators and engaging programs.',
    servicesHeading: 'Care you can trust.',
    servicesIntro: 'From nursery through to school readiness with play-based learning.',
    whyHeading: 'Qualified educators. Warm rooms.',
    reviewsHeading: 'Families who feel at home.',
    quoteSub: 'Tell us your child\'s age and days needed — we will call about availability.',
    quoteHeading: 'Enquire about a place — we will call back.',
    quoteJobLabel: 'Child\'s age / days?',
    jobOptions: [
      { text: 'Nursery (0–2)' },
      { text: 'Toddlers (2–3)' },
      { text: 'Preschool (3–5)' },
      { text: 'Before school care' },
      { text: 'Centre tour' },
    ],
    faq: [
      { q: 'What are your hours?', a: 'Typically 7am–6pm weekdays — confirm current hours when you tour.' },
      { q: 'Is CCS accepted?', a: 'We are an approved provider — families can claim Child Care Subsidy where eligible.' },
    ],
    footerBlurb: 'Childcare and early learning with qualified educators and nurturing environments.',
    footerServices: [
      { label: 'Long day care', href: '#quote' },
      { label: 'Preschool', href: '#quote' },
      { label: 'Before school', href: '#quote' },
      { label: 'Tours', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🧸', title: 'Long Day Care', body: 'Full-day programs for working families with nutritious meals.' },
      { on: true, icon: '📚', title: 'School Readiness', body: 'Literacy, numeracy and social skills before big school.' },
      { on: true, icon: '🎨', title: 'Play-Based Learning', body: 'Creative, outdoor and sensory play every day.' },
      { on: true, icon: '👶', title: 'Nursery Rooms', body: 'Low ratios and calm routines for babies and toddlers.' },
      { on: true, icon: '🌅', title: 'Before & After School', body: 'Wrap-around care for school-age children where offered.' },
      { on: true, icon: '🏡', title: 'Family Tours', body: 'Visit the rooms and meet educators before you enrol.' },
    ],
  }),

  'real-estate': pack({
    label: 'Real Estate Agent',
    tradeType: 'Real Estate Agent',
    theme: { pipe: '#1D4ED8', hivis: '#F97316', steel: '#0F172A', safety: '#93C5FD' },
    emerg: '🏠 Thinking of selling? Book a free appraisal this week.',
    heroEyebrow: 'Real estate · Buy & sell',
    heroTitle: 'Your home',
    heroHl: 'marketed properly.',
    heroSub: 'Local agents who know the street, the buyers and how to present your property for the best result.',
    servicesHeading: 'Sell smarter. Buy confidently.',
    servicesIntro: 'Sales, rentals and property management with clear communication from day one.',
    whyHeading: 'Local knowledge. Honest advice.',
    reviewsHeading: 'Vendors glad they listed.',
    quoteSub: 'Selling or buying? We will call for a no-obligation chat.',
    quoteHeading: 'Request an appraisal — we will call back.',
    quoteJobLabel: 'How can we help?',
    jobOptions: [
      { text: 'Sell my home' },
      { text: 'Buy a home' },
      { text: 'Rental appraisal' },
      { text: 'Property management' },
      { text: 'Auction prep' },
    ],
    faq: [
      { q: 'What is your commission?', a: 'We explain fees upfront in your appraisal — no surprises at settlement.' },
      { q: 'How do you market my property?', a: 'Photography, online portals, social and buyer database — tailored to your home.' },
    ],
    footerBlurb: 'Real estate sales and property management with local market expertise.',
    footerServices: [
      { label: 'Sell', href: '#quote' },
      { label: 'Buy', href: '#quote' },
      { label: 'Rent', href: '#quote' },
      { label: 'Manage', href: '#quote' },
    ],
    services: [
      { on: true, icon: '🏠', title: 'Residential Sales', body: 'Appraisal, campaign and negotiation until sold.' },
      { on: true, icon: '🔑', title: 'Buyer Advocacy', body: 'Help finding and securing the right home at fair price.' },
      { on: true, icon: '📋', title: 'Property Management', body: 'Landlords supported with tenants, maintenance and reporting.' },
      { on: true, icon: '📸', title: 'Marketing & Styling', body: 'Photography and presentation advice to maximise appeal.' },
      { on: true, icon: '🔨', title: 'Auction Campaigns', body: 'Auction strategy and day-of coordination.' },
      { on: true, icon: '📊', title: 'Market Appraisals', body: 'Free, evidence-based price guides for sellers.' },
    ],
  }),

  accounting: pack({
    label: 'Accountant',
    tradeType: 'Accountant',
    theme: { pipe: '#0F766E', hivis: '#2563EB', steel: '#111827', safety: '#5EEAD4' },
    emerg: '📊 Tax time? Book a consult before the rush.',
    heroEyebrow: 'Accounting · Tax & business',
    heroTitle: 'Numbers sorted',
    heroHl: 'stress reduced.',
    heroSub: 'Tax returns, BAS and business advice for individuals and small business — plain English, proactive support.',
    servicesHeading: 'Tax, BAS & advice.',
    servicesIntro: 'From sole traders to growing companies — compliance done properly.',
    whyHeading: 'Proactive. Plain English.',
    reviewsHeading: 'Clients who sleep better at tax time.',
    quoteSub: 'Tell us if you are individual or business — we will call to book a consult.',
    quoteHeading: 'Book a consult — we will call back.',
    quoteJobLabel: 'What do you need?',
    jobOptions: [
      { text: 'Personal tax return' },
      { text: 'Business tax & BAS' },
      { text: 'Bookkeeping' },
      { text: 'Company setup' },
      { text: 'Tax planning' },
    ],
    faq: [
      { q: 'What should I bring to my first meeting?', a: 'Prior year returns, income summaries and business records if applicable.' },
      { q: 'Do you work with small business?', a: 'Yes — sole traders through to companies with payroll and BAS.' },
    ],
    footerBlurb: 'Accounting, tax and bookkeeping for individuals and small business.',
    footerServices: [
      { label: 'Tax returns', href: '#quote' },
      { label: 'BAS & GST', href: '#quote' },
      { label: 'Bookkeeping', href: '#quote' },
      { label: 'Advice', href: '#quote' },
    ],
    services: [
      { on: true, icon: '📊', title: 'Tax Returns', body: 'Individual and business returns lodged accurately and on time.' },
      { on: true, icon: '🧾', title: 'BAS & GST', body: 'Monthly and quarterly BAS prepared without last-minute panic.' },
      { on: true, icon: '📒', title: 'Bookkeeping', body: 'Ongoing reconciliations and reports so you know your position.' },
      { on: true, icon: '🏢', title: 'Business Setup', body: 'Structure advice for new ventures — company, trust or sole trader.' },
      { on: true, icon: '💡', title: 'Tax Planning', body: 'Year-round strategies to manage liability legally.' },
      { on: true, icon: '👥', title: 'Payroll', body: 'STP-compliant payroll for growing teams.' },
    ],
  }),
};

const COLOUR_PRESETS = {
  'Duct Cleaning': { presetName: 'Air Duct Blue', brand: '#0284C7', cta: '#22C55E', dark: '#0F172A', accent: '#38BDF8', highlight: '#BAE6FD', lightBg: '#F0F9FF' },
  'Mobile Mechanic': { presetName: 'Garage Red', brand: '#DC2626', cta: '#FACC15', dark: '#111827', accent: '#EF4444', highlight: '#FDE047', lightBg: '#FEF2F2' },
  'Chimney Sweep': { presetName: 'Hearth Brown', brand: '#78350F', cta: '#F97316', dark: '#1C1917', accent: '#92400E', highlight: '#FDE68A', lightBg: '#FEF3C7' },
  'Bore Drilling': { presetName: 'Aquifer Blue', brand: '#0369A1', cta: '#22C55E', dark: '#0F172A', accent: '#0EA5E9', highlight: '#BAE6FD', lightBg: '#F0F9FF' },
  'Mobile Tyres': { presetName: 'Tyre Black & Yellow', brand: '#111827', cta: '#FACC15', dark: '#030712', accent: '#374151', highlight: '#FDE047', lightBg: '#F3F4F6' },
  'Smart Home': { presetName: 'Automation Purple', brand: '#7C3AED', cta: '#22C55E', dark: '#111827', accent: '#A78BFA', highlight: '#C4B5FD', lightBg: '#F5F3FF' },
  'Building Inspection': { presetName: 'Inspector Slate', brand: '#475569', cta: '#F97316', dark: '#111827', accent: '#94A3B8', highlight: '#CBD5E1', lightBg: '#F8FAFC' },
  'Gutter Guards': { presetName: 'Guard Green', brand: '#475569', cta: '#22C55E', dark: '#111827', accent: '#94A3B8', highlight: '#A3E635', lightBg: '#F1F5F9' },
  'Solar Panel Cleaning': { presetName: 'Solar Shine', brand: '#FACC15', cta: '#22C55E', dark: '#111827', accent: '#FDE047', highlight: '#FEF08A', lightBg: '#FEFCE8' },
  'Traffic Control': { presetName: 'Roadwork Hi-Vis', brand: '#FACC15', cta: '#F97316', dark: '#111827', accent: '#FDE047', highlight: '#FDBA74', lightBg: '#FFFBEB' },
  'Café': { presetName: 'Coffee House', brand: '#78350F', cta: '#D97706', dark: '#1C1917', accent: '#92400E', highlight: '#FDE68A', lightBg: '#FEF3C7' },
  'Bakery': { presetName: 'Golden Crust', brand: '#D97706', cta: '#F97316', dark: '#1C1917', accent: '#F59E0B', highlight: '#FDE68A', lightBg: '#FFFBEB' },
  'Restaurant & Takeaway': { presetName: 'Bistro Red', brand: '#B91C1C', cta: '#F97316', dark: '#1C1917', accent: '#EF4444', highlight: '#FECACA', lightBg: '#FEF2F2' },
  'Hair Salon': { presetName: 'Salon Pink', brand: '#DB2777', cta: '#F472B6', dark: '#1F1518', accent: '#EC4899', highlight: '#FBCFE8', lightBg: '#FDF2F8' },
  'Barber Shop': { presetName: 'Barber Pole', brand: '#1E293B', cta: '#DC2626', dark: '#0F172A', accent: '#64748B', highlight: '#94A3B8', lightBg: '#F1F5F9' },
  'Beauty Salon': { presetName: 'Beauty Rose', brand: '#EC4899', cta: '#A855F7', dark: '#1F1520', accent: '#F472B6', highlight: '#F9A8D4', lightBg: '#FDF2F8' },
  'Gym & Fitness': { presetName: 'Fitness Red', brand: '#DC2626', cta: '#111827', dark: '#030712', accent: '#EF4444', highlight: '#FCA5A5', lightBg: '#FEF2F2' },
  'Childcare Centre': { presetName: 'Playroom Warm', brand: '#F97316', cta: '#22C55E', dark: '#1C1917', accent: '#FB923C', highlight: '#FDE68A', lightBg: '#FFF7ED' },
  'Real Estate Agent': { presetName: 'Property Blue', brand: '#1D4ED8', cta: '#F97316', dark: '#0F172A', accent: '#3B82F6', highlight: '#93C5FD', lightBg: '#EFF6FF' },
  'Accountant': { presetName: 'Ledger Teal', brand: '#0F766E', cta: '#2563EB', dark: '#111827', accent: '#14B8A6', highlight: '#5EEAD4', lightBg: '#F0FDFA' },
};

const TRADE_CAT_ADDITIONS = {
  'Heating, Cooling & Insulation': ['duct-cleaning', 'chimney-sweep'],
  'Plumbing & Drains': ['bore-drilling'],
  'Electrical, Solar & Data': ['home-automation', 'solar-panel-cleaning'],
  'Building & Structural': ['building-inspection'],
  'Roofing & Exteriors': ['gutter-guards'],
  'Other & Specialist': ['mobile-mechanic', 'mobile-tyres'],
  'Hire & Events': ['traffic-control'],
};

const SMALL_BUSINESS_SLUGS = [
  'cafe', 'bakery', 'restaurant', 'hair-salon', 'barber',
  'beauty-salon', 'gym-fitness', 'childcare', 'real-estate', 'accounting',
];

function loadExistingPacks(html) {
  const start = html.indexOf('const TRADE_PACKS=');
  const lineEnd = html.indexOf('\n', start);
  if (start === -1 || lineEnd === -1) throw new Error('TRADE_PACKS not found');
  let raw = html.slice(start + 'const TRADE_PACKS='.length, lineEnd).trim();
  if (raw.endsWith(';')) raw = raw.slice(0, -1);
  return { start, lineEnd, packs: JSON.parse(raw) };
}

function parseCatsBlock(catsBlock) {
  const raw = catsBlock
    .replace(/^window\.__TRADE_CATS\s*=\s*/, '')
    .replace(/^var TRADE_CATS\s*=\s*/, '')
    .replace(/;\s*$/, '')
    .trim();
  return Function('return (' + raw + ')')();
}

function patchTradeCats(catsBlock) {
  const additions = { ...TRADE_CAT_ADDITIONS, 'Small Business': SMALL_BUSINESS_SLUGS };
  const cats = parseCatsBlock(catsBlock);
  for (const [catName, slugs] of Object.entries(additions)) {
    let found = false;
    for (const row of cats) {
      if (row[0] === catName) {
        for (const slug of slugs) {
          if (row[1].indexOf(slug) === -1) row[1].push(slug);
        }
        found = true;
        break;
      }
    }
    if (!found) cats.push([catName, slugs.slice()]);
  }
  return cats;
}

function patchColourPresets(html) {
  const start = html.indexOf('const TRADE_COLOUR_PRESETS = {');
  const end = html.indexOf('};', start) + 2;
  let block = html.slice(start, end);
  for (const [label, preset] of Object.entries(COLOUR_PRESETS)) {
    const key = '"' + label.replace(/"/g, '\\"') + '"';
    if (block.indexOf(key + ':') !== -1) continue;
    const entry =
      '\n  ' + key + ': { presetName: ' + JSON.stringify(preset.presetName)
      + ', brand: ' + JSON.stringify(preset.brand)
      + ', cta: ' + JSON.stringify(preset.cta)
      + ', dark: ' + JSON.stringify(preset.dark)
      + ', accent: ' + JSON.stringify(preset.accent)
      + ', highlight: ' + JSON.stringify(preset.highlight)
      + ', lightBg: ' + JSON.stringify(preset.lightBg) + ' },';
    block = block.replace(/\n\};\s*$/, entry + '\n};');
  }
  return html.slice(0, start) + block + html.slice(end);
}

function patchGuessCat(html) {
  const insert =
    "      ['Small Business',['cafe','café','coffee shop','bakery','restaurant','takeaway','hair salon','barber','beauty','nail','gym','fitness','childcare','daycare','real estate','property agent','accountant','bookkeeper','tax agent']],\n";
  if (html.indexOf("['Small Business',") !== -1) return html;
  return html.replace(
    "      ['Other & Specialist',['handyman','appliance','repair','specialist']]",
    insert + "      ['Other & Specialist',['handyman','appliance','repair','specialist']]"
  );
}

function main() {
  const managePath = path.join(ROOT, 'manage.html');
  let html = fs.readFileSync(managePath, 'utf8');
  const { start, lineEnd, packs } = loadExistingPacks(html);
  const merged = { ...packs, ...NEW_TRADES, ...NEW_BUSINESSES };
  const newLine = '  const TRADE_PACKS=' + JSON.stringify(merged) + ';\n';
  html = html.slice(0, start) + newLine + html.slice(lineEnd + 1);

  const catsStart = html.indexOf('window.__TRADE_CATS=[');
  const catsEnd = html.indexOf('];', catsStart) + 2;
  const cats = patchTradeCats(html.slice(catsStart, catsEnd));
  html = html.slice(0, catsStart) + 'window.__TRADE_CATS=' + JSON.stringify(cats) + ';' + html.slice(catsEnd);

  html = patchColourPresets(html);
  html = patchGuessCat(html);
  fs.writeFileSync(managePath, html);

  // lp-trade-picker.js
  const pickerPath = path.join(ROOT, 'assets/lp-trade-picker.js');
  let picker = fs.readFileSync(pickerPath, 'utf8');
  const pStart = picker.indexOf('var TRADE_CATS = [');
  const pEnd = picker.indexOf('];', pStart) + 2;
  const pickerCats = patchTradeCats(picker.slice(pStart, pEnd));
  picker = picker.slice(0, pStart) + 'var TRADE_CATS = ' + JSON.stringify(pickerCats) + ';' + picker.slice(pEnd);
  fs.writeFileSync(pickerPath, picker);

  // api/manage.html — sync TRADE_PACKS block if present
  const apiManagePath = path.join(ROOT, 'api/manage.html');
  if (fs.existsSync(apiManagePath)) {
    let apiHtml = fs.readFileSync(apiManagePath, 'utf8');
    if (apiHtml.indexOf('const TRADE_PACKS=') !== -1) {
      const a = loadExistingPacks(apiHtml);
      const apiMerged = { ...a.packs, ...NEW_TRADES, ...NEW_BUSINESSES };
      const apiLine = '  const TRADE_PACKS=' + JSON.stringify(apiMerged) + ';\n';
      apiHtml = apiHtml.slice(0, a.start) + apiLine + apiHtml.slice(a.lineEnd + 1);
      const acStart = apiHtml.indexOf('window.__TRADE_CATS=[');
      if (acStart !== -1) {
        const acEnd = apiHtml.indexOf('];', acStart) + 2;
        const apiCats = patchTradeCats(apiHtml.slice(acStart, acEnd));
        apiHtml = apiHtml.slice(0, acStart) + 'window.__TRADE_CATS=' + JSON.stringify(apiCats) + ';' + apiHtml.slice(acEnd);
      }
      apiHtml = patchColourPresets(apiHtml);
      apiHtml = patchGuessCat(apiHtml);
      fs.writeFileSync(apiManagePath, apiHtml);
    }
  }

  const added = Object.keys({ ...NEW_TRADES, ...NEW_BUSINESSES });
  console.log('Added', added.length, 'packs:', added.join(', '));
  console.log('Total packs now:', Object.keys(merged).length);
}

main();
