# Marketplace Catalogue (Website Studio)

**Generated from** `lib/website-composer/marketplace/catalogue-data.json`  
**Version:** 1  
**Apps:** 43

Support status values: supported · supported-with-limitations · requires-adapter · requires-metadata · incompatible · deprecated.

Composer auto-selects only `supported` apps that also have metadata + adapters.

## requires-adapter (16)

| appId | name | category | sectionKey | adapter | purpose |
|-------|------|----------|------------|---------|---------|
| activityCounter | Activity Counter | social-proof | activityCounter | missing | Live-style numeric counters |
| activityTimeline | Activity Timeline | social-proof | activityTimeline | missing | Chronological "what we are working on" feed |
| beforeAfterFeed | Before/After Feed | social-proof | beforeAfterFeed | missing | Scrolling feed of transformation pairs |
| customerReactions | Customer Reactions | social-proof | customerReactions | missing | Short reaction quotes in a feed format |
| emergencyAvailability | Emergency Availability | trust-conversion | emergencyAvailability | missing | After-hours status and schedule display |
| estimateBuilder | Estimate Builder | trust-conversion | estimateBuilder | missing | Interactive ballpark pricing wizard |
| finance | Finance Options | trust-conversion | finance | missing | Weekly payment callout for larger jobs |
| igProjectFeed | Instagram Project Feed | social-instagram | igProjectFeed | missing | Instagram grid styled as project cards |
| jobsFeed | Jobs Feed | social-proof | jobsFeed | missing | Compact "fresh off the tools" job list |
| projectFeed | Project Feed | social-proof | projectFeed | missing | Card feed of latest completed jobs |
| projectStats | Project Stats | trust-conversion | projectStats | missing | Big-number credibility bar |
| proofStream | Proof Stream | social-proof | proofStream | missing | Mixed proof cards — jobs, reviews, video, before/after |
| responseCards | Response Cards | trust-conversion | responseCards | missing | Urgency cards for emergency trades |
| serviceAreaMap | Service Area Map | trust-conversion | serviceAreaMap | missing | Map section with coverage intro |
| serviceAreas | Service Areas Grid | trust-conversion | serviceAreas | missing | Suburb grid for geographic dominance |
| videoReels | Video Reels | social-proof | videoReels | missing | Short-form video cards from the job site |

## requires-metadata (4)

| appId | name | category | sectionKey | adapter | purpose |
|-------|------|----------|------------|---------|---------|
| featureStrip | featureStrip | content | featureStrip | missing | featureStrip |
| footer | footer | content | footer | missing | footer |
| header | header | content | header | missing | header |
| seoTokens | seoTokens | content | seoTokens | missing | seoTokens |

## supported (20)

| appId | name | category | sectionKey | adapter | purpose |
|-------|------|----------|------------|---------|---------|
| area | Service Area Copy | core-content | area | implemented | Paragraph plus suburb list for local SEO |
| beforeAfter | Before & After Gallery | social-proof | beforeAfter | implemented | Side-by-side or stacked transformation gallery |
| certifications | Certifications | trust-conversion | certifications | implemented | License and accreditation cards |
| crew | Meet the Team | social-proof | crew | implemented | Team member cards with photo and role |
| emerg | emerg | content | emerg | implemented | emerg |
| faq | FAQ Accordion | core-content | faq | implemented | Collapsible questions that cut support calls |
| featuredProjects | Project Portfolio | social-proof | featuredProjects | implemented | Large image cards for premium project showcase |
| hero | Hero Banner | heroes-layout | hero | implemented | First impression above the fold |
| heroSlider | Hero Image Slider | heroes-layout | heroSlider | implemented | Rotating image hero with overlay copy and CTAs |
| instaGallery | Instagram Gallery | social-instagram | instaGallery | implemented | Grid of Instagram posts on your site |
| onlineQuote | onlineQuote | core-content | onlineQuote | implemented | onlineQuote |
| quote | Quote Form | core-content | quote | implemented | Lead capture form with configurable fields |
| reviewHighlights | Review Highlights | core-content | reviewHighlights | implemented | Star-rated snippets directly under the hero |
| reviews | Reviews Wall | core-content | reviews | implemented | Full review cards with source attribution |
| serviceProcess | How It Works | trust-conversion | serviceProcess | implemented | Step-by-step process / booking journey |
| services | Services Grid | core-content | services | implemented | Icon cards for every service you offer |
| specialOffer | Special Offer Banner | trust-conversion | specialOffer | implemented | Limited-time offer strip for ad landing pages |
| splitHero | Split Hero | heroes-layout | splitHero | implemented | Two-column hero with live activity feed |
| trustBar | Trust Bar | heroes-layout | trustBar | implemented | Scrolling badge strip under the hero |
| why | Why Choose Us | core-content | why | implemented | Numbered reasons or icon points that build trust |

## supported-with-limitations (3)

| appId | name | category | sectionKey | adapter | purpose |
|-------|------|----------|------------|---------|---------|
| heroBeforeAfter | Hero Before/After | heroes-layout | heroBeforeAfter | implemented | Interactive drag-to-reveal hero transformation |
| navMenu | Navigation Menu | heroes-layout | navMenu | implemented | Custom nav links — pills or underline style |
| textBox | Text Box | heroes-layout | textBox | implemented | Flexible text block with optional side image |

## Source files inspected (typical)

- marketplace/app-content.json
- marketplace/playground-field-defs.json
- marketplace/sell-templates.json
- lib/marketplace-categories.js
- trade.template.json
- manage.html
