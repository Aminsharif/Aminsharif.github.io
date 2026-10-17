# Amin Sharif — site + backend

The site is a static HTML/CSS/JS front-end with a small **Flask + PostgreSQL**
backend that adds two things:

1. **Insights** — articles with categories, written in an admin panel and stored
   in PostgreSQL. A build step pre-renders each one to a static, crawlable page,
   so readers and search engines get plain HTML.
2. **Project inquiry inbox** — contact-form submissions are stored in the
   database and shown in the admin panel.

The Flask process serves the API, the admin panel **and** the existing static
site, so everything runs from one command on one origin.

See **[CONTENT.md](CONTENT.md)** for how to add a new article or project page
and keep it SEO-friendly, and **[DEPLOY.md](DEPLOY.md)** for running the site on
a VPS.

---

## 1. Requirements

* Python 3.10+ (tested on 3.13)
* PostgreSQL 13+ (tested on 18)

---

## 2. Install

From the project root:

```powershell
python -m pip install -r backend/requirements.txt
```

## 3. Create the PostgreSQL database

Using the `psql` shell (adjust user as needed):

```sql
CREATE DATABASE aminsharif;
```

Or on the command line:

```powershell
createdb -U postgres aminsharif
```

## 4. Configure the backend

Copy the example file and edit it:

```powershell
Copy-Item backend\.env.example backend\.env
```

Open `backend/.env` and set at least:

| Variable | Meaning |
| --- | --- |
| `SECRET_KEY` | Long random string used to sign session cookies. |
| `DATABASE_URL` | e.g. `postgresql://postgres:YOUR_PASSWORD@localhost:5432/aminsharif` |
| `ADMIN_USERNAME` | Admin panel login name. |
| `ADMIN_PASSWORD` | Admin panel password (or set `ADMIN_PASSWORD_HASH`, see below). |

Generate a strong secret and password hash:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
python -m backend.manage hash "your-admin-password"
```

Put the hash output into `ADMIN_PASSWORD_HASH` and leave `ADMIN_PASSWORD` empty
if you prefer not to store a plain password.

## 5. Run

Development:

```powershell
python run.py
```

Production (Waitress — pure Python, so the same command works on Windows and
Linux):

```powershell
python serve.py
```

* Site: <http://127.0.0.1:5000/>
* Admin panel: <http://127.0.0.1:5000/admin>

`serve.py` reads `HOST` (default `0.0.0.0`), `PORT` (default `5000`) and
`THREADS` (default `8`). Responses are compressed (brotli/gzip) and carry cache
and security headers. The console script is equivalent:

```powershell
waitress-serve --call --threads=8 --listen=0.0.0.0:5000 backend.app:create_app
```

On first start the schema is created automatically and the five original
articles are seeded as a starting point (they link to the existing `.html`
pages, so nothing is lost).

---

## Admin panel

Log in at `/admin` with the credentials from `backend/.env`.

| Section | What you can do |
| --- | --- |
| **Dashboard** | Counts for articles, drafts, categories and inquiries. |
| **Insights** | Create, edit, publish/unpublish and delete articles. Pick a category or add a new one inline. Set a slug, excerpt, read time, cover image, meta tags and publish date. |
| **Categories** | Add and remove categories used to filter insights. |
| **Inquiries** | Read every contact-form submission, mark it new/read/archived, reply by email or delete it. |

### Article content

The content field accepts HTML (headings, paragraphs, lists, links, code
blocks). Only the admin writes it, so it is rendered as-is on the article page.

### Static article pages

Publishing (or deleting) an article in the admin panel regenerates it as a real
`<slug>.html` page at the project root, and refreshes `sitemap.xml` plus the
`<noscript>` list on `insights.html`. Search engines get plain HTML instead of a
JavaScript-rendered shell, and the legacy `/article.html?slug=…` address
301-redirects to the static page.

Regenerate by hand, or as a deploy step:

```powershell
python -m backend.build          # write pages, sitemap and the fallback list
python -m backend.build --check  # exit 1 if anything on disk is out of date
```

Each generated page starts with an HTML comment naming the generator. The build
leaves hand-written pages alone, never claims an article that points elsewhere,
and removes a generated page once its article is unpublished.

### Linking to existing pages

Set **External URL** on an article to point its card at an existing `.html`
page. This is how the five seeded articles work — their content lives in those
files, so the generator leaves them untouched. Leave the field blank to have the
article generated as `<slug>.html` instead.

For a step-by-step walkthrough — adding an article, or a brand-new project or
service page — see **[CONTENT.md](CONTENT.md)**.

---

## Public API

All responses are JSON. Set `apiBase` in `js/config.js` only if the front-end is
hosted on a different origin from the backend.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `GET` | `/api/categories` | Categories with published article counts. |
| `GET` | `/api/articles?category=&search=&limit=&offset=` | Published articles. |
| `GET` | `/api/articles/<slug>` | A single published article (includes content). |
| `POST` | `/api/inquiries` | Store a project inquiry. |

`POST /api/inquiries` accepts JSON:

```json
{
  "name": "Jane Doe",
  "email": "jane@company.com",
  "company": "Acme",
  "service": "n8n Workflow Automation",
  "message": "We want to automate lead routing…",
  "budget": "$1,000 – $5,000",
  "contact_method": "Email"
}
```

---

## Front-end integration

* `js/insights.js` loads `/api/articles` and `/api/categories` and renders the
  cards and category filters on `insights.html`.
* `js/article.js` loads `/api/articles/<slug>` and renders `article.html`.
* `js/main.js` posts the contact form to `/api/inquiries`, then emails a copy
  through FormSubmit.co so existing email alerts keep working. If the backend is
  unreachable it falls back to FormSubmit.co so no inquiry is lost.

### Hosting the static site separately

If the front-end is on a different host (Netlify, cPanel, …):

1. Set `apiBase` in `js/config.js` to the backend URL, e.g.
   `"https://api.aminsharif.com"`.
2. Add that site origin to `CORS_ORIGINS` in `backend/.env`, e.g.
   `CORS_ORIGINS=https://aminsharif.com,https://www.aminsharif.com`.

---

## Managing the database

```powershell
python -m backend.manage init-db     # create tables + seed (safe to re-run)
python -m backend.manage hash "pw"   # generate a password hash
```

The schema lives in `backend/schema.sql` and is applied idempotently on every
startup.

---

## Deployment

A complete VPS walkthrough — Ubuntu, nginx, PostgreSQL, HTTPS, systemd and
updates — is in **[DEPLOY.md](DEPLOY.md)**. The essentials:

* production runs under Waitress via `python serve.py`, never `run.py`;
* set `FLASK_DEBUG=0`, `TRUST_PROXY=1` and `COOKIE_SECURE=1` in `backend/.env`;
* run `python -m backend.build` as part of the deploy;
* the service user must own the project root, because publishing an article
  writes `<slug>.html` there.

---

## Troubleshooting

* **`Could not connect to PostgreSQL…`** — check the service is running and that
  `DATABASE_URL` / `PG*` values in `backend/.env` are correct.
* **Admin login says "Invalid CSRF token"** — the browser is blocking cookies.
  Allow cookies for the site and reload.
* **Insights show "temporarily unavailable"** — the page cannot reach the API.
  Confirm the backend is running and, if the site is hosted separately, that
  `apiBase` and `CORS_ORIGINS` are set.
