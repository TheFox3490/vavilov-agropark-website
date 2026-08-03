#!/bin/sh
# Ждёт базу, накатывает миграции, заполняет справочники — и только потом стартует.
set -e

echo "Жду PostgreSQL..."
python - <<'PY'
import os, time, socket, urllib.parse

url = os.environ.get("DATABASE_URL", "")
parsed = urllib.parse.urlparse(url)
host, port = parsed.hostname or "db", parsed.port or 5432

for attempt in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"PostgreSQL доступен на {host}:{port}")
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit(f"PostgreSQL на {host}:{port} не поднялся за 60 секунд")
PY

echo "Накатываю миграции..."
flask db upgrade

echo "Заполняю справочники..."
flask seed

echo "Запускаю: $*"
exec "$@"
