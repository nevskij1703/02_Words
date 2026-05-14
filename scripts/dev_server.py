# dev_server.py — статический сервер с отключённым кэшем для разработки.
# Запуск: python scripts/dev_server.py
# По умолчанию слушает порт 8000.

import http.server
import socketserver
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Полный запрет кэширования — браузер всегда забирает свежие модули.
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


# Скрипт запускается из любой директории — переключаемся в корень проекта.
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Serving with no-cache on http://localhost:{PORT}')
    print(f'Project root: {os.getcwd()}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')
