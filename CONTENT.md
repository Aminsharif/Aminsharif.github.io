# Adding content (and keeping it SEO-friendly)

There are two kinds of content on this site, and they are added in two
different ways:

| Kind | How to add it | Who writes the HTML |
| --- | --- | --- |
| **Insight / article** (blog post) | Admin panel → Insights | the build script |
| **Project, case study or service page** | a new `.html` file, copied from an existing one | you |

Everything about a page's SEO — canonical, Open Graph, structured data,
sitemap, breadcrumbs — is covered below for both cases.

---

## 1. New insight (article)

Go to **`/admin` → Insights → New article**, fill in the form and save. You do
not touch any file for this.

### Fields that matter

| Field | Where it ends up | Guidance |
| --- | --- | --- |
| **Title** | `<h1>`, breadcrumb, card title, JSON-LD `headline` | plain text, no HTML, ~50–60 characters |
| **Slug** | the URL: `https://aminsharif.com/<slug>.html` | lowercase, hyphens, keyword first — e.g. `automate-invoice-approvals-n8n` |
| **Excerpt** | lead paragraph under the title, card text, meta description fallback | one or two sentences |
| **Meta title** | `<title>` and `og:title` | leave blank to reuse Title; if it does not already contain "Amin Sharif", `" \| Amin Sharif"` is appended |
| **Meta description** | `<meta name="description">`, `og:description`, JSON-LD | ~150 characters |
| **Category** | category chip, `articleSection`, the `?category=` filter | pick one, or add a new one inline |
| **Read time** | the "N min read" label | whole number of minutes |
| **Cover image** | `og:image`, `twitter:image` | **set this** — a ~1200×630 image. Without it, a favicon PNG is used, which looks poor when the link is shared |
| **Published date** | the byline, `datePublished`, sitemap `lastmod` | |
| **Content** | the article body | HTML. Use `<h2>` for sections. Do **not** add an `<h1>` — the Title is already the page's only H1 |
| **External URL** | where the card links | **leave blank** (see the note below) |
| **Status** | | must be **Published**; drafts are excluded from the build, sitemap and API |

### What is generated for you

As soon as you save, the page is rebuilt and gets all of this automatically:

* a real static page at `<slug>.html` — plain HTML, no JavaScript required to read it
* self-referencing `canonical` and `og:url`
* `article:published_time`, `og:image`
* `BlogPosting` and `BreadcrumbList` structured data
* the breadcrumb bar (Home / Insights / title) and the closing CTA band
* an entry in `sitemap.xml` with a real `lastmod`
* a card on `insights.html` — both the JavaScript grid and the `<noscript>` fallback
* an entry in the Blog list inside `insights.html`'s structured data
* a **301 redirect** from the old-style address `/article.html?slug=<slug>`
* `noindex` on filtered listings such as `insights.html?category=…`

### Verify

```powershell
python -m backend.build --check     # exit 0 = nothing is stale
```

Then reload `https://aminsharif.com/<slug>.html` with **Ctrl+F5** and confirm
View Source shows your canonical URL in the `<head>`.

### The one thing to be careful about

**External URL** is only for pointing a card at a page you wrote by hand (that
is how the five original articles work). If you point it at a name the build
does not own, no page is generated at all and the card will lead to a 404.
Leave it blank for anything you write in the admin panel.

---

## 2. New project, case study or service page

These are hand-written `.html` files. Start by copying an existing one — that
is the easiest way to inherit the correct navigation, footer and CTA band.

```powershell
Copy-Item lead-generation.html your-project.html
```

Then work through this checklist.

### 2.1 Update the `<head>`

Replace every placeholder below. The `canonical` and `og:url` must be the
page's real absolute URL, and `og:image` must be an absolute URL to an image
that exists.

```html
<title>Your Project — Amin Sharif</title>
<meta name="description" content="One clear sentence, ~150 characters.">
<meta name="author" content="Amin Sharif">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="https://aminsharif.com/your-project.html">

<meta property="og:type" content="article">
<meta property="og:site_name" content="Amin Sharif — AI Automation Agency">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="https://aminsharif.com/your-project.html">
<meta property="og:title" content="Your Project — Amin Sharif">
<meta property="og:description" content="One clear sentence, ~150 characters.">
<meta property="og:image" content="https://aminsharif.com/assets/images/your-project.jpg">
<meta property="og:image:alt" content="Describe the image">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Your Project — Amin Sharif">
<meta name="twitter:description" content="One clear sentence, ~150 characters.">
<meta name="twitter:image" content="https://aminsharif.com/assets/images/your-project.jpg">
```

