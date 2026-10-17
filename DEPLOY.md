# Deploying to a VPS (Ubuntu + nginx + PostgreSQL + Waitress)

This is the one-time setup for running the site on a fresh Linux VPS, plus the
routine for pushing updates afterwards.

**Nothing here is Windows-specific except the upload commands.** The site runs
identically on Linux — `serve.py` uses Waitress, which is pure Python.

## What runs where

```
Internet
   │  https://aminsharif.com
   ▼
nginx  (TLS, port 443)          ← terminates HTTPS, the only public listener
   │  http://127.0.0.1:5000
   ▼
Waitress  (python serve.py)     ← one process serving all three:
   ├─ the static site (HTML/CSS/JS/assets) from the project root
   ├─ the public JSON API under /api
   └─ the admin panel under /admin
   │
   ▼
PostgreSQL                      ← articles, categories, inquiry inbox
```

Only nginx is exposed. `serve.py` stays on `127.0.0.1`, so the database and the
admin panel are never directly reachable from the internet.

---

## 0. Before you start

You need:

* an Ubuntu 22.04 or 24.04 VPS with root (or sudo) SSH access;
* a domain (`aminsharif.com`) with an **A record pointing at the VPS IP**;
* at least 1 GB of RAM.

Every command below assumes you are logged in over SSH as a user with `sudo`.

---

## 1. Server packages (one time)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-venv python3-pip postgresql nginx certbot python3-certbot-nginx
```

* `python3-venv` / `python3-pip` — Ubuntu 22.04 ships Python 3.10 and 24.04 ships
  3.12; the project needs 3.10 or newer. (A virtualenv is required on 24.04,
  where the system Python is marked "externally managed".)
* `postgresql` — the database.
* `nginx` — the reverse proxy.
* `certbot` — the free Let's Encrypt TLS certificate.

Enable the services:

```bash
sudo systemctl enable --now postgresql nginx
```

---

## 2. Create the app user and directory

The service runs as a normal user, **not** root. Everything the site writes
(generated article pages, `sitemap.xml`) lives in this directory, so this user
must own it.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /srv/aminsharif
sudo chown -R deploy:deploy /srv/aminsharif
```

---

## 3. Upload the code

The project is not a git repository yet, so pick one of these.

### Option A — git (recommended, makes updates a one-liner)

On your Windows machine, in the project folder:

```powershell
git init
git add .
git commit -m "Initial commit"
# create an empty private repo on GitHub/GitLab, then:
git remote add origin git@github.com:you/aminsharif.git
git push -u origin main
```

`backend/.gitignore` already excludes `.env`, `__pycache__` and virtualenvs, so
your secrets and local build artefacts are never pushed.

On the server:

```bash
sudo -u deploy git clone git@github.com:you/aminsharif.git /srv/aminsharif
```

### Option B — upload a tarball (no git)

From Windows PowerShell, in the project folder. `tar` is built into Windows 10+:

```powershell
tar --exclude=".env" --exclude="*/.env" --exclude="__pycache__" --exclude="*__pycache__*" --exclude=".venv" -czf site.tar.gz .
scp site.tar.gz deploy@YOUR_SERVER_IP:/home/deploy/
```

On the server:

```bash
sudo mkdir -p /srv/aminsharif
sudo chown -R deploy:deploy /srv/aminsharif
sudo -u deploy tar -xzf /home/deploy/site.tar.gz -C /srv/aminsharif
rm /home/deploy/site.tar.gz
```

> **Watch out:** never let an upload overwrite `backend/.env`. It holds the
> production secrets and lives *only* on the server. Both commands above
> exclude it — if you ever copy files by hand (WinSCP, FileZilla), skip that
> file explicitly.

---

## 4. Python environment

```bash
cd /srv/aminsharif
sudo -u deploy python3 -m venv .venv
sudo -u deploy .venv/bin/pip install --upgrade pip
sudo -u deploy .venv/bin/pip install -r backend/requirements.txt
```

