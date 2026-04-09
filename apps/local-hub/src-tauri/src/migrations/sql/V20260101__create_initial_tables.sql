    -- Initial SQLite migration (targeting SQLite 3.51.2)
    -- For use on local sync server bridging WatermelonDB clients ↔ cloud PostgreSQL
    --
    -- STRICT mode enforces column types at the storage level
    -- Timestamps use INTEGER (epoch milliseconds)
    -- Booleans use INTEGER (0/1), enforced by STRICT
    -- JSON fields use TEXT
    -- Decimal fields (dosage_quantity, sale_price, purchase_price) use TEXT to preserve precision
    --
    -- local_server_* columns track when the local sync server first received,
    -- last modified, or soft-deleted each record — independent of client/cloud timestamps.

    CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY NOT NULL,
        given_name TEXT,
        surname TEXT,
        date_of_birth TEXT,
        citizenship TEXT,
        hometown TEXT,
        phone TEXT,
        sex TEXT,
        camp TEXT,
        additional_data TEXT NOT NULL,
        metadata TEXT NOT NULL,
        photo_url TEXT,
        image_timestamp INTEGER,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        government_id TEXT,
        external_patient_id TEXT,
        primary_clinic_id TEXT,
        last_modified_by TEXT,
        last_modified INTEGER,
        server_created_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_patients_primary_clinic_id ON patients (primary_clinic_id);

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        clinic_id TEXT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        email TEXT NOT NULL,
        hashed_password TEXT NOT NULL,
        instance_url TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        last_modified INTEGER,
        server_created_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS clinics (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        updated_at INTEGER,
        created_at INTEGER,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        is_archived INTEGER NOT NULL DEFAULT 0,
        attributes TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        address TEXT,
        last_modified INTEGER,
        server_created_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT,
        form_id TEXT,
        visit_id TEXT,
        event_type TEXT,
        form_data TEXT NOT NULL,
        metadata TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        recorded_by_user_id TEXT,
        last_modified INTEGER,
        server_created_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_events_patient_id ON events (patient_id);
    CREATE INDEX IF NOT EXISTS idx_events_visit_id ON events (visit_id);

    CREATE TABLE IF NOT EXISTS event_forms (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        description TEXT,
        language TEXT NOT NULL,
        is_editable INTEGER DEFAULT 0,
        is_snapshot_form INTEGER DEFAULT 0,
        form_fields TEXT NOT NULL,
        metadata TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        clinic_ids TEXT,
        translations TEXT,
        last_modified INTEGER,
        server_created_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS visits (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT,
        clinic_id TEXT,
        provider_id TEXT,
        provider_name TEXT,
        check_in_timestamp INTEGER,
        metadata TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        last_modified INTEGER,
        server_created_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits (patient_id);

    CREATE TABLE IF NOT EXISTS registration_forms (
        id TEXT PRIMARY KEY NOT NULL,
        clinic_id TEXT,
        name TEXT NOT NULL,
        fields TEXT NOT NULL,
        metadata TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        last_modified INTEGER,
        server_created_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS patient_additional_attributes (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        attribute_id TEXT NOT NULL,
        attribute TEXT NOT NULL,
        number_value REAL,
        string_value TEXT,
        date_value INTEGER,
        boolean_value INTEGER,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_patient_additional_attributes_patient_id ON patient_additional_attributes (patient_id);
    CREATE INDEX IF NOT EXISTS idx_patient_additional_attributes_attribute_id ON patient_additional_attributes (attribute_id);

    CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY NOT NULL,
        provider_id TEXT,
        clinic_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        current_visit_id TEXT NOT NULL,
        fulfilled_visit_id TEXT,
        timestamp INTEGER NOT NULL,
        duration INTEGER,
        reason TEXT NOT NULL,
        notes TEXT NOT NULL,
        is_walk_in INTEGER NOT NULL DEFAULT 0,
        departments TEXT NOT NULL,
        status TEXT NOT NULL,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments (clinic_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_timestamp ON appointments (timestamp);

    CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        filled_by TEXT,
        pickup_clinic_id TEXT,
        visit_id TEXT,
        priority TEXT,
        expiration_date INTEGER,
        prescribed_at INTEGER NOT NULL,
        filled_at INTEGER,
        status TEXT NOT NULL,
        items TEXT NOT NULL,
        notes TEXT NOT NULL,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions (patient_id);

    CREATE TABLE IF NOT EXISTS patient_vitals (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        visit_id TEXT,
        timestamp INTEGER NOT NULL,
        systolic_bp REAL,
        diastolic_bp REAL,
        bp_position TEXT,
        height_cm REAL,
        weight_kg REAL,
        bmi REAL,
        waist_circumference_cm REAL,
        heart_rate REAL,
        pulse_rate REAL,
        oxygen_saturation REAL,
        respiratory_rate REAL,
        temperature_celsius REAL,
        pain_level REAL,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        event_id TEXT,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient_id ON patient_vitals (patient_id);

    CREATE TABLE IF NOT EXISTS user_clinic_permissions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        clinic_id TEXT NOT NULL,
        can_register_patients INTEGER DEFAULT 0,
        can_view_history INTEGER DEFAULT 0,
        can_edit_records INTEGER DEFAULT 0,
        can_delete_records INTEGER DEFAULT 0,
        is_clinic_admin INTEGER DEFAULT 0,
        created_by TEXT,
        last_modified_by TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        can_edit_other_provider_event INTEGER DEFAULT 0,
        can_download_patient_reports INTEGER DEFAULT 0,
        can_prescribe_medications INTEGER DEFAULT 0,
        can_dispense_medications INTEGER DEFAULT 0,
        can_delete_patient_visits INTEGER DEFAULT 0,
        can_delete_patient_records INTEGER DEFAULT 0,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_user_clinic_permissions_user_id ON user_clinic_permissions (user_id);
    CREATE INDEX IF NOT EXISTS idx_user_clinic_permissions_clinic_id ON user_clinic_permissions (clinic_id);

    CREATE TABLE IF NOT EXISTS app_config (
        id TEXT PRIMARY KEY NOT NULL,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        data_type TEXT NOT NULL,
        created_at INTEGER,
        updated_at INTEGER,
        last_modified INTEGER,
        last_modified_by TEXT,
        display_name TEXT,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS patient_problems (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        visit_id TEXT,
        problem_code_system TEXT NOT NULL,
        problem_code TEXT NOT NULL,
        problem_label TEXT NOT NULL,
        clinical_status TEXT NOT NULL,
        verification_status TEXT NOT NULL,
        severity_score REAL,
        onset_date INTEGER,
        end_date INTEGER,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_patient_problems_patient_id ON patient_problems (patient_id);

    CREATE TABLE IF NOT EXISTS clinic_departments (
        id TEXT PRIMARY KEY NOT NULL,
        clinic_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT,
        description TEXT,
        status TEXT,
        can_dispense_medications INTEGER NOT NULL DEFAULT 0,
        can_perform_labs INTEGER NOT NULL DEFAULT 0,
        can_perform_imaging INTEGER NOT NULL DEFAULT 0,
        additional_capabilities TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        last_modified INTEGER,
        server_created_at INTEGER,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_clinic_departments_clinic_id ON clinic_departments (clinic_id);

    CREATE TABLE IF NOT EXISTS drug_catalogue (
        id TEXT PRIMARY KEY NOT NULL,
        barcode TEXT,
        generic_name TEXT NOT NULL,
        brand_name TEXT,
        form TEXT NOT NULL,
        route TEXT NOT NULL,
        dosage_quantity TEXT NOT NULL,
        dosage_units TEXT NOT NULL,
        manufacturer TEXT,
        sale_price TEXT NOT NULL,
        sale_currency TEXT,
        min_stock_level INTEGER,
        max_stock_level INTEGER,
        is_controlled INTEGER DEFAULT 0,
        requires_refrigeration INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 0,
        notes TEXT,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_drug_catalogue_barcode ON drug_catalogue (barcode);

    CREATE TABLE IF NOT EXISTS clinic_inventory (
        id TEXT PRIMARY KEY NOT NULL,
        clinic_id TEXT NOT NULL,
        drug_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        quantity_available INTEGER NOT NULL,
        reserved_quantity INTEGER,
        last_counted_at INTEGER,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        batch_number TEXT,
        batch_expiry_date INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_clinic_inventory_drug_id ON clinic_inventory (drug_id);

    CREATE TABLE IF NOT EXISTS prescription_items (
        id TEXT PRIMARY KEY NOT NULL,
        prescription_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        drug_id TEXT NOT NULL,
        clinic_id TEXT NOT NULL,
        dosage_instructions TEXT NOT NULL,
        quantity_prescribed INTEGER NOT NULL,
        quantity_dispensed INTEGER,
        refills_authorized INTEGER,
        refills_used INTEGER,
        item_status TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription_id ON prescription_items (prescription_id);
    CREATE INDEX IF NOT EXISTS idx_prescription_items_patient_id ON prescription_items (patient_id);
    CREATE INDEX IF NOT EXISTS idx_prescription_items_drug_id ON prescription_items (drug_id);

    CREATE TABLE IF NOT EXISTS dispensing_records (
        id TEXT PRIMARY KEY NOT NULL,
        clinic_id TEXT NOT NULL,
        drug_id TEXT NOT NULL,
        batch_id TEXT,
        prescription_item_id TEXT,
        patient_id TEXT NOT NULL,
        quantity_dispensed INTEGER NOT NULL,
        dosage_instructions TEXT,
        days_supply INTEGER,
        dispensed_by TEXT NOT NULL,
        dispensed_at INTEGER NOT NULL,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_dispensing_records_clinic_id ON dispensing_records (clinic_id);
    CREATE INDEX IF NOT EXISTS idx_dispensing_records_drug_id ON dispensing_records (drug_id);
    CREATE INDEX IF NOT EXISTS idx_dispensing_records_prescription_item_id ON dispensing_records (prescription_item_id);
    CREATE INDEX IF NOT EXISTS idx_dispensing_records_patient_id ON dispensing_records (patient_id);
    CREATE INDEX IF NOT EXISTS idx_dispensing_records_dispensed_by ON dispensing_records (dispensed_by);
    CREATE INDEX IF NOT EXISTS idx_dispensing_records_dispensed_at ON dispensing_records (dispensed_at);

    CREATE TABLE IF NOT EXISTS event_logs (
        id TEXT PRIMARY KEY NOT NULL,
        transaction_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        changes TEXT NOT NULL,
        device_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        ip_address TEXT,
        hash TEXT NOT NULL,
        hash_verified INTEGER DEFAULT 0,
        metadata TEXT,
        synced INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;

    CREATE TABLE IF NOT EXISTS peers (
        id TEXT PRIMARY KEY NOT NULL,
        peer_id TEXT NOT NULL,
        name TEXT NOT NULL,
        ip_address TEXT,
        port INTEGER,
        public_key TEXT NOT NULL,
        last_synced_at INTEGER,
        peer_type TEXT NOT NULL,
        is_leader INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        protocol_version TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_peers_peer_id ON peers (peer_id);

    -- New tables matching PostgreSQL schema

    CREATE TABLE IF NOT EXISTS patient_allergies (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        allergen_code_system TEXT,
        allergen_code TEXT,
        allergen_label TEXT,
        allergy_type TEXT,
        clinical_status TEXT NOT NULL,
        verification_status TEXT NOT NULL,
        severity TEXT,
        onset_date INTEGER,
        end_date INTEGER,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient_id ON patient_allergies (patient_id);

    CREATE TABLE IF NOT EXISTS patient_allergy_reactions (
        id TEXT PRIMARY KEY NOT NULL,
        allergy_id TEXT NOT NULL,
        reaction_manifestation_code TEXT,
        reaction_manifestation_label TEXT NOT NULL,
        description TEXT,
        severity TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_patient_allergy_reactions_allergy_id ON patient_allergy_reactions (allergy_id);

    CREATE TABLE IF NOT EXISTS patient_observations (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        visit_id TEXT,
        timestamp INTEGER NOT NULL,
        observation_code_system TEXT,
        observation_code TEXT NOT NULL,
        observation_label TEXT,
        value_string TEXT,
        value_numeric REAL,
        value_boolean INTEGER,
        value_datetime INTEGER,
        value_code TEXT,
        value_unit TEXT,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_patient_observations_patient_id ON patient_observations (patient_id);

    CREATE TABLE IF NOT EXISTS patient_tobacco_history (
        id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        smoking_status TEXT NOT NULL,
        type TEXT,
        packs_per_day REAL,
        start_date INTEGER,
        quit_date INTEGER,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_patient_tobacco_history_patient_id ON patient_tobacco_history (patient_id);

    CREATE TABLE IF NOT EXISTS drug_batches (
        id TEXT PRIMARY KEY NOT NULL,
        drug_id TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        expiry_date INTEGER NOT NULL,
        manufacture_date INTEGER,
        quantity_received INTEGER NOT NULL,
        quantity_remaining INTEGER NOT NULL,
        supplier_name TEXT,
        purchase_price TEXT,
        purchase_currency TEXT,
        received_date INTEGER NOT NULL,
        is_quarantined INTEGER DEFAULT 0,
        recorded_by_user_id TEXT,
        metadata TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL,
        server_created_at INTEGER NOT NULL,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_drug_batches_drug_id ON drug_batches (drug_id);

    CREATE TABLE IF NOT EXISTS inventory_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        clinic_id TEXT NOT NULL,
        drug_id TEXT NOT NULL,
        batch_id TEXT,
        transaction_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        reason TEXT,
        performed_by TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_clinic_id ON inventory_transactions (clinic_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_drug_id ON inventory_transactions (drug_id);

    CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY NOT NULL,
        description TEXT,
        store TEXT NOT NULL,
        store_version TEXT NOT NULL,
        uri TEXT NOT NULL,
        hash TEXT,
        mimetype TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        last_modified INTEGER,
        server_created_at INTEGER,
        deleted_at INTEGER,
        local_server_created_at INTEGER NOT NULL,
        local_server_last_modified_at INTEGER NOT NULL,
        local_server_deleted_at INTEGER
    ) STRICT;
