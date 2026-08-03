#!/bin/sh
# Восстановление из резервной копии, снятой tools/backup.sh
#
#     tools/restore.sh                    показать список копий
#     tools/restore.sh 20260803-141500    восстановить эту
#     tools/restore.sh последняя          восстановить самую свежую
#     tools/restore.sh 20260803-141500 --yes    без подтверждения
#
# Восстановление затирает текущее содержимое базы и папки загрузок.
# Поэтому перед разворачиванием копии снимается ещё одна, «страховочная»:
# если выяснится, что развернули не ту, будет откуда вернуться.

set -eu

cd "$(dirname "$0")/.."
[ -f docker-compose.yml ] || { echo "Запускать из папки проекта" >&2; exit 1; }

list_backups() {
    echo "Доступные копии:"
    for d in backups/[0-9]*-[0-9]*; do
        [ -d "$d" ] || continue
        printf "  %-18s %s\n" "$(basename "$d")" "$(head -1 "$d/manifest.txt" 2>/dev/null || echo '')"
    done
}

WHICH="${1:-}"
YES=""
[ "${2:-}" = "--yes" ] && YES=1

if [ -z "$WHICH" ]; then
    list_backups
    echo
    echo "Восстановить:  tools/restore.sh <имя копии>"
    exit 0
fi

if [ "$WHICH" = "последняя" ] || [ "$WHICH" = "latest" ]; then
    WHICH=$(ls -1d backups/[0-9]*-[0-9]* 2>/dev/null | sort | tail -1 | xargs -r basename)
    [ -n "$WHICH" ] || { echo "Копий нет" >&2; exit 1; }
fi

DIR="backups/$WHICH"
[ -d "$DIR" ] || { echo "Копия $WHICH не найдена" >&2; echo; list_backups; exit 1; }
[ -f "$DIR/db.sql.gz" ] || { echo "В копии нет дампа базы" >&2; exit 1; }

if ! docker compose ps --status running --services 2>/dev/null | grep -qx db; then
    echo "База не запущена. Подними стек:  docker compose up -d" >&2
    exit 1
fi

DB_NAME=$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | cut -d= -f2-)
DB_USER=$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2-)
DB_NAME=${DB_NAME:-agropark}
DB_USER=${DB_USER:-agropark}

echo "Из копии:"
sed 's/^/  /' "$DIR/manifest.txt" 2>/dev/null || true
echo
echo "Текущее содержимое базы и папки загрузок будет заменено."

if [ -z "$YES" ]; then
    printf "Продолжить? [y/N] "
    read -r answer
    case "$answer" in y|Y|yes|да) ;; *) echo "Отменено."; exit 0 ;; esac
fi

# Страховочная копия перед заменой: разворачивать не ту копию — обычное дело,
# и без этого шага откатиться было бы уже некуда.
echo "Снимаю страховочную копию текущего состояния…"
tools/backup.sh --quiet
SAFETY=$(ls -1d backups/[0-9]*-[0-9]* | sort | tail -1)
echo "  она здесь: $SAFETY"

echo "Восстанавливаю базу…"
# Пока идёт восстановление, приложение не должно писать в базу.
docker compose stop backend >/dev/null 2>&1 || true
gzip -dc "$DIR/db.sql.gz" | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -q >/dev/null

if [ -f "$DIR/uploads.tar.gz" ]; then
    echo "Восстанавливаю загруженные файлы…"
    docker compose start backend >/dev/null
    # Ждём, пока контейнер снова примет команды.
    until docker compose exec -T backend true >/dev/null 2>&1; do sleep 1; done
    docker compose exec -T backend sh -c 'rm -rf /app/uploads/* 2>/dev/null; true'
    gzip -dc "$DIR/uploads.tar.gz" | docker compose exec -T backend tar -xf - -C /app/uploads
else
    docker compose start backend >/dev/null
fi

until curl -sf -o /dev/null http://localhost:"$(grep -E '^HTTP_PORT=' .env 2>/dev/null | cut -d= -f2- || echo 8080)"/api/health 2>/dev/null; do
    sleep 1
done

echo
echo "Готово. Восстановлена копия $WHICH."
echo "Если развернули не ту — вернуться можно так:  tools/restore.sh $(basename "$SAFETY")"