This installs Flask, `psycopg2-binary`, `python-dotenv`, `flask-compress` and
`waitress`. (`brotli` is optional — install it with `pip install brotli` inside
the venv if you want brotli compression instead of gzip.)

---

## 5. Create the database

```bash
sudo -u postgres psql
```

In the `psql` prompt (replace the password with a strong one):

```sql
CREATE ROLE aminsharif LOGIN PASSWORD 'CHANGE_ME_STRONG_DB_PASSWORD';
CREATE DATABASE aminsharif OWNER aminsharif;
\q
```

Confirm it works before going further:

```bash
psql "postgresql://aminsharif:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/aminsharif" -c "SELECT 1;"
```

---

## 6. Configure `backend/.env`

Generate the two secrets **on the server**:

```bash
cd /srv/aminsharif
sudo -u deploy .venv/bin/python -c "import secrets; print(secrets.token_hex(32))"
sudo -u deploy .venv/bin/python -m backend.manage hash "YOUR_ADMIN_PASSWORD"
```

The first prints a `SECRET_KEY`; the second prints an `ADMIN_PASSWORD_HASH`.

Create the file:

```bash
sudo -u deploy nano /srv/aminsharif/backend/.env
```

Contents — production values, not the example ones:

```ini
# --- Flask ---
SECRET_KEY=PASTE_THE_64_CHAR_HEX_STRING
FLASK_DEBUG=0

# --- Production server ---
HOST=127.0.0.1
PORT=5000
THREADS=8

# nginx terminates TLS in front of the app: use the public https:// scheme.
TRUST_PROXY=1
# The site is served over HTTPS, so mark the session cookie Secure.
COOKIE_SECURE=1

# --- PostgreSQL ---
DATABASE_URL=postgresql://aminsharif:CHANGE_ME_STRONG_DB_PASSWORD@127.0.0.1:5432/aminsharif

# --- Admin login ---
ADMIN_USERNAME=amin
ADMIN_PASSWORD=
ADMIN_PASSWORD_HASH=PASTE_THE_HASH_FROM_ABOVE
```

Lock it down:

```bash
sudo chmod 600 /srv/aminsharif/backend/.env
sudo chown deploy:deploy /srv/aminsharif/backend/.env
```

| Setting | Why it matters here |
| --- | --- |
| `FLASK_DEBUG=0` | Debug mode must **never** be on in production — it exposes a debugger. |
| `HOST=127.0.0.1` | Only nginx can reach Waitress; the app is not exposed on port 5000. |
| `TRUST_PROXY=1` | nginx sets `X-Forwarded-Proto`; without this, redirects would point at `http://`. |
| `COOKIE_SECURE=1` | The admin session cookie is only sent over HTTPS. |
| `ADMIN_PASSWORD_HASH` | Store the hash, not a plaintext password. |
| `DATABASE_URL` + `?sslmode=require` | Only add `?sslmode=require` if the database is on another machine. Local connections don't need it. |

---

## 7. Create the schema and build the static pages

```bash
cd /srv/aminsharif
sudo -u deploy .venv/bin/python -m backend.manage init-db
sudo -u deploy .venv/bin/python -m backend.build
sudo -u deploy .venv/bin/python -m backend.build --check
```

* `init-db` creates the tables and seeds the default content.
* `backend.build` writes the article pages and `sitemap.xml`.
* `--check` exits `0` when nothing is stale — it is a good pre-deploy gate.

---

## 8. Run it as a systemd service

Create `/etc/systemd/system/aminsharif.service`:

```bash
sudo nano /etc/systemd/system/aminsharif.service
```

```ini
[Unit]
Description=Amin Sharif site (Waitress)
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/srv/aminsharif
ExecStart=/srv/aminsharif/.venv/bin/python serve.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aminsharif
sudo systemctl status aminsharif
```

The service must be able to write to the project root, because publishing an
article from the admin panel regenerates `<slug>.html` in place. If the files
are not owned by `deploy`, publishing will fail with
*"Saved, but regenerating the static article pages failed"*. Fix ownership with:

