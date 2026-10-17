"""Authentication and CSRF helpers for the admin panel."""

from __future__ import annotations

import functools
import hmac
import os
import secrets

from flask import abort, redirect, request, session, url_for


def verify_credentials(username: str, password: str) -> bool:
    """Check a username/password pair against the configured admin account.

    Supports either ``ADMIN_PASSWORD_HASH`` (a Werkzeug password hash) or a
    plain ``ADMIN_PASSWORD``.
    """
    expected_user = os.getenv("ADMIN_USERNAME", "admin")
    user_ok = hmac.compare_digest(
        (username or "").encode("utf-8"), expected_user.encode("utf-8")
    )

    password_hash = (os.getenv("ADMIN_PASSWORD_HASH") or "").strip()
    if password_hash:
        from werkzeug.security import check_password_hash

        try:
            pass_ok = check_password_hash(password_hash, password or "")
        except Exception:
            pass_ok = False
    else:
        expected_pass = os.getenv("ADMIN_PASSWORD", "admin")
        pass_ok = hmac.compare_digest(
            (password or "").encode("utf-8"), expected_pass.encode("utf-8")
        )

    return user_ok and pass_ok


def login_required(view):
    """Redirect anonymous users to the login page."""

    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("admin_user"):
            return redirect(url_for("admin.login", next=request.full_path))
        return view(*args, **kwargs)

    return wrapped


def get_csrf_token() -> str:
    token = session.get("_csrf")
    if not token:
        token = secrets.token_urlsafe(32)
        session["_csrf"] = token
    return token


def check_csrf() -> None:
    """Abort the request unless a valid CSRF token was supplied."""
    token = session.get("_csrf")
    sent = request.form.get("_csrf") or request.headers.get("X-CSRF-Token")
    if not token or not sent or not hmac.compare_digest(token.encode("utf-8"), sent.encode("utf-8")):
        abort(400, description="Invalid or missing CSRF token. Please reload and try again.")
