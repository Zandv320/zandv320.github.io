#!/usr/bin/env python3
"""Statische dev-server voor de Speelhal zonder Node.

Op deze machine is `npm` een ddev-wrapper en staat geen Node, dus Vite kan niet lokaal draaien.
Deze server serveert de repo-map en voegt in de index.html van Runeveld een importmap in die
`three` en `three/addons/` naar jsdelivr laat wijzen, precies de versie uit package.json.

Gebruik:  python3 -I runeveld/tools/dev_server.py [poort]      (standaard 8765)
Dan:      http://localhost:<poort>/runeveld/
"""
import http.server, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
POORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
VERSIE = json.loads((ROOT / 'package.json').read_text())['dependencies']['three']
IMPORTMAP = ('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@%s/build/three.module.js",'
             '"three/addons/":"https://cdn.jsdelivr.net/npm/three@%s/examples/jsm/"}}</script>\n' % (VERSIE, VERSIE))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        pad = self.path.split('?')[0]
        if pad in ('/runeveld/', '/runeveld/index.html'):
            html = (ROOT / 'runeveld/index.html').read_text()
            html = html.replace('<script type="module"', IMPORTMAP + '<script type="module"', 1).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        if '404' in str(args):
            super().log_message(fmt, *args)


print(f'Speelhal dev-server op http://localhost:{POORT}/runeveld/ (three {VERSIE})', flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1', POORT), Handler).serve_forever()