```bash
sudo chown -R deploy:deploy /srv/aminsharif
```

Confirm the app is alive:

```bash
curl -s http://127.0.0.1:5000/api/health
# {"status": "ok", "time": "..."}
```

---

## 9. Put nginx in front of it

Create `/etc/nginx/sites-available/aminsharif`:

```bash
sudo nano /etc/nginx/sites-available/aminsharif
```

```nginx
server {
    listen 80;
    server_name aminsharif.com www.aminsharif.com;

    # Everything goes to Waitress, which knows which files may be served.
    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/aminsharif /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

> **Do not** put `root /srv/aminsharif;` in the nginx config. If nginx served the
> project directory directly it would happily hand out `backend/.env` and
> `backend/app.py` to anyone who asked. Proxying everything to Waitress is both
> simpler and safe — the app refuses to serve `backend/`, `.env`, `.git` and
> friends, and applies the compression and cache headers.

---

## 10. HTTPS

```bash
sudo certbot --nginx -d aminsharif.com -d www.aminsharif.com
```

Certbot edits the nginx config to add the TLS block and an HTTP→HTTPS redirect,
then sets up automatic renewal. Test the renewal timer with:

```bash
sudo certbot renew --dry-run
```

Because the app is now behind TLS, `TRUST_PROXY=1` and `COOKIE_SECURE=1` (step 6)
are what make redirects use `https://` and keep the session cookie secure.

---

## 11. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
sudo ufw status
```

Port 5000 and 5432 stay closed to the world.

---

## 12. Verify the deployment

```bash
curl -s https://aminsharif.com/api/health                 # {"status":"ok",...}
curl -sI https://aminsharif.com/                          # 200, text/html
curl -sI https://aminsharif.com/robots.txt                # 200
curl -sI https://aminsharif.com/sitemap.xml               # 200
curl -sI https://aminsharif.com/does-not-exist            # 404
curl -sI https://aminsharif.com/index.html                # 308 -> /
curl -sI -H "Accept-Encoding: gzip" https://aminsharif.com/css/style.css | grep -i content-encoding
```

Then in a browser:

1. The home page loads over HTTPS.
2. `/admin` shows the login form; log in with the credentials from step 6.
3. Open an insight article — it is a real `.html` page, not a JavaScript shell.
4. Publish a throwaway draft article from the admin panel and confirm a new
   `<slug>.html` appears (this proves the write permission from step 8).

---

## 13. Deploying updates

### With git

```bash
cd /srv/aminsharif
sudo -u deploy git pull
sudo -u deploy .venv/bin/pip install -r backend/requirements.txt   # if deps changed
sudo -u deploy .venv/bin/python -m backend.build --check           # optional gate
sudo systemctl restart aminsharif
```

### With a tarball

```powershell
# on Windows
tar --exclude=".env" --exclude="*/.env" --exclude="__pycache__" --exclude="*__pycache__*" --exclude=".venv" -czf site.tar.gz .
scp site.tar.gz deploy@YOUR_SERVER_IP:/home/deploy/
```

```bash
# on the server
sudo -u deploy tar -xzf /home/deploy/site.tar.gz -C /srv/aminsharif
rm /home/deploy/site.tar.gz
sudo chown -R deploy:deploy /srv/aminsharif
sudo -u deploy /srv/aminsharif/.venv/bin/pip install -r backend/requirements.txt
sudo -u deploy /srv/aminsharif/.venv/bin/python -m backend.build
sudo systemctl restart aminsharif
```

You do **not** need to restart for ordinary content changes: publishing,
editing or deleting an article in the admin panel rebuilds the pages in place.

---

## 14. Backups

The database is the source of truth for articles and inquiries; the hand-written
`.html` files and `assets/` are the source of truth for everything else. Back up
both.

```bash
# database
sudo -u postgres pg_dump aminsharif | gzip > ~/aminsharif-$(date +%F).sql.gz

