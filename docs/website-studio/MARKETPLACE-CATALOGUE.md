# Marketplace Catalogue (Website Studio)

**Generated from** `lib/website-composer/marketplace/catalogue-data.json`  
**Updated:** 2026-07-18 (Phase 4)  
**Version:** 2  
**Apps:** 48 (supported-with-limitations: 13, supported: 34, incompatible: 1)

Support status values: supported · supported-with-limitations · incompatible · deprecated.

Composer auto-selects only `supported` apps that also have metadata + adapters (`adapterStatus: implemented`).
Apps marked `supported-with-limitations` are not auto-selected unless a recipe explicitly includes them and an adapter exists.

## supported (34)

| appId | name | category | sectionKey | adapter | purpose | reason |
|-------|------|----------|------------|---------|---------|--------|
| area | Service Area Copy | core-content | area | implemented | Paragraph plus suburb list for local SEO |  |
| beforeAfter | Before & After Gallery | social-proof | beforeAfter | implemented | Side-by-side or stacked transformation gallery |  |
| beforeAfterFeed | Before/After Feed | social-proof | beforeAfterFeed | implemented | Scrolling feed of transformation pairs |  |
| bookingCta | Booking CTA | trust-conversion | bookingCta | implemented | Appointment / booking conversion band |  |
| brandStory | Brand Story | core-content | brandStory | implemented | Long-form brand / provenance narrative |  |
| certifications | Certifications | trust-conversion | certifications | implemented | License and accreditation cards |  |
| clientLogos | Client Logos | trust-conversion | clientLogos | implemented | Logo trust strip for corporate and event clients |  |
| crew | Meet the Team | social-proof | crew | implemented | Team member cards with photo and role |  |
| customerReactions | Customer Reactions | social-proof | customerReactions | implemented | Short reaction quotes in a feed format |  |
| emerg | emerg | content | emerg | implemented | emerg |  |
| faq | FAQ Accordion | core-content | faq | implemented | Collapsible questions that cut support calls |  |
| featuredProjects | Project Portfolio | social-proof | featuredProjects | implemented | Large image cards for premium project showcase |  |
| featureStrip | featureStrip | content | featureStrip | implemented | featureStrip |  |
| footer | footer | content | footer | implemented | footer |  |
| hero | Hero Banner | heroes-layout | hero | implemented | First impression above the fold |  |
| heroSlider | Hero Image Slider | heroes-layout | heroSlider | implemented | Rotating image hero with overlay copy and CTAs |  |
| instaGallery | Instagram Gallery | social-instagram | instaGallery | implemented | Grid of Instagram posts on your site |  |
| jobsFeed | Jobs Feed | social-proof | jobsFeed | implemented | Compact "fresh off the tools" job list |  |
| onlineQuote | onlineQuote | core-content | onlineQuote | implemented | onlineQuote |  |
| packageCompare | Package Compare | core-content | packageCompare | implemented | Side-by-side package / vehicle / tier comparison |  |
| productCollection | Product Collection | retail-content | productCollection | implemented | Editorial product / collection shelf for retail and jewellery |  |
| projectFeed | Project Feed | social-proof | projectFeed | implemented | Card feed of latest completed jobs |  |
| projectStats | Project Stats | trust-conversion | projectStats | implemented | Big-number credibility bar |  |
| quote | Quote Form | core-content | quote | implemented | Lead capture form with configurable fields |  |
| reviewHighlights | Review Highlights | core-content | reviewHighlights | implemented | Star-rated snippets directly under the hero |  |
| reviews | Reviews Wall | core-content | reviews | implemented | Full review cards with source attribution |  |
| serviceAreas | Service Areas Grid | trust-conversion | serviceAreas | implemented | Suburb grid for geographic dominance |  |
| serviceProcess | How It Works | trust-conversion | serviceProcess | implemented | Step-by-step process / booking journey |  |
| services | Services Grid | core-content | services | implemented | Icon cards for every service you offer |  |
| specialOffer | Special Offer Banner | trust-conversion | specialOffer | implemented | Limited-time offer strip for ad landing pages |  |
| splitHero | Split Hero | heroes-layout | splitHero | implemented | Two-column hero with live activity feed |  |
| textBox | Text Box | heroes-layout | textBox | implemented | Flexible text block with optional side image |  |
| trustBar | Trust Bar | heroes-layout | trustBar | implemented | Scrolling badge strip under the hero |  |
| why | Why Choose Us | core-content | why | implemented | Numbered reasons or icon points that build trust |  |

## supported-with-limitations (13)

| appId | name | category | sectionKey | adapter | purpose | reason |
|-------|------|----------|------------|---------|---------|--------|
| activityCounter | Activity Counter | social-proof | activityCounter | missing | Live-style numeric counters | Trade social-proof counters; opt-in for trades only |
| activityTimeline | Activity Timeline | social-proof | activityTimeline | missing | Chronological "what we are working on" feed | Trade job timeline; opt-in for trades only |
| emergencyAvailability | Emergency Availability | trust-conversion | emergencyAvailability | missing | After-hours status and schedule display | Emergency schedule niche |
| estimateBuilder | Estimate Builder | trust-conversion | estimateBuilder | missing | Interactive ballpark pricing wizard | Interactive quote wizard with large config surface; not auto-selected |
| finance | Finance Options | trust-conversion | finance | missing | Weekly payment callout for larger jobs | Finance callout niche |
| header | header | content | header | missing | header | Shell chrome via concept.header, not a section app |
| heroBeforeAfter | Hero Before/After | heroes-layout | heroBeforeAfter | implemented | Interactive drag-to-reveal hero transformation | Playground omits before/after image fields; keep limited |
| igProjectFeed | Instagram Project Feed | social-instagram | igProjectFeed | missing | Instagram grid styled as project cards | Overlaps supported instaGallery; IG token plumbing external |
| navMenu | Navigation Menu | heroes-layout | navMenu | implemented | Custom nav links — pills or underline style | Special header/nav render path; use navigation defaults |
| proofStream | Proof Stream | social-proof | proofStream | missing | Mixed proof cards — jobs, reviews, video, before/after | Mixed typed cards need richer validation before auto-select |
| responseCards | Response Cards | trust-conversion | responseCards | missing | Urgency cards for emergency trades | Urgency cards trade-only |
| serviceAreaMap | Service Area Map | trust-conversion | serviceAreaMap | missing | Map section with coverage intro | Depends on map + serviceAreas data wiring |
| videoReels | Video Reels | social-proof | videoReels | missing | Short-form video cards from the job site | Requires hosted video assets; Image Service stock path insufficient |

## incompatible (1)

| appId | name | category | sectionKey | adapter | purpose | reason |
|-------|------|----------|------------|---------|---------|--------|
| seoTokens | seoTokens | content | seoTokens | none | seoTokens | SEO config object, not a page section — managed via draft SEO fields |

## Phase 4 new Marketplace apps

These apps follow normal Marketplace architecture (catalogue + categories + section mounts + adapters) and are not Website Studio-only stubs:

- `productCollection` — product shelf / collections
- `clientLogos` — client logo trust strip
- `bookingCta` — appointment / booking CTA band
- `brandStory` — brand / provenance story
- `packageCompare` — package / vehicle / tier comparison
