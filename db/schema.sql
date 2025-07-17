-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_visit_id" UUID NOT NULL,
    "fulfilled_visit_id" UUID,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "duration" SMALLINT NOT NULL DEFAULT 60,
    "reason" VARCHAR NOT NULL DEFAULT '',
    "notes" VARCHAR NOT NULL DEFAULT '',
    "status" VARCHAR NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "is_deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_forms" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "is_editable" BOOLEAN DEFAULT true,
    "is_snapshot_form" BOOLEAN DEFAULT false,
    "form_fields" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "patient_id" UUID,
    "visit_id" UUID,
    "form_id" UUID,
    "event_type" TEXT,
    "form_data" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "patient_additional_attributes" (
    "id" UUID NOT NULL,
    "attribute_id" VARCHAR NOT NULL,
    "attribute" VARCHAR NOT NULL DEFAULT '',
    "number_value" DOUBLE PRECISION,
    "string_value" VARCHAR,
    "date_value" TIMESTAMPTZ(6),
    "boolean_value" BOOLEAN,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "patient_id" UUID
);

-- CreateTable
CREATE TABLE "patient_registration_forms" (
    "id" UUID NOT NULL,
    "clinic_id" UUID,
    "name" TEXT NOT NULL DEFAULT '',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "patient_registration_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "given_name" TEXT,
    "surname" TEXT,
    "date_of_birth" DATE,
    "citizenship" TEXT,
    "hometown" TEXT,
    "phone" TEXT,
    "sex" VARCHAR(24),
    "camp" VARCHAR(50),
    "additional_data" JSONB NOT NULL DEFAULT '{}',
    "image_timestamp" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "photo_url" TEXT,
    "is_deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "government_id" VARCHAR(100),
    "external_patient_id" VARCHAR(100),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "filled_by" UUID,
    "pickup_clinic_id" UUID NOT NULL,
    "visit_id" UUID,
    "priority" VARCHAR DEFAULT 'normal',
    "expiration_date" TIMESTAMPTZ(6),
    "prescribed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filled_at" TIMESTAMPTZ(6),
    "status" VARCHAR NOT NULL DEFAULT 'pending',
    "items" JSONB NOT NULL DEFAULT '[]',
    "notes" VARCHAR NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "last_modified" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_variables" (
    "id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "value_type" VARCHAR(42) NOT NULL,
    "value_data" BYTEA,
    "value_hash" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "string_content" (
    "id" UUID,
    "language" VARCHAR(5),
    "content" TEXT,
    "updated_at" TIMESTAMPTZ(6),
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6)
);

-- CreateTable
CREATE TABLE "string_ids" (
    "id" UUID NOT NULL,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "string_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "user_id" UUID,
    "token" TEXT NOT NULL,
    "expiry" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + '01:00:00'::interval)
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashed_password" TEXT NOT NULL,
    "instance_url" TEXT,
    "clinic_id" UUID,
    "is_deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "patient_id" UUID,
    "clinic_id" UUID,
    "provider_id" UUID,
    "provider_name" TEXT,
    "check_in_timestamp" TIMESTAMPTZ(6),
    "is_deleted" BOOLEAN DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "server_created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_timestamp" ON "appointments"("timestamp" ASC);

-- CreateIndex
CREATE INDEX "ix_patient_additional_attributes_attribute_id" ON "patient_additional_attributes"("attribute_id" ASC);

-- CreateIndex
CREATE INDEX "ix_prescriptions_patient_id" ON "prescriptions"("patient_id" ASC);

-- CreateIndex
CREATE INDEX "ix_prescriptions_pickup_clinic_id" ON "prescriptions"("pickup_clinic_id" ASC);

-- CreateIndex
CREATE INDEX "store_type_ix" ON "resources"("store" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_resource_ix" ON "resources"("store" ASC, "uri" ASC);

-- CreateIndex
CREATE INDEX "server_value_hash" ON "server_variables" USING HASH ("value_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "unique_server_key" ON "server_variables"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "string_content_id_language_unique_idx" ON "string_content"("id" ASC, "language" ASC);

-- CreateIndex
CREATE INDEX "tokens_token_idx" ON "tokens"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_unique_idx" ON "users"("email" ASC);

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_current_visit_id_fkey" FOREIGN KEY ("current_visit_id") REFERENCES "visits"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_fulfilled_visit_id_fkey" FOREIGN KEY ("fulfilled_visit_id") REFERENCES "visits"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "event_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_registration_forms" ADD CONSTRAINT "patient_registration_forms_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_filled_by_fkey" FOREIGN KEY ("filled_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_pickup_clinic_id_fkey" FOREIGN KEY ("pickup_clinic_id") REFERENCES "clinics"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "string_content" ADD CONSTRAINT "string_content_id_fkey" FOREIGN KEY ("id") REFERENCES "string_ids"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
