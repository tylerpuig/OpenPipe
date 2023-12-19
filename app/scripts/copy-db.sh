#!/bin/bash
set -e

report_progress() {
    echo "--------------------------------------------"
    echo "$1"
    echo "--------------------------------------------"
}

export CACHE_DIR=~/.cache/openpipe/prod-db
export TEMP_DB_NAME="openpipe_temp"

should_dump_prod_db() {
    [ "$FORCE_DUMP" = "true" ]
}

dump_prod_db() {
    report_progress "Dumping production database..."
    rm -rf "$CACHE_DIR"
    mkdir -p "$CACHE_DIR"
    export PGPASSWORD="$PASSWORD"
    

    pg_dump \
      -v \
      -Fd \
      -f "$CACHE_DIR" \
      --jobs=8 \
      --strict-names \
      --exclude-table-data '"LoggedCall"' \
      --exclude-table-data '"LoggedCallTag"' \
      --exclude-table-data 'graphile_worker.jobs' \
      -d "$PROD_DATABASE_URL"
    
    # Unset the password environment variable
    unset PGPASSWORD
}

terminate_connections() {
    report_progress "Terminating existing connections to $1 database..."
    psql -a -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$1' AND pid <> pg_backend_pid();"
}

drop_db() {
    report_progress "Dropping $1 database if it exists..."
    if psql -lqt | cut -d \| -f 1 | grep -qw $1; then
        dropdb -e $1
    else
        echo "Database $1 does not exist, skipping drop."
    fi
}


create_db() {
    report_progress "Creating $1 database..."
    createdb -e $1
}

run_update_sql_on_temp_db() {
    report_progress "Running SQL update on temporary database..."
    # Account for some logged calls that were not properly copied over
    psql -d "$TEMP_DB_NAME" -c 'DELETE FROM "DatasetEntry"
                WHERE "loggedCallId" IS NOT NULL 
                AND NOT EXISTS (
                    SELECT 1 
                    FROM "LoggedCall" 
                    WHERE "LoggedCall"."id" = "DatasetEntry"."loggedCallId"
                );'
    psql -d "$TEMP_DB_NAME" -c 'ALTER TABLE ONLY public."DatasetEntry"
                ADD CONSTRAINT "DatasetEntry_loggedCallId_fkey" FOREIGN KEY ("loggedCallId") REFERENCES public."LoggedCall"(id) ON UPDATE CASCADE ON DELETE CASCADE;'
}

if [[ "$@" == *"--force-dump"* ]]; then
    FORCE_DUMP="true"
else
    FORCE_DUMP="false"
fi

source .env

if should_dump_prod_db; then
    dump_prod_db
else
    report_progress "Skipping production database dump."
fi

terminate_connections "$TEMP_DB_NAME"
drop_db "$TEMP_DB_NAME"
create_db "$TEMP_DB_NAME"

report_progress "Restoring dump to $TEMP_DB_NAME database..."
pg_restore -v --no-owner --no-privileges -d $TEMP_DB_NAME --format=d --jobs=8 "$CACHE_DIR" || true
run_update_sql_on_temp_db

terminate_connections "openpipe-dev"
drop_db "openpipe-dev"
create_db "openpipe-dev"

report_progress "Restoring schema to dev database..."
# Restore just schema to dev db
pg_restore -v --no-owner --no-privileges -d openpipe-dev --format=d --jobs=8 --schema-only "$CACHE_DIR"

report_progress "Restoring data to dev database..."
# Restore data from temp db to dev db
pg_restore -v --no-owner --no-privileges -d openpipe-dev --format=d --jobs=8 --data-only --disable-triggers "$CACHE_DIR"

report_progress "Database copy complete."