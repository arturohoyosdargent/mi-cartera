import argparse
import ipaddress
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
from urllib.parse import unquote, urlsplit

folder = Path(__file__).resolve().parent
repository = folder.parent.parent
release = json.loads((repository / 'v2/app/release.json').read_text(encoding='utf-8'))
assets = ['core/partner-loans.js', 'app/date-utils-v2.js', 'app/cash-menu-v2.js', 'app/partner-loans-ui.js', 'app/dashboard-parity-v2.js']
routes = {'/source/' + relative: repository / 'v2' / relative for relative in assets}
routes['/preview.js'] = folder / 'preview.js'
policy = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'"


class PreviewHandler(BaseHTTPRequestHandler):
    def log_message(self, *_arguments):
        pass

    def respond(self, status, body, content_type):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', policy)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def do_GET(self):
        requested = unquote(urlsplit(self.path).path)
        if requested == '/':
            body = (folder / 'preview.html').read_text(encoding='utf-8').replace('__CANDIDATE_BUILD__', release['build']).encode('utf-8')
            self.respond(200, body, 'text/html; charset=utf-8')
        elif requested in routes:
            self.respond(200, routes[requested].read_bytes(), 'application/javascript; charset=utf-8')
        else:
            self.respond(404, b'Not available in isolated validation', 'text/plain; charset=utf-8')

    do_HEAD = do_GET

    def do_POST(self):
        self.respond(405, b'Read-only validation', 'text/plain; charset=utf-8')

    do_PUT = do_POST
    do_PATCH = do_POST
    do_DELETE = do_POST


def main():
    parser = argparse.ArgumentParser(description='Validacion local de Caja con datos ficticios, sin Firebase.')
    parser.add_argument('--lan', action='store_true', help='Permitir acceso del Xiaomi en la misma red privada.')
    parser.add_argument('--port', type=int, default=8765)
    arguments = parser.parse_args()
    host = '0.0.0.0' if arguments.lan else '127.0.0.1'
    with ThreadingHTTPServer((host, arguments.port), PreviewHandler) as server:
        port = server.server_port
        addresses = sorted({entry[4][0] for entry in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
            if ipaddress.ip_address(entry[4][0]).is_private and not ipaddress.ip_address(entry[4][0]).is_loopback}) if arguments.lan else []
        print(json.dumps({'build': release['build'], 'port': port, 'pc': 'http://localhost:' + str(port) + '/',
            'xiaomi': ['http://' + address + ':' + str(port) + '/' for address in addresses]}), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
