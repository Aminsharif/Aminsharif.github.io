"""Admin panel: article/category management and project inquiry inbox."""

from __future__ import annotations

from datetime import datetime

from flask import (
    Blueprint,
    abort,
    flash,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from ..auth import check_csrf, login_required, verify_credentials
from ..db import execute, query_all, query_one
from ..utils import excerpt_from, slugify, unique_slug

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

STATUSES = ("published", "draft")
INQUIRY_STATUSES = ("new", "read", "archived")


# ---------------------------------------------------------------------------
#  Guards
# ---------------------------------------------------------------------------
@admin_bp.before_request
def _protect():
    # Login/logout endpoints are reachable without a session.
    if request.endpoint in {"admin.login", "admin.logout"}:
        if request.method == "POST":
            check_csrf()
        return
    if request.method == "POST":
        if not session.get("admin_user"):
            abort(401)
        check_csrf()


# ---------------------------------------------------------------------------
#  Auth
# ---------------------------------------------------------------------------
@admin_bp.route("/login", methods=["GET", "POST"])
def login():
    if session.get("admin_user"):
        return redirect(url_for("admin.dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if verify_credentials(username, password):
            session.clear()
            session["admin_user"] = username
            session.permanent = True
            flash("Welcome back.", "success")
            nxt = request.args.get("next") or url_for("admin.dashboard")
            if not nxt.startswith("/"):
                nxt = url_for("admin.dashboard")
            return redirect(nxt)
        flash("Incorrect username or password.", "error")

    return render_template("admin/login.html")


@admin_bp.get("/logout")
def logout():
    session.clear()
    flash("You have been signed out.", "success")
    return redirect(url_for("admin.login"))


# ---------------------------------------------------------------------------
#  Dashboard
# ---------------------------------------------------------------------------
@admin_bp.get("/")
@login_required
def dashboard():
    stats = {
        "articles": query_one("SELECT COUNT(*) AS n FROM articles")["n"],
        "published": query_one("SELECT COUNT(*) AS n FROM articles WHERE status='published'")["n"],
        "drafts": query_one("SELECT COUNT(*) AS n FROM articles WHERE status='draft'")["n"],
        "categories": query_one("SELECT COUNT(*) AS n FROM categories")["n"],
        "inquiries": query_one("SELECT COUNT(*) AS n FROM inquiries")["n"],
        "new_inquiries": query_one("SELECT COUNT(*) AS n FROM inquiries WHERE status='new'")["n"],
    }
    recent_inquiries = query_all(
        "SELECT id, name, email, service, status, created_at FROM inquiries ORDER BY created_at DESC LIMIT 6"
    )
    recent_articles = query_all(
        """
        SELECT a.id, a.title, a.status, a.published_at, c.name AS category_name
        FROM articles a LEFT JOIN categories c ON c.id = a.category_id
        ORDER BY a.updated_at DESC LIMIT 6
        """
    )
    return render_template(
        "admin/dashboard.html",
        stats=stats,
        recent_inquiries=recent_inquiries,
        recent_articles=recent_articles,
        active="dashboard",
    )


# ---------------------------------------------------------------------------
#  Articles
# ---------------------------------------------------------------------------
def _categories():
    return query_all("SELECT id, name, slug FROM categories ORDER BY name")


def _rebuild_static_pages() -> None:
    """Regenerate the static article pages after a publish/edit/delete.

    Best effort: a build problem must never block the admin action.
    """
    try:
        from ..build import run as build_run

        build_run(check=False)
    except Exception as exc:  # pragma: no cover - diagnostics only
        flash(f"Saved, but regenerating the static article pages failed: {exc}", "error")


@admin_bp.get("/articles")
@login_required
def articles():
    rows = query_all(
        """
        SELECT a.id, a.title, a.slug, a.status, a.read_time, a.external_url,
               a.published_at, a.updated_at, c.name AS category_name
        FROM articles a LEFT JOIN categories c ON c.id = a.category_id
        ORDER BY a.updated_at DESC
        """
    )
    return render_template("admin/articles.html", articles=rows, active="articles")


def _resolve_category(form) -> "int | None":
    """Return a category id from either the select or the 'new category' field."""
    new_name = (form.get("new_category") or "").strip()
    if new_name:
        base = slugify(new_name)
        existing = query_one("SELECT id FROM categories WHERE slug = %s", (base,))
        if existing:
            return existing["id"]
        row = execute(
            "INSERT INTO categories (name, slug) VALUES (%s, %s) RETURNING id",
            (new_name, base or "category"),
        )
        return row["id"]

    value = (form.get("category_id") or "").strip()
    if value.isdigit():
        return int(value)
    return None


def _parse_dt(value: str):
    value = (value or "").strip()
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _save_article(article_id=None):
    form = request.form
    title = (form.get("title") or "").strip()
    content = form.get("content") or ""

    if not title:
        flash("A title is required.", "error")
        return None

    slug = slugify(form.get("slug") or title)

    def slug_taken(candidate: str) -> bool:
        if article_id:
            row = query_one(
                "SELECT id FROM articles WHERE slug = %s AND id <> %s", (candidate, article_id)
            )
        else:
            row = query_one("SELECT id FROM articles WHERE slug = %s", (candidate,))
        return row is not None

    slug = unique_slug(slug, slug_taken)

    category_id = _resolve_category(form)
    excerpt = (form.get("excerpt") or "").strip() or excerpt_from(content)
    read_time = form.get("read_time", "5")
    try:
        read_time = max(1, int(read_time))
    except ValueError:
        read_time = 5
    status = form.get("status", "published")
    if status not in STATUSES:
        status = "published"
    external_url = (form.get("external_url") or "").strip() or None
    cover_image = (form.get("cover_image") or "").strip() or None
    meta_title = (form.get("meta_title") or "").strip() or None
    meta_description = (form.get("meta_description") or "").strip() or None
    published_at = _parse_dt(form.get("published_at"))

    fields = (
        title, slug, excerpt, content, category_id, cover_image, read_time,
        status, external_url, meta_title, meta_description,
    )

    if article_id:
        execute(
            """
            UPDATE articles SET
                title=%s, slug=%s, excerpt=%s, content=%s, category_id=%s,
                cover_image=%s, read_time=%s, status=%s, external_url=%s,
                meta_title=%s, meta_description=%s,
                published_at=COALESCE(%s, published_at), updated_at=now()
            WHERE id=%s
            """,
            fields + (published_at, article_id),
        )
    else:
        row = execute(
            """
            INSERT INTO articles
                (title, slug, excerpt, content, category_id, cover_image, read_time,
                 status, external_url, meta_title, meta_description, published_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,COALESCE(%s, now()))
            RETURNING id
            """,
            fields + (published_at,),
        )
        article_id = row["id"]

    return article_id


@admin_bp.route("/articles/new", methods=["GET", "POST"])
@login_required
def article_new():
    if request.method == "POST":
        article_id = _save_article()
        if article_id:
            _rebuild_static_pages()
            flash("Article created.", "success")
            return redirect(url_for("admin.articles"))
        return redirect(url_for("admin.article_new"))

    return render_template(
        "admin/article_form.html",
        article=None,
        categories=_categories(),
        active="articles",
        now=datetime.now(),
    )


@admin_bp.route("/articles/<int:article_id>/edit", methods=["GET", "POST"])
@login_required
def article_edit(article_id: int):
    article = query_one("SELECT * FROM articles WHERE id = %s", (article_id,))
    if not article:
        abort(404)

    if request.method == "POST":
        saved = _save_article(article_id)
        if saved:
            _rebuild_static_pages()
            flash("Article updated.", "success")
            return redirect(url_for("admin.articles"))
        return redirect(url_for("admin.article_edit", article_id=article_id))

    return render_template(
        "admin/article_form.html",
        article=article,
        categories=_categories(),
        active="articles",
        now=datetime.now(),
    )


@admin_bp.post("/articles/<int:article_id>/delete")
@login_required
def article_delete(article_id: int):
    execute("DELETE FROM articles WHERE id = %s", (article_id,))
    _rebuild_static_pages()
    flash("Article deleted.", "success")
    return redirect(url_for("admin.articles"))


# ---------------------------------------------------------------------------
#  Categories
# ---------------------------------------------------------------------------
@admin_bp.route("/categories", methods=["GET", "POST"])
@login_required
def categories():
    if request.method == "POST":
        name = (request.form.get("name") or "").strip()
        if not name:
            flash("A category name is required.", "error")
        else:
            slug = slugify(name)
            if query_one("SELECT id FROM categories WHERE slug = %s", (slug,)):
                flash("That category already exists.", "error")
            else:
                execute("INSERT INTO categories (name, slug) VALUES (%s, %s)", (name, slug))
                flash("Category added.", "success")
        return redirect(url_for("admin.categories"))

    rows = query_all(
        """
        SELECT c.id, c.name, c.slug, COUNT(a.id) AS article_count
        FROM categories c LEFT JOIN articles a ON a.category_id = c.id
        GROUP BY c.id ORDER BY c.name
        """
    )
    return render_template("admin/categories.html", categories=rows, active="categories")


@admin_bp.post("/categories/<int:category_id>/delete")
@login_required
def category_delete(category_id: int):
    execute("DELETE FROM categories WHERE id = %s", (category_id,))
    flash("Category deleted. Its articles were kept.", "success")
    return redirect(url_for("admin.categories"))


# ---------------------------------------------------------------------------
#  Inquiries
# ---------------------------------------------------------------------------
@admin_bp.get("/inquiries")
@login_required
def inquiries():
    status = (request.args.get("status") or "").strip()
    if status in INQUIRY_STATUSES:
        rows = query_all(
            "SELECT * FROM inquiries WHERE status = %s ORDER BY created_at DESC", (status,)
        )
    else:
        status = ""
        rows = query_all("SELECT * FROM inquiries ORDER BY created_at DESC")
    return render_template(
        "admin/inquiries.html", inquiries=rows, status=status, active="inquiries"
    )


@admin_bp.get("/inquiries/<int:inquiry_id>")
@login_required
def inquiry_detail(inquiry_id: int):
    inquiry = query_one("SELECT * FROM inquiries WHERE id = %s", (inquiry_id,))
    if not inquiry:
        abort(404)
    # Mark as read on first open.
    if inquiry["status"] == "new":
        execute("UPDATE inquiries SET status = 'read' WHERE id = %s", (inquiry_id,))
        inquiry = dict(inquiry)
        inquiry["status"] = "read"
    return render_template(
        "admin/inquiry_detail.html", inquiry=inquiry, active="inquiries"
    )


@admin_bp.post("/inquiries/<int:inquiry_id>/status")
@login_required
def inquiry_status(inquiry_id: int):
    status = (request.form.get("status") or "").strip()
    if status in INQUIRY_STATUSES:
        execute("UPDATE inquiries SET status = %s WHERE id = %s", (status, inquiry_id))
        flash("Inquiry marked as " + status + ".", "success")
    return redirect(request.referrer or url_for("admin.inquiries"))


@admin_bp.post("/inquiries/<int:inquiry_id>/delete")
@login_required
def inquiry_delete(inquiry_id: int):
    execute("DELETE FROM inquiries WHERE id = %s", (inquiry_id,))
    flash("Inquiry deleted.", "success")
    return redirect(url_for("admin.inquiries"))
