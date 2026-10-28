from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Timer
from urllib.parse import urlparse, parse_qs, unquote
import os
import socket
import webbrowser
import json
import secrets

HOST = "127.0.0.1"
START_PORT = 8080
END_PORT = 8090
ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

# Credenciais locais. Podem ser substituídas por variáveis de ambiente.
ADMIN_USER = os.environ.get("POLIEDRO_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("POLIEDRO_ADMIN_PASSWORD", "PoliedroSkills2026")
SESSION_TOKEN = secrets.token_urlsafe(32)
PROTECTED_PAGES = {"/admin.html", "/inscricoes.html", "/painel.html"}


def is_protected_path(path: str) -> bool:
    clean_path = "/" + unquote(path).strip("/").lower()
    return clean_path in PROTECTED_PAGES


def available_port():
    for port in range(START_PORT, END_PORT + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind((HOST, port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"Nenhuma porta disponível entre {START_PORT} e {END_PORT}.")


def is_authenticated(headers):
    cookie = headers.get("Cookie", "")
    parts = [p.strip() for p in cookie.split(";") if "=" in p]
    cookies = dict(p.split("=", 1) for p in parts)
    return secrets.compare_digest(cookies.get("poliedro_admin_session", ""), SESSION_TOKEN)


class PoliedroHandler(SimpleHTTPRequestHandler):
    def _json(self, status, payload, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)

        if path == "/api/session":
            return self._json(200, {"authenticated": is_authenticated(self.headers)})

        if is_protected_path(path) and not is_authenticated(self.headers):
            next_page = path.lstrip("/")
            self.send_response(302)
            self.send_header("Location", f"/login.html?next={next_page}")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"

        if path == "/api/login":
            try:
                data = json.loads(raw.decode("utf-8") or "{}")
            except (json.JSONDecodeError, UnicodeDecodeError):
                return self._json(400, {"ok": False, "message": "Dados de login inválidos."})

            user_ok = secrets.compare_digest(str(data.get("usuario", "")), ADMIN_USER)
            pass_ok = secrets.compare_digest(str(data.get("senha", "")), ADMIN_PASSWORD)
            if not (user_ok and pass_ok):
                return self._json(401, {"ok": False, "message": "Usuário ou senha incorretos."})

            return self._json(200, {"ok": True}, {
                "Set-Cookie": f"poliedro_admin_session={SESSION_TOKEN}; HttpOnly; SameSite=Lax; Path=/"
            })

        if path == "/api/logout":
            return self._json(200, {"ok": True}, {
                "Set-Cookie": "poliedro_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
            })

        self.send_error(404, "Endpoint não encontrado")


if __name__ == "__main__":
    port = available_port()
    url = f"http://{HOST}:{port}/index.html"
    server = ThreadingHTTPServer((HOST, port), PoliedroHandler)
    Timer(0.8, lambda: webbrowser.open(url)).start()
    print(f"Poliedro Skills V4.20 disponível em {url}")
    print("Acesso protegido: Administração, Inscrições e Painel do Árbitro")
    print("Pressione Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()
