"""Production entry point (Waitress).

Run from the project root:

    python serve.py

Waitress is a pure-Python WSGI server, so the same command works on Windows and
on Linux. It is what should sit behind nginx/caddy (or in front of the public
internet directly) — ``run.py`` is the development server.

Environment variables:

    HOST     interface to bind   (default 0.0.0.0)
    PORT     port to bind        (default 5000)
    THREADS  worker threads      (default 8)
    TRUST_PROXY=1  when a reverse proxy terminates TLS in front of this app

Equivalent one-liner, if you prefer the console script:

    waitress-serve --call --threads=8 --listen=0.0.0.0:5000 backend.app:create_app
"""

from __future__ import annotations

import os

from waitress import serve

from backend.app import create_app

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    threads = int(os.getenv("THREADS", "8"))

    app = create_app()
    print(f"\n  Site:   http://{host}:{port}/")
    print(f"  Admin:  http://{host}:{port}/admin")
    print(f"  Server: waitress, {threads} threads\n")
    serve(app, host=host, port=port, threads=threads)
