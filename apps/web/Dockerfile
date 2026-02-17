FROM node:22-alpine3.22 as base

ENV MOON_TOOLCHAIN_FORCE_GLOBALS=true
ENV MOON_DEBUG_PROCESS_ENV=true

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@10.28.1

RUN npm install -g @moonrepo/cli

FROM base AS skeleton
WORKDIR /app

# Copy entire repository and scaffold
COPY . .
RUN moon docker scaffold web

#### BUILD STAGE
#### Builds the project.

FROM base AS build
WORKDIR /app

# Copy project sources
COPY --from=skeleton /app/.patches .patches
COPY --from=skeleton /app/.moon/docker/workspace/pnpm-lock.yaml .
COPY --from=skeleton /app/.moon/docker/workspace/pnpm-workspace.yaml .
COPY --from=skeleton /app/.moon/docker/workspace/package.json .
COPY --from=skeleton /app/.moon/docker/workspace/.npmrc .
COPY --from=skeleton /app/.moon/docker/workspace/.moon .moon

# install dependencies
ENV NODE_OPTIONS=--max_old_space_size=4096
COPY --from=skeleton /app/.moon/docker/sources .

RUN pnpm install

# Build the project
RUN moon web:build

# Prune extraneous dependencies
RUN moon docker prune

#### START STAGE
#### Runs the project.

FROM base AS start
WORKDIR /app

# port to run
ENV APP_PORT ${APP_PORT:-8080}
ENV APP_ENV ${APP_ENV:-prod}

# Copy built sources
COPY --from=build /app .

CMD moon web:start
