"""Flask application factory.

Serves three things from one process:

* the public JSON API under ``/api`` (consumed by the static pages),
* the admin panel under ``/admin``,
* the existing static site from the project root (same origin, no CORS needed).
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    jsonify,
    redirect,
    request,
    send_from_directory,
    session,
    url_for,
)
from flask_compress import Compress
from werkzeug.middleware.proxy_fix import ProxyFix

from .auth import get_csrf_token
from .db import init_pool, init_schema, query_one
from .routes.admin import admin_bp
from .routes.api import api_bp

BASE_DIR = Path(__file__).resolve().parent          # …/backend
ROOT_DIR = BASE_DIR.parent                           # project root (static site)
STATIC_DIR = BASE_DIR / "static"                     # admin panel assets

# Load backend/.env then fall back to a root .env if present.
load_dotenv(BASE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env")

# Files we are willing to serve from the site root.
ALLOWED_STATIC_EXT = {
    ".html", ".css", ".js", ".mjs", ".json", ".map",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".txt", ".xml", ".webmanifest", ".pdf",
}

# Never expose backend source or secrets through the static handler.
BLOCKED_PREFIXES = {"backend", "admin", "api", ".git", ".env", "__pycache__", "venv", ".venv"}


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder=None)

    app.config.update(
        SECRET_KEY=os.getenv("SECRET_KEY", "dev-secret-change-me"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "0") == "1",
        PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 7,  # 7 days
        MAX_CONTENT_LENGTH=2 * 1024 * 1024,
        JSON_SORT_KEYS=False,
    )

    try:
        init_pool()
        init_schema()
    except Exception as exc:  # pragma: no cover - startup diagnostics
        raise RuntimeError(
            "Could not connect to PostgreSQL or initialise the schema.\n"
            "Check that PostgreSQL is running, that the database exists, and that\n"
            "the credentials in backend/.env are correct.\n"
            f"Original error: {exc}"
        ) from exc

    # ---- Compression --------------------------------------------------------
    # Text responses (HTML, CSS, JS, JSON, SVG, XML) are compressed.
    algorithms = ["gzip", "deflate"]
    try:  # brotli is optional; gzip and deflate are always available
        import brotli  # noqa: F401

        algorithms = ["br", "gzip", "deflate"]
    except ImportError:
        pass
    app.config.update(
        COMPRESS_ALGORITHM=algorithms,
        # flask-compress leaves gzip out of its streaming default, and
        # send_from_directory responses are streamed — without this, pages and
        # static files would only ever be compressed for clients that *also*
        # accept brotli/zstd.
        COMPRESS_ALGORITHM_STREAMING=algorithms,
        COMPRESS_MIN_SIZE=256,
        COMPRESS_MIMETYPES=[
            "text/html",
            "text/css",
            "text/plain",
            "text/xml",
            "text/javascript",
            "application/javascript",
            "application/json",
            "application/xml",
            "application/rss+xml",
            "image/svg+xml",
        ],
    )
    Compress(app)

    # ---- Behind a reverse proxy --------------------------------------------
    # Set TRUST_PROXY=1 when nginx/caddy terminates TLS in front of this app, so
    # redirects and absolute URLs are built with the public https:// scheme.
    if os.getenv("TRUST_PROXY", "0") == "1":
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # ---- Caching and security headers --------------------------------------
    ASSET_CACHE = "public, max-age=604800"          # images, fonts, favicons
    CODE_CACHE = "public, max-age=3600"             # css, js
    PAGE_CACHE = "public, max-age=0, must-revalidate"

    @app.after_request
    def _response_headers(resp):
        path = request.path
        if path.startswith("/admin") or path.startswith("/api/"):
            resp.headers["Cache-Control"] = "no-store"
        elif path.startswith("/assets/"):
            resp.headers["Cache-Control"] = ASSET_CACHE
        elif path.startswith(("/css/", "/js/")):
            resp.headers["Cache-Control"] = CODE_CACHE
        else:
            # Werkzeug already sets no-cache on send_from_directory responses;
            # assign (not setdefault) so the policy is explicit and uniform.
            resp.headers["Cache-Control"] = PAGE_CACHE

        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        if request.is_secure:
            resp.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return resp

    app.jinja_env.globals["csrf_token"] = get_csrf_token

    @app.context_processor
    def inject_admin_globals():
        """Expose the unread-inquiry count to admin templates."""
        if not session.get("admin_user"):
            return {}
        try:
            count = query_one("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'")["n"]
        except Exception:
            count = 0
        return {"new_inquiry_count": count}

    app.register_blueprint(api_bp)
    app.register_blueprint(admin_bp)

    # ---- Admin panel -------------------------------------------------------
    @app.get("/admin")
    def admin_redirect():
        return redirect(url_for("admin.dashboard"))

    @app.get("/admin/static/<path:filename>")
    def admin_static(filename: str):
        return send_from_directory(STATIC_DIR, filename)

    # ---- Static site -------------------------------------------------------
    @app.get("/")
    def index():
        return send_from_directory(ROOT_DIR, "index.html")

    @app.get("/article.html")
    def article_page():
        """Send the canonical URL for an article that has its own static page.

        Every published article is generated to ``<slug>.html`` by
        ``backend.build``; this keeps the legacy ``/article.html?slug=…``
        addresses working without competing with them in search results.
        """
        slug = (request.args.get("slug") or "").strip()
        if slug:
            try:
                row = query_one(
                    "SELECT external_url FROM articles WHERE slug = %s AND status = 'published'",
                    (slug,),
                )
            except Exception:  # pragma: no cover - database unavailable
                row = None
            target = (row or {}).get("external_url") if row else None
            if target:
                if target.startswith(("http://", "https://")):
                    return redirect(target, code=301)
                return redirect("/" + target.lstrip("/"), code=301)
        return send_from_directory(ROOT_DIR, "article.html")

    @app.get("/<path:path>")
    def static_files(path: str):
        # /index.html duplicates /
        if path.replace("\\", "/").strip("/") == "index.html":
            return redirect("/", code=308)

        normalized = path.replace("\\", "/").strip("/")
        if not normalized:
            abort(404)

        # A trailing slash on a file path (/services.html/) is a duplicate URL.
        if path.endswith("/"):
            return redirect("/" + normalized, code=308)

        parts = normalized.split("/")
        if any(part in ("", ".", "..") for part in parts):
            abort(404)
        if parts[0] in BLOCKED_PREFIXES:
            abort(404)

        target = (ROOT_DIR / normalized).resolve()
        try:
            target.relative_to(ROOT_DIR)
        except ValueError:
            abort(404)
        if not target.is_file() or target.suffix.lower() not in ALLOWED_STATIC_EXT:
            abort(404)

        # Case-insensitive filesystems (Windows, macOS) happily serve
        # /SERVICES.HTML — send the visitor to the real file name instead.
        actual = target.relative_to(ROOT_DIR).as_posix()
        if actual != normalized:
            return redirect("/" + actual, code=308)

        return send_from_directory(ROOT_DIR, normalized)

    # ---- Error handling ----------------------------------------------------
    def redirect_to_login():
        return redirect(url_for("admin.login"))

    @app.errorhandler(404)
    def not_found(_err):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found"}), 404
        try:
            page = (ROOT_DIR / "404.html").read_text(encoding="utf-8")
        except OSError:
            page = (
                "<h1>404 — Not found</h1>"
                "<p>The page you requested does not exist.</p>"
                "<p><a href='/'>Back to home</a></p>"
            )
        return page, 404

    @app.errorhandler(400)
    def bad_request(err):
        if request.path.startswith("/api/"):
            return jsonify({"error": getattr(err, "description", "Bad request")}), 400
        return (
            f"<h1>400 — Bad request</h1><p>{getattr(err, 'description', '')}</p>",
            400,
        )

    @app.errorhandler(401)
    def unauthorized(_err):
        return redirect_to_login()

    @app.errorhandler(403)
    def forbidden(_err):
        return ("<h1>403 — Forbidden</h1>", 403)

    return app
