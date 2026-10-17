"""Development entry point.

Run from the project root:

    python run.py

The site is then available at http://127.0.0.1:5000/ and the admin panel at
http://127.0.0.1:5000/admin
"""

from __future__ import annotations

import os

from backend.app import create_app

app = create_app()

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    print(f"\n  Site:  http://{host}:{port}/")
    print(f"  Admin: http://{host}:{port}/admin\n")
    app.run(host=host, port=port, debug=debug)
