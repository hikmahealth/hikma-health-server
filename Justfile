set export := true

build-server:
    #!/usr/bin/env bash
    set -euxo pipefail
    export MOON_TOOLCHAIN_FORCE_GLOBALS=true
    export MOON_DEBUG_PROCESS_ENV=true

    echo "==> [build] scaffolding server workspace into ./$APP_FOLDER"
    # prepare the server project
    moon docker scaffold server

    # package the content needed to build the server in a single folder
    rm -rf $APP_FOLDER;
    mkdir -p "./$APP_FOLDER"/;
    find ./.moon/docker/configs -maxdepth 1 -mindepth 1 \
        -not -path "*/database" \
        -not -path "*/apps" \
        -not -path "*/packages" \
        -exec mv {} "./$APP_FOLDER/" \;

    mv ./.moon/docker/sources/* "./$APP_FOLDER"

    cd $APP_FOLDER
    echo "==> [build] installing dependencies"
    pnpm install
    echo "==> [build] compiling server bundle"
    moon run server:build
    echo "==> [build] complete"

migrate-server:
    #!/usr/bin/env bash
    set -euxo pipefail
    # Migrations resolve their folder via process.cwd() (see database/alembic/kysely-migrator.ts),
    # so we must run from inside the database package.
    echo "==> [migrate] running kysely migrate latest in ./$APP_FOLDER/database"
    cd $APP_FOLDER/database
    pnpm run migrate-latest
    echo "==> [migrate] complete"

# Migrations run unconditionally before start. They are idempotent — if the
# schema is already current, `kysely migrate latest` is a single no-op round
# trip. This keeps "starting the server" the single entrypoint that guarantees
# a current schema, regardless of deploy platform.
start-server: migrate-server
    #!/usr/bin/env bash
    set -euxo pipefail
    echo "==> [start] booting server from ./$APP_FOLDER"
    cd $APP_FOLDER
    moon run server:start
