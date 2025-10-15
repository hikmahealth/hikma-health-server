import { Kysely, sql } from "kysely";

/**
 * Migration: prescriptions_and_inventory_support
 * Created at: 2025-10-11
 * Description: Add support for inventory management, improve patient prescriptions and support stock tracking
 * We also add an "event_id" to vitals to track the event associated with the vitals entry. (part of
 * supporting patient level items in event forms)
 * Depends on: 20251002_add_departments_to_appointments
 */
export async function up(db: Kysely<any>): Promise<void> {
  /**
   * Add event_id to vitals
   */
  await db.schema
    .alterTable("patient_vitals")
    .addColumn(
      "event_id",
      "uuid",
      (col) => col.references("events.id").defaultTo(null),
      // Links vitals to a specific event/encounter
    )
    .execute();

  /** Organization-wide drug reference table */
  await db.schema
    .createTable("drug_catalogue")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn(
      "barcode",
      "varchar(50)",
      // purposely not making this unique - typos will cause a lot of issues.
      (col) => col.defaultTo(null),
      // EAN-13, UPC-A, or custom format (e.g., '5901234123457')
    )
    .addColumn(
      "generic_name",
      "varchar(255)",
      (col) => col.notNull(),
      // International Non-proprietary Name (e.g., 'Paracetamol', 'Amoxicillin')
    )
    .addColumn("brand_name", "varchar(255)")
    // Commercial name (e.g., 'Tylenol', 'Amoxil')
    .addColumn(
      "form",
      "varchar(100)",
      (col) => col.notNull(),
      // tablet, capsule, syrup, injection, cream, ointment, drops, inhaler
    )
    .addColumn(
      "route",
      "varchar(100)",
      (col) => col.notNull(),
      // oral, intravenous, intramuscular, subcutaneous, topical, ophthalmic, nasal
    )
    .addColumn(
      "dosage_quantity",
      "decimal(10, 4)",
      (col) => col.notNull(),
      // Numeric value: 500, 250, 10, 0.5
    )
    .addColumn(
      "dosage_units",
      "varchar(20)",
      (col) => col.notNull(),
      // mg, g, ml, units, mcg, percentage
    )
    .addColumn("manufacturer", "varchar(255)")
    // Pharmaceutical company name
    .addColumn(
      "sale_price",
      "decimal(10, 2)",
      (col) => col.notNull().defaultTo(0),
      // Unit price in base currency
    )
    .addColumn(
      "sale_currency",
      "varchar(3)",
      // ISO 4217 currency code
    )
    .addColumn(
      "min_stock_level",
      "integer",
      (col) => col.defaultTo(0),
      // Minimum quantity before reorder alert
    )
    .addColumn("max_stock_level", "integer")
    // Maximum quantity for storage capacity
    .addColumn(
      "is_controlled",
      "boolean",
      (col) => col.defaultTo(false),
      // True for narcotics/controlled substances requiring special handling
    )
    .addColumn(
      "requires_refrigeration",
      "boolean",
      (col) => col.defaultTo(false),
      // True for vaccines, insulin, some antibiotics
    )
    .addColumn(
      "is_active",
      "boolean",
      (col) => col.defaultTo(true),
      // False for discontinued drugs
    )
    .addColumn("notes", "text")
    // -----------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Lot/batch tracking for expiry and recalls
  await db.schema
    .createTable("drug_batches")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("drug_id", "uuid", (col) =>
      col.references("drug_catalogue.id").notNull(),
    )
    .addColumn(
      "batch_number",
      "varchar(100)",
      (col) => col.notNull(),
      // Manufacturer's batch/lot number (e.g., 'LOT2024A123')
    )
    .addColumn(
      "expiry_date",
      "date",
      (col) => col.notNull(),
      // YYYY-MM-DD format
    )
    .addColumn("manufacture_date", "date")
    .addColumn(
      "quantity_received",
      "integer",
      (col) => col.notNull(),
      // Original quantity when batch was received
    )
    .addColumn(
      "quantity_remaining",
      "integer",
      (col) => col.notNull(),
      // Current quantity available
    )
    .addColumn("supplier_name", "varchar(255)")
    // Supplier/distributor name
    .addColumn("purchase_price", "decimal(10, 2)")
    // Unit cost price
    .addColumn("purchase_currency", "varchar(3)", (col) => col.defaultTo(""))
    .addColumn(
      "received_date",
      "date",
      (col) => col.notNull(),
      // Date batch was received at clinic
    )
    .addColumn(
      "is_quarantined",
      "boolean",
      (col) => col.defaultTo(false),
      // True if batch is on hold (quality issues, recall, etc.)
    )
    // -----------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Add unique constraint for batch tracking
  await db.schema
    .createIndex("idx_drug_batch_unique")
    .on("drug_batches")
    .columns(["batch_number", "drug_id"])
    .unique()
    .execute();

  // Current stock levels per clinic/drug
  // This is never synced from the client, only from the server to the clients.
  // If inventory is manipulated on the client, it doesn't affect the server's stock levels - all sync is from server to client.
  await db.schema
    .createTable("clinic_inventory")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("clinic_id", "uuid", (col) =>
      col.references("clinics.id").notNull(),
    )
    .addColumn("drug_id", "uuid", (col) =>
      col.references("drug_catalogue.id").notNull(),
    )
    .addColumn("batch_id", "uuid", (col) =>
      col.references("drug_batches.id").notNull(),
    )
    .addColumn(
      "quantity_available",
      "integer",
      (col) => col.notNull(),
      // purposely allowing negatives, because this restriction could halt the whole operation. negatives just mean we can fix this later.
      // .check(sql`quantity_available >= 0`),
      // Current available quantity
    )
    .addColumn(
      "reserved_quantity",
      "integer",
      (col) => col.defaultTo(0),
      // Quantity reserved for pending prescriptions
      // This is handy for when a prescription is placed, but not picked up yet.
    )
    .addColumn("last_counted_at", "timestamptz")
    // -----------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Add unique constraint to prevent duplicate inventory entries
  await db.schema
    .createIndex("idx_clinic_inventory_unique")
    .on("clinic_inventory")
    .columns(["clinic_id", "drug_id", "batch_id"])
    .unique()
    .execute();

  // Inventory Transactions - Audit log of all stock movements
  // this is a server only table
  await db.schema
    .createTable("inventory_transactions")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("clinic_id", "uuid", (col) =>
      col.references("clinics.id").notNull(),
    )
    .addColumn("drug_id", "uuid", (col) =>
      col.references("drug_catalogue.id").notNull(),
    )
    // batch_id here is optional. it really complicates things at this point.
    .addColumn("batch_id", "uuid", (col) =>
      col.references("drug_batches.id").defaultTo(null),
    )
    .addColumn(
      "transaction_type",
      "varchar(50)",
      (col) => col.notNull(),
      // received, dispensed, transferred_in, transferred_out, expired, damaged, adjustment, returned
    )
    .addColumn(
      "quantity",
      "integer",
      (col) => col.notNull(),
      // Positive for additions, negative for reductions
    )
    .addColumn(
      "balance_after",
      "integer",
      (col) => col.notNull(),
      // Stock level after this transaction
    )
    .addColumn("reference_type", "varchar(50)")
    // dispensing_record, stock_order, transfer_order, adjustment_record
    .addColumn("reference_id", "uuid")
    // ID of related record (e.g., dispensing_record.id)
    .addColumn("reason", "text")
    // Human-readable reason for transaction
    .addColumn("performed_by", "uuid")
    // User ID who performed the transaction
    .addColumn("timestamp", "timestamptz", (col) => col.notNull()) // the timestamp for the transaction
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // NOTE: ORDERS will be supported in the future. for now all "inserts" will be directly added to the inventory and recorded in the transactions table
  // // Stock Orders - Clinic requests to central/supplier
  // await db.schema
  //   .createTable("stock_orders")
  //   .addColumn("id", "uuid", (col) =>
  //     col.primaryKey().defaultTo(sql`gen_random_uuid()`),
  //   )
  //   .addColumn(
  //     "order_number",
  //     "varchar(100)",
  //     (col) => col.unique().notNull(),
  //     // System-generated order number (e.g., 'SO-2024-0001')
  //   )
  //   .addColumn("clinic_id", "uuid", (col) =>
  //     col.references("clinics.id").notNull(),
  //   )
  //   .addColumn(
  //     "status",
  //     "varchar(50)",
  //     (col) => col.notNull(),
  //     // pending, approved, rejected, shipped, received, cancelled
  //   )
  //   .addColumn(
  //     "order_type",
  //     "varchar(50)",
  //     (col) => col.defaultTo("regular"),
  //     // regular, emergency, transfer, return
  //   )
  //   .addColumn("requested_by", "uuid")
  //   // User ID who created the order
  //   .addColumn("approved_by", "uuid")
  //   // User ID who approved
  //   .addColumn(
  //     "total_items",
  //     "integer",
  //     (col) => col.notNull(),
  //     // Number of line items
  //   )
  //   .addColumn("notes", "text")
  //   // Additional notes/instructions
  //   .addColumn("requested_at", "timestamptz", (col) => col.notNull())
  //   .addColumn("approved_at", "timestamptz")
  //   .addColumn("shipped_at", "timestamptz")
  //   .addColumn("received_at", "timestamptz")
  //   .addColumn("created_at", "timestamptz", (col) =>
  //     col.defaultTo(sql`now()`).notNull(),
  //   )
  //   .execute();

  // // Stock Order Items - Line items for stock orders
  // await db.schema
  //   .createTable("stock_order_items")
  //   .addColumn("id", "uuid", (col) =>
  //     col.primaryKey().defaultTo(sql`gen_random_uuid()`),
  //   )
  //   .addColumn("order_id", "uuid", (col) =>
  //     col.references("stock_orders.id").onDelete("cascade").notNull(),
  //   )
  //   .addColumn("drug_id", "uuid", (col) =>
  //     col.references("drug_catalogue.id").notNull(),
  //   )
  //   .addColumn("quantity_requested", "integer", (col) => col.notNull())
  //   .addColumn("quantity_approved", "integer")
  //   .addColumn("quantity_shipped", "integer")
  //   .addColumn("quantity_received", "integer")
  //   .addColumn("unit_price", "decimal(10, 2)")
  //   .addColumn("notes", "text")
  //   .execute();

  // Prescription Items - Individual drugs in prescription
  await db.schema
    .createTable("prescription_items")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("prescription_id", "uuid", (col) =>
      col.references("prescriptions.id").onDelete("cascade").notNull(),
    )
    // patient_id to simplify querying without joins (especially in client side)
    // leaving here to support questions like: "what active drugs is this patient on?"
    .addColumn("patient_id", "uuid", (col) =>
      col.notNull().references("patients.id"),
    )
    .addColumn("drug_id", "uuid", (col) =>
      col.references("drug_catalogue.id").notNull(),
    )
    // clinic id simplifies querying without joins (especially during clinic specific sync events)
    .addColumn("clinic_id", "uuid", (col) =>
      col.references("clinics.id").notNull(),
    )
    .addColumn(
      "dosage_instructions",
      "text",
      (col) => col.notNull(),
      // e.g., "Take 2 tablets by mouth twice daily after meals"
    )
    .addColumn(
      "quantity_prescribed",
      "integer",
      (col) => col.notNull(),
      // Total quantity prescribed
    )
    .addColumn(
      "quantity_dispensed",
      "integer",
      (col) => col.defaultTo(0),
      // Running total of dispensed quantity
    )
    .addColumn(
      "refills_authorized",
      "integer",
      (col) => col.defaultTo(0),
      // Number of refills allowed
    )
    .addColumn(
      "refills_used",
      "integer",
      (col) => col.defaultTo(0),
      // Number of refills already used
    )
    .addColumn(
      "item_status",
      "varchar(50)",
      (col) => col.defaultTo("active"),
      // active, completed, cancelled, partially_dispensed
    )
    .addColumn("notes", "text")
    // Special instructions or notes
    .execute();

  // Dispensing Records - Actual drug dispensing to patients
  await db.schema
    .createTable("dispensing_records")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("clinic_id", "uuid", (col) =>
      col.references("clinics.id").notNull(),
    )
    .addColumn("drug_id", "uuid", (col) =>
      col.references("drug_catalogue.id").notNull(),
    )
    .addColumn("batch_id", "uuid", (col) =>
      col.references("drug_batches.id").defaultTo(null),
    )
    .addColumn(
      "prescription_item_id",
      "uuid",
      (col) => col.references("prescription_items.id"),
      // NULL for OTC/emergency dispensing
    )
    .addColumn("patient_id", "uuid", (col) =>
      col.notNull().references("patients.id"),
    )
    .addColumn("quantity_dispensed", "integer", (col) => col.notNull())
    .addColumn("dosage_instructions", "text") // most likely from the pharmacist
    // Instructions given to patient
    .addColumn("days_supply", "integer")
    // Number of days the medication will last
    .addColumn(
      "dispensed_by",
      "uuid",
      (col) => col.notNull().references("users.id"),
      // Pharmacist/dispenser user ID
    )
    .addColumn("dispensed_at", "timestamptz", (col) => col.notNull())
    // -----------
    .addColumn("recorded_by_user_id", "uuid", (col) =>
      col.references("users.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("last_modified", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("server_created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz", (col) => col.defaultTo(null))
    .execute();

  // Create indices for performance
  await db.schema
    .createIndex("idx_drug_batches_expiry")
    .on("drug_batches")
    .column("expiry_date")
    .execute();

  await db.schema
    .createIndex("idx_inventory_clinic_drug")
    .on("clinic_inventory")
    .columns(["clinic_id", "drug_id"])
    .execute();

  await db.schema
    .createIndex("idx_transactions_clinic_date")
    .on("inventory_transactions")
    .columns(["clinic_id", "timestamp"])
    .execute();

  await db.schema
    .createIndex("idx_dispensing_clinic_date")
    .on("dispensing_records")
    .columns(["clinic_id", "dispensed_at"])
    .execute();

  await db.schema
    .createIndex("idx_dispensing_patient")
    .on("dispensing_records")
    .column("patient_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // drop the patient_vitals column that was added.
  await db.schema.alterTable("patient_vitals").dropColumn("event_id").execute();

  // Drop tables in reverse order of dependencies
  await db.schema.dropTable("dispensing_records").ifExists().execute();
  await db.schema.dropTable("prescription_items").ifExists().execute();
  await db.schema.dropTable("inventory_transactions").ifExists().execute();
  await db.schema.dropTable("clinic_inventory").ifExists().execute();
  await db.schema.dropTable("drug_batches").ifExists().execute();
  await db.schema.dropTable("drug_catalogue").ifExists().execute();
}
