-- ============================================================================
--  Amin Sharif — database schema
--  Idempotent: safe to run on every startup (CREATE ... IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
    id               SERIAL PRIMARY KEY,
    title            TEXT        NOT NULL,
    slug             TEXT        NOT NULL UNIQUE,
    excerpt          TEXT        NOT NULL DEFAULT '',
    content          TEXT        NOT NULL DEFAULT '',
    category_id      INTEGER     REFERENCES categories(id) ON DELETE SET NULL,
    cover_image      TEXT,
    read_time        INTEGER     NOT NULL DEFAULT 5,
    status           TEXT        NOT NULL DEFAULT 'published',   -- published | draft
    external_url     TEXT,                                       -- link to a hand-built page instead of a DB article
    meta_title       TEXT,
    meta_description TEXT,
    published_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_articles_status   ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

CREATE TABLE IF NOT EXISTS inquiries (
    id             SERIAL PRIMARY KEY,
    name           TEXT        NOT NULL,
    email          TEXT        NOT NULL,
    company        TEXT,
    service        TEXT,
    message        TEXT        NOT NULL,
    budget         TEXT,
    contact_method TEXT,
    status         TEXT        NOT NULL DEFAULT 'new',   -- new | read | archived
    ip_address     TEXT,
    user_agent     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status  ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);
