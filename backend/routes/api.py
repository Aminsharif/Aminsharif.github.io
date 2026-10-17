"""Public JSON API consumed by the static site (insights + contact form)."""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..db import execute, query_all, query_one

api_bp = Blueprint("api", __name__, url_prefix="/api")

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

ARTICLE_COLUMNS = """
    a.id, a.title, a.slug, a.excerpt, a.cover_image, a.read_time, a.status,
    a.external_url, a.published_at, a.created_at, a.updated_at,
    c.name AS category_name, c.slug AS category_slug
"""


def _article_url(row) -> str:
    if row.get("external_url"):
        return row["external_url"]
    return f"/article.html?slug={row['slug']}"


def _serialize_article(row, include_content: bool = False) -> dict:
    data = {
        "id": row["id"],
        "title": row["title"],
        "slug": row["slug"],
        "excerpt": row["excerpt"],
        "coverImage": row["cover_image"],
        "readTime": row["read_time"],
        "status": row["status"],
        "externalUrl": row["external_url"],
        "url": _article_url(row),
        "category": (
            {"name": row["category_name"], "slug": row["category_slug"]}
            if row.get("category_name")
            else None
        ),
        "publishedAt": row["published_at"].isoformat() if row["published_at"] else None,
        "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
    if include_content:
        data["content"] = row["content"]
        data["metaTitle"] = row["meta_title"]
        data["metaDescription"] = row["meta_description"]
    return data


@api_bp.after_request
def _cors(resp):
    """Optional CORS when the static site is hosted on a different origin."""
    origins = (os.getenv("CORS_ORIGINS") or "").strip()
    if not origins:
        return resp
    allowed = [o.strip() for o in origins.split(",") if o.strip()]
    origin = request.headers.get("Origin")
    if origin in allowed:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok", "time": datetime.now(timezone.utc).isoformat()})


@api_bp.get("/categories")
def list_categories():
    rows = query_all(
        """
        SELECT c.id, c.name, c.slug, COUNT(a.id) AS article_count
        FROM categories c
        LEFT JOIN articles a
               ON a.category_id = c.id AND a.status = 'published'
        GROUP BY c.id
        ORDER BY c.name
        """
    )
    return jsonify({"categories": [dict(r) for r in rows]})


@api_bp.get("/articles")
def list_articles():
    try:
        limit = min(max(int(request.args.get("limit", 50)), 1), 200)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify({"error": "limit and offset must be integers"}), 400

    category = (request.args.get("category") or "").strip()
    search = (request.args.get("search") or "").strip()

    where = ["a.status = 'published'"]
    params: list = []
    if category:
        where.append("c.slug = %s")
        params.append(category)
    if search:
        where.append("(a.title ILIKE %s OR a.excerpt ILIKE %s)")
        like = f"%{search}%"
        params.extend([like, like])

    where_sql = " AND ".join(where)

    total = query_one(
        f"""
        SELECT COUNT(*) AS n
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        WHERE {where_sql}
        """,
        tuple(params),
    )["n"]

    rows = query_all(
        f"""
        SELECT {ARTICLE_COLUMNS}
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        WHERE {where_sql}
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params) + (limit, offset),
    )

    return jsonify(
        {
            "total": total,
            "limit": limit,
            "offset": offset,
            "articles": [_serialize_article(r) for r in rows],
        }
    )


@api_bp.get("/articles/<slug>")
def get_article(slug: str):
    row = query_one(
        f"""
        SELECT {ARTICLE_COLUMNS}, a.content, a.meta_title, a.meta_description
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        WHERE a.slug = %s AND a.status = 'published'
        """,
        (slug,),
    )
    if not row:
        return jsonify({"error": "Article not found"}), 404
    return jsonify({"article": _serialize_article(row, include_content=True)})


@api_bp.post("/inquiries")
def create_inquiry():
    data = request.get_json(silent=True)
    if data is None:
        data = request.form.to_dict()

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    message = (data.get("message") or "").strip()
    company = (data.get("company") or "").strip()
    service = (data.get("service") or "").strip()
    budget = (data.get("budget") or "").strip()
    contact_method = (data.get("contact_method") or "").strip()

    errors = {}
    if len(name) < 2:
        errors["name"] = "Please enter your name (at least 2 characters)."
    if not EMAIL_RE.match(email):
        errors["email"] = "Please enter a valid email address."
    if len(message) < 10:
        errors["message"] = "Please describe your project in at least 10 characters."
    if not service:
        errors["service"] = "Please choose a service."

    if errors:
        return jsonify({"error": "Validation failed", "errors": errors}), 400

    forwarded = request.headers.get("X-Forwarded-For", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.remote_addr or "")
    user_agent = (request.headers.get("User-Agent") or "")[:512]

    row = execute(
        """
        INSERT INTO inquiries
            (name, email, company, service, message, budget, contact_method, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, created_at
        """,
        (name, email, company, service, message, budget, contact_method, ip, user_agent),
    )

    return (
        jsonify(
            {
                "success": True,
                "id": row["id"],
                "message": "Thank you — your inquiry was received.",
            }
        ),
        201,
    )
