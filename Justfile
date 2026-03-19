set export := true

build-server:
    # prepare the web project
    moon docker scaffold server

    # package the content needed to build the server in a single folder
    rm -rf $APP_FOLDER;
    mkdir -p "./$APP_FOLDER"/;
    find ./.moon/docker/workspace -maxdepth 1 -mindepth 1 \
        -not -path "*/database" \
        -not -path "*/apps" \
        -not -path "*/packages" \
        -exec mv {} "./$APP_FOLDER/" \;

    mv ./.moon/docker/sources/* "./$APP_FOLDER"

    cd $APP_FOLDER
    pnpm install
    moon server:build

start-server:
    cd $APP_FOLDER
    moon server:start
