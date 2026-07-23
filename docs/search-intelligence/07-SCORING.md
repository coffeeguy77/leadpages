# Scoring Models

**Document:** `search-intelligence/07-SCORING`  
**Code:** [`../../lib/search-intelligence/scoring/opportunity-value.js`](../../lib/search-intelligence/scoring/opportunity-value.js)  
**Prerequisites:** [00-VISION.md](00-VISION.md)

---

## Label classes (mandatory)

| Class | Meaning |
|-------|---------|
| **measured** | Directly observed (e.g. GSC clicks, crawl status code) |
| **estimated** | Provider estimate (e.g. search volume) |
| **modelled** | Leadpages-derived score combining inputs |

UI must show class + date + source. Never present modelled scores as Google facts.

---

## Opportunity Value

Generic keyword difficulty is not enough.

**Opportunity Value = Demand × Commercial Intent × Lead Value × Attainability × Conversion Fit**

| Factor | Typical inputs |
|--------|----------------|
| Demand | Volume, trend (estimated) |
| Commercial intent | CPC, SERP features, transactional cues |
| Lead value | Avg job/lead value for service (site or modelled) |
| Attainability | Local SERP strength, topical authority, current rank |
| Conversion fit | Business offers service; LP recipe exists; historical CVR |

Weights live in `opportunity-value.js` and are tunable by super-admin later. Explain the score in UI (factor breakdown), not a black box.

---

## Page quality score (not keyword stuffing)

Balanced model:

- Intent match  
- Service completeness  
- Specificity and local proof  
- Business/entity consistency  
- Expertise and trust  
- Readability  
- Structural clarity  
- Technical/indexing health  
- Conversion readiness  
- Uniqueness across the site  

**Explicitly prevent** location-page spam and near-duplicate doorway content (align with service-area gate in publish SEO).

---

## Outcome-based scoring

Reward:

- Qualified visibility  
- Calls / forms / quotes  
- Lead quality  
- Booked work / revenue (Phase 5 CRM)  
- Profitable cost per lead  
- Growth in target service areas  

Do **not** reward busywork (fixing low-impact issues for a vanity health score).

---

## Technical issue priority

Severity: `critical` | `high` | `medium` | `low`  

Prioritise by likely **visibility and lead impact**, not raw issue count. Each issue stores evidence, why it matters, recommended fix, auto-fix eligibility, owner (client / partner / platform / external), confidence, detected/resolved dates.
