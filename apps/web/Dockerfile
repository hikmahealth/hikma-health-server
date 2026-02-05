#### BASE STAGE
#### Installs moon
#
FROM node:22.20.0-slim AS base
# RUN apk add --no-cache libc6-compat
# RUN apk update
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@10.28.1

FROM base AS builder
WORKDIR /app

# building the project dependencies
COPY . .
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm install --frozen-lockfile

#### SKELETON STAGE
#### Scaffolds repository skeleton structures.

FROM base AS skeleton

# Copy entire repository and scaffold
COPY . .
RUN moon docker scaffold web

#### BUILD STAGE
#### Builds the project.

FROM base AS build

# Copy workspace configs
COPY --from=skeleton /app/.moon/docker/workspace .

# Install dependencies
RUN moon docker setup

# Copy project sources
COPY --from=skeleton /app/.moon/docker/sources .

# Build the project
RUN moon run web:build

# Prune extraneous dependencies
RUN moon docker prune
