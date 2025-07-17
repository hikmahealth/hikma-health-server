-- CreateTable
CREATE TABLE "kysely_migration" (
    "name" VARCHAR(255) NOT NULL,
    "timestamp" VARCHAR(255) NOT NULL,

    CONSTRAINT "kysely_migration_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "kysely_migration_lock" (
    "id" VARCHAR(255) NOT NULL,
    "is_locked" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kysely_migration_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "store" VARCHAR(42) NOT NULL,
    "store_version" VARCHAR(42) NOT NULL,
    "uri" TEXT NOT NULL,
    "hash" VARCHAR(512),
    "mimetype" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "is_deleted" BOOLEAN DEFAULT false,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_type_ix" ON "resources"("store" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_resource_ix" ON "resources"("store" ASC, "uri" ASC);
