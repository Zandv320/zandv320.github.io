#!/usr/bin/env python3
"""Static dev server for the arcade site without Node.

On this machine `npm` is a ddev wrapper and Node is not installed, so Vite cannot run locally.
This server serves the repo directory and injects an import map into Eldoria's index.html that points
`three` and `three/addons/` at jsdelivr, using exactly the version from package.json.

Usage:  python3 -I runeveld/tools/dev_server.py [port]      (default 8765)
Then:   http://localhost:<port>/runeveld/
"""

import http.server
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
THREE_VERSION = json.loads((ROOT / "package.json").read_text())["dependencies"]["three"]
CDN = f"https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}"
IMPORTS = {"three": f"{CDN}/build/three.module.js", "three/addons/": f"{CDN}/examples/jsm/"}
IMPORT_MAP = '<script type="importmap">' + json.dumps({"imports": IMPORTS}, separators=(",", ":")) + "</script>\n"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):  # noqa: N802 (name defined by http.server)
        path = self.path.split("?")[0]
        if path in ("/runeveld/", "/runeveld/index.html"):
            html = (ROOT / "runeveld/index.html").read_text()
            html = html.replace('<script type="module"', IMPORT_MAP + '<script type="module"', 1).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return
        super().do_GET()

    def log_message(self, format, *args):
        if "404" in str(args):
            super().log_message(format, *args)


def main():
    print(f"Arcade dev server at http://localhost:{PORT}/runeveld/ (three {THREE_VERSION})", flush=True)
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
