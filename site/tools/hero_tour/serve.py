# Static server for the capture: like `python3 -m http.server`, but sends charset=utf-8 with HTML,
# JS, JSON and text, as GitHub Pages does (the callus viewer has no <meta charset>, so without it
# Chrome decodes the page as windows-1252 and every Turkish character breaks).
# Usage: python3 serve.py <folder> [port]
import functools
import http.server
import sys

root = sys.argv[1]
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8790


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
    }

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=root)).serve_forever()
