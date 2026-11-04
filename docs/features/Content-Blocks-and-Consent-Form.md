# Content blocks, feature banner and online consent form (Nov 2026)

First used by Pam Connor & Associates. Everything here is **opt-in**: sites that don't set
these keys render exactly as before.

## Content blocks

Designed sections written as text, so a page can follow a design without new apps.

Where:
- **Sub-pages:** `page.blocks === true` (editor: *Designed sections (content blocks)* under the page text). The page body is the blocks text.
- **Home page:** `sections.textBox.layout = 'blocks'` with the text in `sections.textBox.blocks`.

Rendering: `assets/lp-layouts.js` (`lpbParse` / `lpbRender`, STEP `pageBlocks`); styles `.lpb*` in
`assets/lp-layouts.css`. The template hides the article text briefly (`lp-blocks-wait`, max 2.5 s)
and strips `:::` lines from its own fallback text.

Syntax — a block opens with `:::type [title] [key=value …]` and closes with `:::`:

| Block | Attributes | Content |
|---|---|---|
| `heading Title` | — | optional intro text |
| `cols` / `col` | `ratio=3:2`, `align=center` | other blocks; stack on phones |
| `panel` | `icon`, `title`, `tone=soft\|white\|plain\|alert`, `iconStyle=circle`, `price`, `priceNote`, `ticks=no` | text; `- ` lines become ticks |
| `cards` | `cols`, `style=center\|side\|link`, `more="Learn More"` | `icon \| Title \| text \| link \| link label` |
| `steps` | — | `icon \| Title \| text` (numbered, arrows) |
| `notice` | `tone=alert\|info`, `icon` | one line |
| `faq` | — | `? Question` or `? icon \| Question`, then the answer |
| `contacts` | — | `icon \| Title \| text` |
| `members` | — | `icon or image URL \| Name \| detail` |
| `image` | `src`, `alt`, `ratio` | none — no closing `:::` |
| `enquiry` | `title`, `button`, `messageLabel` | intro text; posts to `/api/leads` (same spam checks, inbox and email as the quote form) |
| `consent` | — | none — the page's online consent form |

Outside blocks: `##` headings, `**bold**`, `*italic*`, `[links](/page)`, `- ` lists, `1.` lists, `| tables |`.

## Banner and hero options

- `sections.ctaBanner.layout = 'feature'`: round icon (`icon`) or a photo (`featureImage`) | divider | heading + text | button; `decorImage` adds faint leaves on the right.
- `sections.heroSlider.headingWeight = 'bold'` (split / cover), `coverTextWidth` (% 25–70), `coverMinHeight` (px 200–800).
- `assets/lp-fonts.js` clinical set now loads Source Serif 4 at 700 (v=5).

## Online consent form

- Page: `blocks: true`, body contains `:::consent`, and `page.consentForm`:

```js
{
  on: true, recipient: 'practice@example.com', recipientLabel, sendTo: 'Dr Smith', fileName,
  title, intro, privacyNote, agreeText, successText,
  documents: [{ title, body /* markdown */, initial: true|false }],
  fields: [{ k, label, type: 'text'|'email'|'tel'|'date'|'textarea', req }],
  declaration: 'I, {name}, have read …'
}
```

- Client: `assets/lp-consent.js` (loaded only when a consent block is on the page). Three steps — read (tick each document, initials where asked), details, sign on screen and send.
- Progress is saved **only on the person's device** (`localStorage`, key `lpConsent:<site>:<page>`): automatically as they type, plus *Save progress* and *Clear saved answers* buttons. It is deleted when the form is sent.
- Server: `api/consent-form.js` + `lib/consent-form.js`. Checks the answers against the saved config, builds a signed PDF (pdfkit: details, documents read + initials, declaration, signature, then the full documents as signed) and emails it via Resend to `consentForm.recipient`. The recipient is never taken from the request.
- **Nothing is stored** — no database row and no file. The person gets the same PDF back to download. If the email can't be sent, they're asked to download it and email it themselves.
- Spam/abuse: hidden field, sent-too-fast check, 6 submissions / 10 minutes per IP, 900 KB body limit, PNG signature check.
- Editing the documents / fields is in the page config for now (no editor card yet).

## Tests

`tests/content-blocks-consent-form.test.js`