`og:type` depends on the kind of page: the case studies use `article`, service
pages use `website`, and `amin-sharif-cv.html` uses `profile`. Keep whatever the
page you copied uses.

### 2.2 Update the structured data

The page carries a JSON-LD block with a `BreadcrumbList` and a `WebPage`. Both
use absolute URLs and the page name, so update every `@id`, `url`, `name` and
`description` in it — a stale `@id` is worse than no structured data at all.

### 2.3 Update the visible content

* the breadcrumb bar (`Home / Case Studies / Your Project`) and the hero `<h1>`
* the body copy — keep exactly one `<h1>` on the page
* keep the closing CTA band, with `data-booking` on the **Book a Discovery Call** link

### 2.4 Link to the new page

* add it to the relevant mega-menu in the navigation
* add it to the grid on `case-studies.html` (or `services.html`)

### 2.5 Add it to the sitemap list

Open `backend/build.py` and add one line to `STATIC_PAGES`, in the order it
should appear in the sitemap:

```python
STATIC_PAGES = [
    ...
    ("your-project.html", "your-project.html", "monthly", "0.7"),
    ...
]
```

The four values are:

| Value | Meaning |
| --- | --- |
| `your-project.html` | the file name on disk |
| `your-project.html` | the URL path after the domain — use `""` for the home page |
| `monthly` | `changefreq` hint (`weekly`, `monthly`, `yearly`) |
| `0.7` | `priority` hint — `0.9` for main service pages, `0.7` for case studies, `0.3` for legal pages |

The sitemap's `lastmod` for a hand-written page is taken from the file's
modification time, so you never maintain dates by hand.

### 2.6 Build and verify

```powershell
python -m backend.build
```

If you forgot step 2.5, this now tells you so instead of shipping a page that
search engines cannot find:

```
Warning: indexable pages missing from sitemap.xml - add them to STATIC_PAGES in backend/build.py:
  - your-project.html
```

---

## 3. Commands

| Command | Purpose |
| --- | --- |
| `python run.py` | development server on <http://127.0.0.1:5000/> |
| `python serve.py` | production server (Waitress) |
| `python -m backend.build` | regenerate article pages, `sitemap.xml` and the insights lists |
| `python -m backend.build --check` | verify nothing on disk is stale; exits `1` if it is |

`python -m backend.build` also runs automatically every time you publish, edit
or delete an article in the admin panel. Run it manually after hand-editing a
page or adding a new one, and add `--check` to a deploy step if you want a
safety net.

---

## 4. Rules of thumb

* **Never hand-edit a generated article page.** Generated files begin with
  `<!-- Generated by backend.build. … -->` on line 1. Edit the article in the
  admin panel instead — your changes would be overwritten.
* **One `<h1>` per page.** For articles, use `<h2>` for sections.
* **Every page needs its own canonical URL**, absolute, matching the page.
* **Pages you do not want indexed** carry `noindex, follow` — that is how
  `404.html` and `thank-you.html` stay out of search results.
* **Keep titles under ~60 and descriptions under ~160 characters** so they are
  not truncated in search results.
* **Link between your own pages** when it is genuinely useful — internal links
  are a ranking signal and help crawlers discover new pages.

---

## 5. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| New page returns 404 | the file is not at the project root, or the name does not match the link |
| New article 404s after saving | **External URL** is set to a name the build does not own — clear it and save again |
| `--check` says something is "Out of date" | run `python -m backend.build` |
| `--check` says a page is "missing from sitemap" | add it to `STATIC_PAGES` in `backend/build.py` (step 2.5) |
| Sitemap lists a page that no longer exists | the article was unpublished/deleted; the build removes generated pages automatically |
| Changes do not appear in the browser | hard-reload with **Ctrl+F5**; CSS and JS are cached for an hour |
| Canonical points at the wrong URL | a hand-written page has a stale `<link rel="canonical">` (step 2.1) |

---

## See also

**[DEPLOY.md](DEPLOY.md)** — how to run this site on a VPS (nginx, PostgreSQL,
HTTPS, systemd and updates).
