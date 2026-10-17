"""Small management CLI.

Usage (run from the project root):
    python -m backend.manage init-db          # create tables + seed data
    python -m backend.manage hash "secret"    # generate an ADMIN_PASSWORD_HASH value
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before reading any configuration.
load_dotenv(Path(__file__).resolve().parent / ".env")

from .db import close_pool, init_pool, init_schema  # noqa: E402


def cmd_init_db() -> int:
    init_pool()
    init_schema()
    close_pool()
    print("Database schema is up to date and seed data is in place.")
    return 0


def cmd_hash(password: str) -> int:
    from werkzeug.security import generate_password_hash

    print(generate_password_hash(password))
    print("\nPut the line above into backend/.env as ADMIN_PASSWORD_HASH=…", file=sys.stderr)
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="backend.manage", description="Backend utilities")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="Create tables and seed default content")
    hash_parser = sub.add_parser("hash", help="Hash a password for ADMIN_PASSWORD_HASH")
    hash_parser.add_argument("password", help="The plain password to hash")

    args = parser.parse_args(argv)

    if args.command == "init-db":
        return cmd_init_db()
    if args.command == "hash":
        return cmd_hash(args.password)
    parser.error("unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
