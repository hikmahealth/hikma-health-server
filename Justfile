set export := true

# migrate-server:
#     #!/usr/bin/env bash
#     set -euxo pipefail
#     # Migrations resolve their folder via process.cwd() (see database/alembic/kysely-migrator.ts),
#     # so we must run from inside the database package.
#     echo "==> [migrate] running kysely migrate latest in ./$APP_FOLDER/database"
#     cd $APP_FOLDER/database
#     pnpm run migrate-latest
#     echo "==> [migrate] complete"
# Migrations run unconditionally before start. They are idempotent — if the
# schema is already current, `kysely migrate latest` is a single no-op round
# trip. This keeps "starting the server" the single entrypoint that guarantee a
# current schema, regardless of deploy platform.

prepare-project project:
    #!/usr/bin/env bash
    set -euxo pipefail
    APP_FOLDER=".build/{{ project }}"
    mkdir -p APP_FOLDER 2>/dev/null

    export MOON_TOOLCHAIN_FORCE_GLOBALS=true
    export MOON_DEBUG_PROCESS_ENV=true

    echo "==> [build] scaffolding service workspace into ./$APP_FOLDER"
    # prepare the server project
    moon docker scaffold {{ project }}

    # package the content needed to build the server in a single folder
    rm -rf $APP_FOLDER;
    mkdir -p "./$APP_FOLDER"/;
    find ./.moon/docker/configs -maxdepth 1 -mindepth 1 \
        -not -path "*/database" \
        -not -path "*/apps" \
        -not -path "*/packages" \
        -exec mv {} "./$APP_FOLDER/" \;

    mv ./.moon/docker/sources/* "./$APP_FOLDER"

install-build-server: (prepare-project 'server')
    #!/usr/bin/env bash
    set -euxo pipefail
    cd .build/ARG
    pnpm install --no-frozen-lockfile
    moon run server:build

install-build-aiproxy: (prepare-project 'aiproxy')
    #!/usr/bin/env bash
    set -euxo pipefail
    cd .build/aiproxy
    pnpm install --no-frozen-lockfile
    moon run aiproxy:build

start-server:
    #!/usr/bin/env bash
    set -euxo pipefail
    cd .build/server
    moon run server:start

start-aiproxy:
    #!/usr/bin/env bash
    set -euxo pipefail
    cd .build/aiproxy
    moon run aiproxy:start
