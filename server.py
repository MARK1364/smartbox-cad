"""
SmartBox Web - Local Development Server
Serwer HTTP z CORS i MIME type dla WASM.
Uruchom: python server.py
"""

import http.server
import socketserver
import os
import sys
import webbrowser
import socket

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class SmartBoxHandler(http.server.SimpleHTTPRequestHandler):
    """Handler z poprawnym MIME type dla WASM i CORS headers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.wasm': 'application/wasm',
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
    }

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        print(f"  {args[0]}")


def find_free_port(start_port, max_attempts=10):
    """Szuka wolnego portu zaczynajac od start_port."""
    for offset in range(max_attempts):
        port = start_port + offset
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('', port))
                return port
            except OSError:
                continue
    return None


def main():
    os.chdir(DIRECTORY)

    port = find_free_port(PORT)
    if port is None:
        print(f"  BLAD: Nie znaleziono wolnego portu ({PORT}-{PORT+9})")
        input("  Nacisnij Enter...")
        sys.exit(1)

    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", port), SmartBoxHandler) as httpd:
        url = f"http://localhost:{port}"
        print(f"")
        print(f"  +--------------------------------------+")
        print(f"  |   SmartBox Web Dev Server            |")
        print(f"  |   {url:<35s}|")
        print(f"  |   Ctrl+C aby zatrzymac               |")
        print(f"  +--------------------------------------+")
        print(f"")

        # Auto-otworz przegladarke
        webbrowser.open(url)

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Serwer zatrzymany.")
            sys.exit(0)


if __name__ == "__main__":
    main()