# files (excluding the venv and caches)
tar --exclude=".venv" --exclude="__pycache__" -czf ~/aminsharif-files-$(date +%F).tar.gz -C /srv aminsharif
```

A nightly cron entry (`crontab -e`), keeping 14 days:

```cron
0 3 * * *  sudo -u postgres pg_dump aminsharif | gzip > /srv/backups/db-$(date +\%F).sql.gz && find /srv/backups -name "db-*.sql.gz" -mtime +14 -delete
```

The generated article pages are reproducible from the database with
`python -m backend.build`, so the database dump is the important one.

---

## 15. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `502 Bad Gateway` from nginx | Waitress is not running. `sudo systemctl status aminsharif` and `journalctl -u aminsharif -n 50`. |
| App fails to start: *"Could not connect to PostgreSQL"* | Wrong `DATABASE_URL` in `backend/.env`, or PostgreSQL is down. Test with `psql` (step 5). |
| `curl 127.0.0.1:5000` refused | `HOST` is not `127.0.0.1`/`0.0.0.0`, or the port differs. Check `backend/.env`. |
| Redirects go to `http://` | `TRUST_PROXY=1` is missing, so the app cannot see nginx's `X-Forwarded-Proto`. |
| Logged out of `/admin` constantly | `COOKIE_SECURE=1` without HTTPS, or a changed `SECRET_KEY` (it re-signs all sessions). |
| *"Saved, but regenerating the static article pages failed"* | The service user cannot write to the project root. `sudo chown -R deploy:deploy /srv/aminsharif`. |
| `/admin` login rejected | `ADMIN_PASSWORD_HASH` and `ADMIN_PASSWORD` disagree, or `ADMIN_USERNAME` differs. Re-run the `hash` command. |
| Changes not visible | Hard-reload (**Ctrl+F5**). CSS/JS are cached for an hour by design. |
| `.env` accidentally overwritten by a deploy | Re-create it from step 6 and restart the service. Always exclude it when uploading. |

Logs:

```bash
sudo journalctl -u aminsharif -f          # application output
sudo tail -f /var/log/nginx/error.log     # proxy errors
```

---

## 16. Security checklist

* [ ] `FLASK_DEBUG=0` — never run the debugger in production.
* [ ] `backend/.env` is `chmod 600` and is not in git.
* [ ] Strong `SECRET_KEY` and a stored `ADMIN_PASSWORD_HASH` (not plaintext).
* [ ] PostgreSQL only listens on `127.0.0.1` (the default).
* [ ] `ufw` allows only SSH, HTTP and HTTPS.
* [ ] TLS is active and `certbot renew --dry-run` passes.
* [ ] `TRUST_PROXY=1` and `COOKIE_SECURE=1` are set.
* [ ] Backups (step 14) are running and you have tested a restore.
* [ ] `python run.py` (the Flask dev server) is **not** what is serving the site
      — production uses `serve.py` under systemd.

---

## Quick reference — first deploy

```bash
# server
sudo apt update && sudo apt install -y python3-venv python3-pip postgresql nginx certbot python3-certbot-nginx
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /srv/aminsharif && sudo chown -R deploy:deploy /srv/aminsharif
# ... upload the code (step 3) ...
cd /srv/aminsharif
sudo -u deploy python3 -m venv .venv
sudo -u deploy .venv/bin/pip install -r backend/requirements.txt
sudo -u postgres psql -c "CREATE ROLE aminsharif LOGIN PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "CREATE DATABASE aminsharif OWNER aminsharif;"
# ... create backend/.env (step 6) ...
sudo -u deploy .venv/bin/python -m backend.manage init-db
sudo -u deploy .venv/bin/python -m backend.build
# ... install the systemd unit (step 8) and the nginx site (step 9) ...
sudo certbot --nginx -d aminsharif.com -d www.aminsharif.com
sudo ufw allow OpenSSH && sudo ufw allow "Nginx Full" && sudo ufw enable
```
