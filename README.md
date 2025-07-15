# Hikma Health Server

### THIS IS A WORK IN PROGRESS - DO NOT USE IN PRODUCTION YET

## Running commands

### Environment Variables (.env file)

```
DATABASE_URL=postgresql://username:password@host:port/database
```

### Install dependencies

```bash
pnpm install
```

### Run development server

```bash
pnpm dev
```

---

### TODO:

- [ ] Go through the migrations with a fine tooth comb
- [ ]

# Pharmacy Module Design

## Overview

Built-in pharmacy functionality for prescribing, dispensing, and inventory management. Designed for offline-first operation in low-resource settings.

## Data Model

### Medications Table

- `medication_id` (primary key)
- `name` (string) - includes strength/formulation (e.g., "Paracetamol 500mg tablets")

### Prescriptions Table (enhanced)

- Existing fields: `name`, `dosage`, `dosage_units`, `duration`, `duration_units`, `frequency`, `route`
- **New fields**: `medication_id`, `quantity_prescribed`, `refills`, `instructions`, `prescriber_id`

### Inventory Table

- `medication_id` (foreign key)
- `location_id` (foreign key)
- `quantity` (current stock)
- `price_per_unit`
- `reorder_level` (optional)

### Stock Transactions Table

- `medication_id`, `location_id`, `quantity_change`, `transaction_type`, `timestamp`, `user_id`
- Logs all stock changes (dispense, restock, adjustments)

### Prescription Fulfillments Table

- `prescription_id`, `quantity_dispensed`, `dispensed_by`, `timestamp`
- Tracks actual dispensing over time

## Key Features

### Prescription Workflow

- Prescribe → reference medication by name (auto-creates in medications table if needed)
- Dispense → requires medication to exist in inventory at location
- Allow negative stock (physical constraint prevents over-dispensing)

### Inventory Management

- Per-location stock tracking
- Manual restocking (staff enters new stock quantities)
- Transaction logging for all stock changes
- Offline-first design with sync conflict resolution

### Autocomplete

- Medication names pulled from existing medications table
- Helps maintain naming consistency across locations

## Future Enhancements

- Batch/lot tracking (via purchase orders)
- Expiration date management
- Drug interaction checking
- Automated reorder alerts
- Advanced restocking workflows
