#!/bin/sh
# Резервная копия сайта: база данных и загруженные картинки.
#
# Копируется только то, что нельзя восстановить из репозитория: содержимое
# базы (новости, проекты, услуги, состав центра, заявки, настройки, учётки)
# и файлы, загруженные через админку. Картинки из макета лежат в образе,
# код — в репозитории, их копировать незачем.
#
# Запуск из папки проекта:
#     tools/backup.sh                 обычная копия
#     tools/backup.sh --keep 30       хранить 30 последних, старые удалить
#     tools/backup.sh --quiet         без болтовни, для cron
#
# Восстановление — tools/restore.sh

set -eu

KEEP=14
QUIET=""

while [ $# -gt 0 ]; do
    case "$1" in
        --keep) KEEP="$2"; shift 2 ;;
        --quiet) QUIET=1; shift ;;
        -h|--help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Неизвестный аргумент: $1" >&2; exit 2 ;;
    esac
done

say() { [ -n "$QUIET" ] || echo "$@"; }

cd "$(dirname "$0")/.."
[ -f docker-compose.yml ] || { echo "Запускать из папки проекта" >&2; exit 1; }

# Имя базы и пользователя берём из .env — там же, где их берёт compose.
DB_NAME=$(grep -E '^POSTGRES_DB=' .env 2>/dev/null | cut -d= -f2-)
DB_USER=$(grep -E '^POSTGRES_USER=' .env 2>/dev/null | cut -d= -f2-)
DB_NAME=${DB_NAME:-agropark}
DB_USER=${DB_USER:-agropark}

# Без поднятой базы копировать нечего, а голая ошибка docker
# ничего не объясняет.
if ! docker compose ps --status running --services 2>/dev/null | grep -qx db; then
    echo "База не запущена. Подними стек:  docker compose up -d" >&2
    exit 1
fi

STAMP=$(date +%Y%m%d-%H%M%S)
DIR="backups/$STAMP"
mkdir -p "$DIR"

say "Копия в $DIR"

# --- База ---
# --clean --if-exists кладёт в дамп команды удаления: при восстановлении
# старые таблицы уберутся сами, руками чистить базу не придётся.
say "  база данных…"
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
    | gzip -9 > "$DIR/db.sql.gz"

# --- Загруженные файлы ---
say "  загруженные файлы…"
docker compose exec -T backend tar -cf - -C /app/uploads . | gzip -9 > "$DIR/uploads.tar.gz"

# --- Опись ---
# Чтобы по копии было видно, что внутри, и не пришлось её разворачивать
# ради простого вопроса «а новости там есть?».
COUNTS=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -t -A -F' ' -c "
    select 'новостей', count(*) from news
    union all select 'проектов', count(*) from projects
    union all select 'услуг', count(*) from services
    union all select 'сотрудников', count(*) from staff_members
    union all select 'заявок', count(*) from contact_requests
    union all select 'учётных записей', count(*) from users" 2>/dev/null || echo "не удалось прочитать")

{
    echo "Копия от $(date '+%d.%m.%Y %H:%M:%S')"
    echo "База: $DB_NAME"
    echo
    echo "$COUNTS"
    echo
    echo "Размеры:"
    du -h "$DIR/db.sql.gz" "$DIR/uploads.tar.gz" | sed 's/^/  /'
    echo
    echo "Восстановление:  tools/restore.sh $STAMP"
} > "$DIR/manifest.txt"

[ -n "$QUIET" ] || cat "$DIR/manifest.txt" | sed 's/^/  /'

# --- Уборка старых копий ---
TOTAL=$(ls -1d backups/[0-9]*-[0-9]* 2>/dev/null | wc -l)
if [ "$TOTAL" -gt "$KEEP" ]; then
    ls -1d backups/[0-9]*-[0-9]* | sort | head -n $((TOTAL - KEEP)) | while read -r old; do
        say "  удаляю старую копию: $old"
        rm -rf "$old"
    done
fi

say "Готово."
