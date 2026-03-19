import { Kysely, sql } from "kysely";

/**
 * Migration: add_batch_info_and_dispensing_triggers
 * Created at: 2025-10-20
 * Description: Add batch denormalization to clinic_inventory and automate inventory deduction on dispensing
 * Depends on: 20251017_add_prescription_items_sync_fields
 *
 * DESIGNED FOR RESILIENCE - AKA, don't fail, we can reconcile later:
 * -------------------
 * This migration prioritizes operational continuity over data perfection. When dispensing_records are inserted,
 * a trigger automatically deducts from both clinic_inventory and drug_batches. However, in healthcare settings,
 * missing/invalid batch data shouldn't block patient care.
 *
 * Auto-healing behaviors:
 * 1. NULL batch_id → finds latest batch or creates UNTRACKED-{drug_id}-{timestamp}
 * 2. Invalid batch_id → creates batch with RECOVERED-{batch_id} prefix
 * 3. Missing clinic_inventory → upserts record (may start negative)
 * 4. Negative inventory → operation proceeds, flagged in inventory_transactions for reconciliation
 *
 * All auto-created records have metadata.auto_created = true for easy identification.
 *
 * Reconciliation queries:
 * - Auto-created batches: SELECT * FROM drug_batches WHERE metadata->>'auto_created' = 'true'
 * - Negative inventory: SELECT * FROM clinic_inventory WHERE quantity_available < 0
 * - Flagged transactions: SELECT * FROM inventory_transactions WHERE reason LIKE '%RECONCILIATION%'
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add batch fields to clinic_inventory for mobile query optimization.
  // this is migration 8 on mobile. we dont want to sync the whole batches table so this is a middle ground
  await db.schema
    .alterTable("clinic_inventory")
    .addColumn("batch_number", "varchar(100)")
    .addColumn("batch_expiry_date", "date")
    .execute();

  // Backfill existing data from drug_batches
  await sql`
    UPDATE clinic_inventory ci
    SET
      batch_number = db.batch_number,
      batch_expiry_date = db.expiry_date,
      last_modified = CURRENT_TIMESTAMP
    FROM drug_batches db
    WHERE ci.batch_id = db.id
  `.execute(db);

  // Function to deduct from both clinic_inventory and drug_batches
  await sql`
    CREATE OR REPLACE FUNCTION deduct_from_clinic_inventory()
    RETURNS TRIGGER AS $$
    DECLARE
      current_balance integer;
      effective_batch_id uuid;
      batch_exists boolean;
    BEGIN
      -- Handle NULL or missing batch_id
      IF NEW.batch_id IS NULL THEN
        -- Check if batch exists for this drug
        SELECT id INTO effective_batch_id
        FROM drug_batches
        WHERE drug_id = NEW.drug_id
        ORDER BY expiry_date DESC
        LIMIT 1;

        -- No batch exists, create a placeholder
        IF effective_batch_id IS NULL THEN
          INSERT INTO drug_batches (
            drug_id,
            batch_number,
            expiry_date,
            manufacture_date,
            quantity_received,
            quantity_remaining,
            received_date,
            metadata
          ) VALUES (
            NEW.drug_id,
            'UNTRACKED-' || NEW.drug_id || '-' || EXTRACT(EPOCH FROM NOW())::text,
            CURRENT_DATE + INTERVAL '1 year', -- default 1 year expiry
            CURRENT_DATE,
            NEW.quantity_dispensed, -- start with what was just dispensed
            0, -- already dispensed
            CURRENT_DATE,
            jsonb_build_object(
              'auto_created', true,
              'reason', 'batch_id was null during dispensing',
              'dispensing_record_id', NEW.id
            )
          )
          RETURNING id INTO effective_batch_id;
        END IF;

        -- Update the dispensing record with the effective batch
        UPDATE dispensing_records
        SET batch_id = effective_batch_id
        WHERE id = NEW.id;

        NEW.batch_id := effective_batch_id;
      ELSE
        -- Check if provided batch exists
        SELECT EXISTS(SELECT 1 FROM drug_batches WHERE id = NEW.batch_id)
        INTO batch_exists;

        IF NOT batch_exists THEN
          -- Create the missing batch
          INSERT INTO drug_batches (
            id,
            drug_id,
            batch_number,
            expiry_date,
            manufacture_date,
            quantity_received,
            quantity_remaining,
            received_date,
            metadata
          ) VALUES (
            NEW.batch_id,
            NEW.drug_id,
            'RECOVERED-' || NEW.batch_id,
            CURRENT_DATE + INTERVAL '1 year',
            CURRENT_DATE,
            NEW.quantity_dispensed,
            0,
            CURRENT_DATE,
            jsonb_build_object(
              'auto_created', true,
              'reason', 'batch referenced but did not exist',
              'dispensing_record_id', NEW.id
            )
          );
        END IF;
      END IF;

      -- Ensure clinic_inventory record exists
      INSERT INTO clinic_inventory (
        clinic_id,
        drug_id,
        batch_id,
        quantity_available,
        reserved_quantity,
        batch_number,
        batch_expiry_date
      )
      SELECT
        NEW.clinic_id,
        NEW.drug_id,
        NEW.batch_id,
        -NEW.quantity_dispensed, -- start negative, will be reconciled
        0,
        db.batch_number,
        db.expiry_date
      FROM drug_batches db
      WHERE db.id = NEW.batch_id
      ON CONFLICT (clinic_id, drug_id, batch_id)
      DO UPDATE SET
        quantity_available = clinic_inventory.quantity_available - NEW.quantity_dispensed,
        updated_at = NOW(),
        last_modified = NOW()
      RETURNING quantity_available INTO current_balance;

      -- Log transaction
      INSERT INTO inventory_transactions (
        clinic_id,
        drug_id,
        batch_id,
        transaction_type,
        quantity,
        balance_after,
        reference_type,
        reference_id,
        reason,
        performed_by,
        timestamp
      ) VALUES (
        NEW.clinic_id,
        NEW.drug_id,
        NEW.batch_id,
        'dispensed',
        -NEW.quantity_dispensed,
        current_balance,
        'dispensing_record',
        NEW.id,
        CASE
          WHEN current_balance < 0 THEN 'RECONCILIATION NEEDED: Dispensed with negative inventory'
          ELSE 'Medication dispensed to patient'
        END,
        NEW.dispensed_by,
        NEW.dispensed_at
      );

      -- Deduct from drug_batches
      UPDATE drug_batches
      SET
        quantity_remaining = quantity_remaining - NEW.quantity_dispensed,
        updated_at = NOW(),
        last_modified = NOW()
      WHERE id = NEW.batch_id;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  // Create trigger
  await sql`
    CREATE TRIGGER trigger_deduct_from_clinic_inventory
    AFTER INSERT ON dispensing_records
    FOR EACH ROW
    EXECUTE FUNCTION deduct_from_clinic_inventory();
  `.execute(db);

  // Fast query of exired data
  await db.schema
    .createIndex("idx_clinic_inventory_expiry")
    .on("clinic_inventory")
    .column("batch_expiry_date")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop trigger
  await sql`DROP TRIGGER IF EXISTS trigger_deduct_from_clinic_inventory ON dispensing_records`.execute(
    db,
  );

  // Drop function
  await sql`DROP FUNCTION IF EXISTS deduct_from_clinic_inventory()`.execute(db);

  // Drop index
  await db.schema
    .dropIndex("idx_clinic_inventory_expiry")
    .on("clinic_inventory")
    .execute();

  // Drop columns
  await db.schema
    .alterTable("clinic_inventory")
    .dropColumn("batch_expiry_date")
    .dropColumn("batch_number")
    .execute();
}
