#!/usr/bin/env python3
"""Serve the static RentLeaks catalog with its branded 404 response."""

from __future__ import annotations

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class RentLeaksHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_error(self, code, message=None, explain=None):
        if code != 404:
            return super().send_error(code, message, explain)

        body = (ROOT / "404.html").read_bytes()
        self.send_response(404, "Not Found")
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8123)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("", args.port), RentLeaksHandler)
    print(f"Serving RentLeaks at http://localhost:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
