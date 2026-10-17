"""Text helpers shared by the API and admin panel."""

from __future__ import annotations

import re
import unicodedata


def slugify(value: str) -> str:
    """Turn arbitrary text into a URL-safe slug."""
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    value = re.sub(r"[\s_-]+", "-", value)
    return value.strip("-")


def unique_slug(base: str, exists) -> str:
    """Return a slug that is unique according to ``exists(slug) -> bool``."""
    slug = slugify(base) or "item"
    candidate = slug
    n = 2
    while exists(candidate):
        candidate = f"{slug}-{n}"
        n += 1
    return candidate


def excerpt_from(content: str, length: int = 180) -> str:
    """Build a plain-text excerpt from HTML/markdown-ish content."""
    text = re.sub(r"<[^>]+>", " ", content or "")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= length:
        return text
    return text[: length - 1].rsplit(" ", 1)[0] + "…"
