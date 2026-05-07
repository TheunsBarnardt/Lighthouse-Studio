#!/bin/sh
# Dump the Postgres database and optionally upload to B2 via Restic.
# Runs inside the postgres-backup container on a crond schedule.
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB="${PGDATABASE:-platform}"
BACKUP_FILE="/backups/${DB}_${TIMESTAMP}.dump"

echo "[backup] $(date): starting pg_dump for ${DB}"
pg_dump -Fc -h "${PGHOST}" -p "${PGPORT:-5432}" -U "${PGUSER}" "${DB}" > "${BACKUP_FILE}"
echo "[backup] dump complete: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# Restic upload (only when B2 credentials are present)
if [ -n "${RESTIC_REPOSITORY}" ] && [ -n "${RESTIC_PASSWORD}" ]; then
  echo "[backup] uploading to Restic repository"
  restic backup "${BACKUP_FILE}" --tag pg_dump --tag "${DB}"
  restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune
  echo "[backup] Restic upload complete"
fi

# Local retention: remove dumps older than BACKUP_RETENTION_DAYS (default 7)
find /backups -name "*.dump" -mtime "+${BACKUP_RETENTION_DAYS:-7}" -delete
echo "[backup] pruned local dumps older than ${BACKUP_RETENTION_DAYS:-7} days"
