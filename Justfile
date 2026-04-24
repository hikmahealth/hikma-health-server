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
    cd .build/server
    pnpm install --no-frozen-lockfile
    moon run server:build

install-build-aiproxy: (prepare-project 'aiproxy')
    #!/usr/bin/env bash
    set -euxo pipefail
    cd .build/aiproxy
    pnpm install --no-frozen-lockfile
    moon run aiproxy:build

moon_start-server:
    cd .build/server/database && pnpm run migrate-latest
    cd .build/server/apps/server && pnpm run start-only

moon_start-aiproxy:
    cd .build/aiproxy/apps/aiproxy && pnpm run start


# ========= Workspaces approach ======
# pnpm workspaces + Just, to replace moon for js workloads.
#
# .env loading: each recipe that needs env vars uses dotenvx (root devDep) to layer root .env + the relevant app .env.
# Variables already in the shell env take preference over .env values (dotenvx default).
# Leaf recipes (tsc/rescript only) skip env loading since they don't read env at build time.

# ---- Install : targeted to each deploy app's dep closure ----
# `--filter "<pkg>..."` installs the package + its workspace dependency closure +
# their transitive deps. Skips unrelated apps (mobile/RN, local-hub/Tauri) so
# deploys only pull what they need. Cheap when the lockfile already matches
# (pnpm short-circuits). CI=true triggers --frozen-lockfile automatically.
# Wired as deps of build-server / build-aiproxy so platforms only need to call
# `pnpm run server:build` / `pnpm run aiproxy:build`.
#
# For full local setup, devs run `pnpm install` directly.

install-server:
    pnpm install --filter "hikma-health-server..."

install-aiproxy:
    pnpm install --filter "hh-ai-proxy..."

# ---- Leaf builds : small atoms that everything else uses ----

build-utils-js:
    pnpm --filter @hikmahealth/js-utils run build

build-database:
    pnpm --filter @hikmahealth/database run build

build-ui:
    pnpm --filter @hikmahealth/ui run build


# ---- App builds : deps drive ordering so `just build-server` is one command ----

build-server: install-server build-utils-js build-database
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_ARGS="-f .env"
    [ -f apps/server/.env ] && ENV_ARGS="$ENV_ARGS -f apps/server/.env"
    pnpm exec dotenvx run $ENV_ARGS -- pnpm --filter hikma-health-server run build

build-aiproxy: install-aiproxy build-utils-js
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_ARGS="-f .env"
    [ -f apps/aiproxy/.env ] && ENV_ARGS="$ENV_ARGS -f apps/aiproxy/.env"
    pnpm exec dotenvx run $ENV_ARGS -- pnpm --filter hh-ai-proxy run build

typecheck-mobile: build-utils-js
    pnpm --filter hikma-health-mobile run check-types




# ---- Aggregator Scripts : Buy one get N free !! ----

build-packages: build-utils-js build-database build-ui

build-apps: build-server build-aiproxy typecheck-mobile

build-all: build-packages build-apps



# ---- App runs ----
# start-server runs three steps in order, every start, regardless of platform:
#   1. migrate    — idempotent; brings schema to current
#   2. recovery   — user_permissions_recovery script; antifragility for permissions/access
#   3. start-only — boots the built server from .output/
# Failure at any step aborts boot loudly (set -euo pipefail).
# Build before starting (just build-server / just build-aiproxy).

start-server:
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_ARGS="-f .env"
    [ -f apps/server/.env ] && ENV_ARGS="$ENV_ARGS -f apps/server/.env"
    pnpm exec dotenvx run $ENV_ARGS -- pnpm --filter @hikmahealth/database run migrate-latest
    pnpm exec dotenvx run $ENV_ARGS -- pnpm --filter hikma-health-server run recovery-permissions
    pnpm exec dotenvx run $ENV_ARGS -- pnpm --filter hikma-health-server run start-only

start-aiproxy:
    #!/usr/bin/env bash
    set -euo pipefail
    ENV_ARGS="-f .env"
    [ -f apps/aiproxy/.env ] && ENV_ARGS="$ENV_ARGS -f apps/aiproxy/.env"
    pnpm exec dotenvx run $ENV_ARGS -- pnpm --filter hh-ai-proxy run start





# ---- Cleanup Scripts : remove artifacts, or just empty accumulating gunk ----

clean-utils-js:
    pnpm --filter @hikmahealth/js-utils run clean

clean-database:
    rm -rf database/dist

clean-ui:
    rm -rf packages/ui/dist

clean-server:
    rm -rf apps/server/.output
    pnpm --filter hikma-health-server run res:clean

clean-aiproxy:
    rm -rf apps/aiproxy/dist
    pnpm --filter hh-ai-proxy run res:clean

clean-all: clean-utils-js clean-database clean-ui clean-server clean-aiproxy
