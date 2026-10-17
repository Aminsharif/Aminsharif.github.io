"""PostgreSQL access layer.

A small thread-safe connection pool plus helpers. Configuration is read from
environment variables (loaded from ``backend/.env`` by :mod:`backend.app`).
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

SCHEMA_FILE = Path(__file__).resolve().parent / "schema.sql"

_pool: Optional[pool.ThreadedConnectionPool] = None


def database_url() -> str:
    """Build the connection string from DATABASE_URL or the PG* variables."""
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url:
        return url
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    name = os.getenv("PGDATABASE", "aminsharif")
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "postgres")
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


def init_pool() -> pool.ThreadedConnectionPool:
    """Create the global connection pool on first use."""
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(1, 10, dsn=database_url())
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def get_conn() -> Iterator["psycopg2.extensions.connection"]:
    """Yield a pooled connection, committing on success and rolling back on error."""
    conn = init_pool().getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        init_pool().putconn(conn)


@contextmanager
def get_cursor() -> Iterator[RealDictCursor]:
    """Yield a dict-returning cursor bound to a pooled connection."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur


def query_all(sql: str, params: tuple = ()) -> list:
    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def query_one(sql: str, params: tuple = ()):
    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def execute(sql: str, params: tuple = ()):
    with get_cursor() as cur:
        cur.execute(sql, params)
        if cur.description:
            return cur.fetchone()
        return None


def init_schema() -> None:
    """Create tables and seed default content if the database is empty."""
    sql = SCHEMA_FILE.read_text(encoding="utf-8")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
    seed_defaults()


# Default content inserted only into an empty database, so deleting an article
# or category in the admin panel is permanent (it will not come back on restart).
SEED_CATEGORIES = [
    ("n8n", "n8n"),
    ("Comparison", "comparison"),
    ("HubSpot", "hubspot"),
    ("AI Voice", "ai-voice"),
    ("Reliability", "reliability"),
]

SEED_ARTICLES = [
    (
        "How to automate lead management with n8n",
        "automate-lead-management-with-n8n",
        "A practical walkthrough of capturing, enriching, scoring and routing leads, then triggering follow-ups without manual entry.",
        "n8n", 6, "automate-lead-management-with-n8n.html",
    ),
    (
        "n8n vs Zapier vs Make for business automation",
        "n8n-vs-zapier-vs-make",
        "An honest comparison of the three platforms — flexibility, hosting and pricing models — and where each one fits.",
        "comparison", 7, "n8n-vs-zapier-vs-make.html",
    ),
    (
        "How to connect n8n with HubSpot",
        "connect-n8n-with-hubspot",
        "Syncing contacts and deals, triggering follow-ups, and handling duplicates reliably between the two systems.",
        "hubspot", 6, "connect-n8n-with-hubspot.html",
    ),
    (
        "How AI voice agents handle appointment scheduling",
        "ai-voice-agent-appointment-scheduling",
        "What to get right before deploying a voice agent that books against real calendar availability.",
        "ai-voice", 7, "ai-voice-agent-appointment-scheduling.html",
    ),
    (
        "Error handling and monitoring for n8n workflows",
        "n8n-error-handling-monitoring",
        "The retries, idempotency and alerting patterns that keep production automations trustworthy.",
        "reliability", 8, "n8n-error-handling-monitoring.html",
    ),
]


def seed_defaults() -> None:
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM categories")
        if cur.fetchone()["n"] == 0:
            cur.executemany(
                "INSERT INTO categories (name, slug) VALUES (%s, %s) ON CONFLICT (slug) DO NOTHING",
                SEED_CATEGORIES,
            )

    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM articles")
        if cur.fetchone()["n"] == 0:
            for title, slug, excerpt, cat_slug, read_time, external_url in SEED_ARTICLES:
                cur.execute(
                    """
                    INSERT INTO articles
                        (title, slug, excerpt, category_id, read_time, status, external_url)
                    VALUES
                        (%s, %s, %s, (SELECT id FROM categories WHERE slug = %s), %s, 'published', %s)
                    ON CONFLICT (slug) DO NOTHING
                    """,
                    (title, slug, excerpt, cat_slug, read_time, external_url),
                )

