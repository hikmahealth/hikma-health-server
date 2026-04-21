set export := true

install-build-server:
    #!/usr/bin/env bash
    set -euxo pipefail

    # force the build to ignore the contents of `pnpm install`
    # that is written to build step in platforms (old versions)
    if [[ "${PURGE_FOR_CI:-false}" == "true" ]]; then
        echo 'need to purge this'
        find ./ -maxdepth 1 -mindepth 1 -not -path "./.git" -not -path "./.git/*" -exec rm -rf {} \;
        git reset --hard HEAD
        pnpm store prune
    fi

    # installing dev dependencies from root
    # so that we can get the `moon` and `just` commands
    ls -al
    rm -f ./pnpm-lock.yaml
    pnpm install -w

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
    pnpm install --no-frozen-lockfile
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

install-build-aiproxy:
    #!/usr/bin/env bash
    APP_FOLDER=".aiproxy"
    set -euxo pipefail

    # installing dev dependencies from root
    # so that we can get the `moon` and `just` commands
    ls -al
    rm -f pnpm-lock.yaml
    pnpm install -w

    export MOON_TOOLCHAIN_FORCE_GLOBALS=true
    export MOON_DEBUG_PROCESS_ENV=true

    echo "==> [build] scaffolding service workspace into ./$APP_FOLDER"
    # prepare the server project
    moon docker scaffold aiproxy

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
    pnpm install --no-frozen-lockfile
    echo "==> [build] compiling service bundle"
    moon run aiproxy:build
    echo "==> [build] complete"

# a current schema, regardless of deploy platform.
start-aiproxy:
    #!/usr/bin/env bash
    APP_FOLDER=".aiproxy"
    set -euxo pipefail
    echo "==> [start] booting service from ./$APP_FOLDER"
    cd $APP_FOLDER
    moon run aiproxy:start
