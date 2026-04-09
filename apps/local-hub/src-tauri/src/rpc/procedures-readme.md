# RPC Procedures Reference

API documentation for the Hikma Health Local Hub RPC system.

## Transport

All endpoints are served by the Poem HTTP framework on port 4001. Commands and queries use end-to-end encryption — clients must complete a handshake before calling `/rpc/command` or `/rpc/query`.

### Encryption Protocol

1. Client calls `/rpc/handshake` with its public key
2. Hub responds with its public key; both sides derive a shared secret via ECDH
3. Subsequent request/response payloads are `base64url(nonce || ciphertext || tag)` encrypted with the shared key

### Authentication

After establishing an encrypted channel, clients must authenticate with email + password to obtain a JWT token. The token is then included in all subsequent command/query payloads.

**Flow:**

```
Client                            Hub
  |-- handshake (ECDH) ---------->|  (establishes encrypted channel)
  |<--- hub_public_key -----------|
  |                               |
  |-- command: login ------------>|  (email + password, inside encrypted envelope)
  |<--- { token, user_id } ------|  (JWT signed with hub's secret)
  |                               |
  |-- query: get_patients ------->|  (token in payload, inside encrypted envelope)
  |    verify JWT -> load perms   |
  |<--- { patients: [...] } -----|
```

**JWT Details:**
- Algorithm: HMAC-SHA256
- TTL: 24 hours
- Claims: `sub` (user_id), `clinic_id`, `role`, `iat`, `exp`
- Signing key: 32-byte random secret stored in Stronghold, generated on first server start
- Permissions are loaded from `user_clinic_permissions` on each request using the token's `sub` and `clinic_id`

**Exempt operations** (no JWT required):
- Commands: `ping`, `login`
- Queries: `ping`, `heartbeat`
- HTTP endpoints: `/rpc/heartbeat`, `/rpc/handshake`

**Auth errors:**
- `"Authentication required"` — no token provided for a non-exempt operation
- `"JWT verification failed: ..."` — invalid signature, expired token, or malformed token
- `"Failed to load permissions for user '...': ..."` — user has no permissions row for the claimed clinic

---

## Endpoints

### GET /rpc/heartbeat

Unauthenticated liveness probe.

**Authentication**: None

**Response**:
```json
{ "status": "ok" }
```

---

### POST /rpc/handshake

Establishes an encrypted session with a client.

**Authentication**: None

**Request**:
```json
{
  "client_id": "string — opaque identifier chosen by the client",
  "client_public_key": "string — base64url-encoded public key"
}
```

**Response**:
```json
{
  "hub_public_key": "string — base64url-encoded hub public key",
  "hub_id": "string — hub identifier",
  "success": true
}
```

**Errors**:
- Hub pairing keys not loaded
- Hub public key or ID not loaded
- Invalid public key format
- Shared key derivation failure

---

### POST /rpc/command

Sends an encrypted write command.

**Authentication**: Requires prior handshake + JWT token (except exempt commands)

**Request** (wire format):
```json
{
  "client_id": "string",
  "payload": "string — base64url-encrypted envelope"
}
```

**Decrypted payload structure**:
```json
{
  "command": "string — command name",
  "data": { },
  "token": "string | null — JWT token (optional for exempt commands)"
}
```

**Response** (wire format):
```json
{
  "payload": "string — base64url-encrypted response",
  "success": true,
  "error": null
}
```

On failure, `success` is `false` and `error` contains a message. See [Commands](#commands) for available commands.

---

### POST /rpc/query

Sends an encrypted read query.

**Authentication**: Requires prior handshake + JWT token (except exempt queries)

**Request** (wire format):
```json
{
  "client_id": "string",
  "payload": "string — base64url-encrypted envelope"
}
```

**Decrypted payload structure**:
```json
{
  "query": "string — query name",
  "params": { },
  "token": "string | null — JWT token (optional for exempt queries)"
}
```

**Response** (wire format):
```json
{
  "payload": "string — base64url-encrypted response",
  "success": true,
  "error": null
}
```

On failure, `success` is `false` and `error` contains a message. See [Queries](#queries) for available queries.

---

## Commands

Write operations dispatched through `/rpc/command`.

### ping

Health check. No database required.

**Authentication**: None (exempt)

**Data**: `{}`

**Returns**:
```json
{ "pong": true }
```

---

### login

Authenticates a user by email and password. Returns a JWT token for subsequent requests.

**Authentication**: None (exempt) — this is how you obtain a token

**Data**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Returns** (success):
```json
{
  "token": "string — JWT token (valid for 24 hours)",
  "user_id": "string",
  "clinic_id": "string",
  "role": "string"
}
```

**Returns** (failure):
```json
{ "error": "Invalid email or password" }
```

**Notes**:
- The user must exist in the `users` table with `is_deleted = 0` and no `local_server_deleted_at`
- The user must have a non-null `hashed_password` (bcrypt format)
- If the password is not yet set, returns `"Password not set for this account"`
- The issued JWT contains `sub` (user_id), `clinic_id`, `role`, `iat`, and `exp` claims

---

### register_patient

Registers a new patient or updates an existing one (upsert).

**Authentication**: JWT required

**Data**:
```json
{
  "patient": {
    "id": "string",
    "given_name": "string",
    "surname": "string",
    "date_of_birth": "string",
    "citizenship": "string",
    "hometown": "string",
    "phone": "string",
    "sex": "string",
    "camp": "string | null",
    "additional_data": "string — JSON text",
    "metadata": "string — JSON text",
    "photo_url": "string | null",
    "government_id": "string",
    "external_patient_id": "string",
    "primary_clinic_id": "string | null",
    "last_modified_by": "string | null",
    "created_at": "i64 — client timestamp ms",
    "updated_at": "i64 — client timestamp ms"
  },
  "additional_attributes": [
    {
      "id": "string",
      "patient_id": "string",
      "attribute_id": "string",
      "attribute": "string",
      "number_value": "f64 | null",
      "string_value": "string | null",
      "date_value": "i64 | null",
      "boolean_value": "i64 | null",
      "metadata": "string — JSON text",
      "is_deleted": "i64",
      "created_at": "i64",
      "updated_at": "i64",
      "last_modified": "i64",
      "server_created_at": "i64"
    }
  ]
}
```

**Returns**:
```json
{
  "patient_id": "string",
  "attributes_count": 2
}
```

**Tables modified**: `patients`, `patient_additional_attributes`

**Server timestamps set**: `local_server_created_at`, `local_server_last_modified_at`

---

### delete_patient

Soft-deletes a patient by setting `local_server_deleted_at`.

**Authentication**: JWT required

**Data**:
```json
{
  "patient_id": "string"
}
```

**Returns**:
```json
{
  "deleted": true,
  "patient_id": "string"
}
```

**Tables modified**: `patients`

---

### create_event

Creates or updates a clinical event within a visit (upsert).

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "patient_id": "string",
  "form_id": "string",
  "visit_id": "string",
  "event_type": "string",
  "form_data": "string — JSON text",
  "metadata": "string — JSON text",
  "created_at": "i64 — client timestamp ms",
  "updated_at": "i64 — client timestamp ms",
  "recorded_by_user_id": "string"
}
```

**Returns**:
```json
{
  "event_id": "string"
}
```

**Tables modified**: `events`

**Conflict resolution**: On `id` conflict, updates `form_data`, `metadata`, `updated_at`, and server timestamp

---

### visits.update

Updates an existing visit's mutable fields.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "provider_id": "string | null — optional",
  "provider_name": "string | null — optional",
  "check_in_timestamp": "i64 | null — optional",
  "metadata": "string | null — optional, JSON text",
  "clinic_id": "string | null — optional",
  "updated_at": "i64 | null — optional"
}
```

**Returns**: Full visit object:
```json
{
  "id": "string",
  "patient_id": "string",
  "clinic_id": "string",
  "provider_id": "string",
  "provider_name": "string",
  "check_in_timestamp": "i64",
  "metadata": "string",
  "created_at": "i64",
  "updated_at": "i64"
}
```

**Tables modified**: `visits`

---

### vitals.update

Updates a patient vitals record. Only provided fields are changed.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "systolic_bp": "f64 | null — optional",
  "diastolic_bp": "f64 | null — optional",
  "bp_position": "string | null — optional",
  "height_cm": "f64 | null — optional",
  "weight_kg": "f64 | null — optional",
  "bmi": "f64 | null — optional",
  "waist_circumference_cm": "f64 | null — optional",
  "heart_rate": "f64 | null — optional",
  "pulse_rate": "f64 | null — optional",
  "oxygen_saturation": "f64 | null — optional",
  "respiratory_rate": "f64 | null — optional",
  "temperature_celsius": "f64 | null — optional",
  "pain_level": "f64 | null — optional",
  "metadata": "string | null — optional",
  "updated_at": "i64 | null — optional"
}
```

**Returns**:
```json
{ "ok": true, "id": "string" }
```

**Tables modified**: `patient_vitals`

---

### sync_push

Pushes client changes (creates, updates, deletes) to the local hub database. This is the RPC equivalent of `POST /api/v2/sync`.

**Authentication**: JWT required

**Data**:
```json
{
  "last_pulled_at": "i64 — client's last pull timestamp (ms since epoch)",
  "changes": {
    "<table_name>": {
      "created": [{ "id": "string", "created_at": "i64", "updated_at": "i64", "...": "..." }],
      "updated": [{ "id": "string", "created_at": "i64", "updated_at": "i64", "...": "..." }],
      "deleted": ["id1", "id2"]
    }
  }
}
```

**Returns**:
```json
{}
```

**Notes**:
- Tables `users`, `registration_forms`, `event_forms` are server-authoritative and will be silently skipped
- Unknown table names are silently skipped
- Records are upserted (insert or update on conflict by id)
- Server timestamps `local_server_created_at` and `local_server_last_modified_at` are set automatically

---

### appointments.create

Creates a new appointment (upsert).

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string | null — auto-generated if omitted",
  "provider_id": "string | null",
  "clinic_id": "string",
  "patient_id": "string",
  "user_id": "string",
  "current_visit_id": "string",
  "fulfilled_visit_id": "string | null",
  "timestamp": "i64",
  "duration": "i64 | null",
  "reason": "string",
  "notes": "string",
  "is_walk_in": "i64 — 0 or 1",
  "departments": "string — JSON text",
  "status": "string",
  "metadata": "string — JSON text",
  "created_at": "i64",
  "updated_at": "i64"
}
```

**Returns**:
```json
{ "appointment_id": "string" }
```

**Tables modified**: `appointments`

---

### appointments.update

Updates mutable fields on an existing appointment. Only provided fields are changed.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "provider_id": "string | null — optional",
  "fulfilled_visit_id": "string | null — optional",
  "timestamp": "i64 | null — optional",
  "duration": "i64 | null — optional",
  "reason": "string | null — optional",
  "notes": "string | null — optional",
  "is_walk_in": "i64 | null — optional",
  "departments": "string | null — optional",
  "status": "string | null — optional",
  "metadata": "string | null — optional",
  "updated_at": "i64 | null — optional"
}
```

**Returns**: Full appointment object.

**Tables modified**: `appointments`

---

### appointments.cancel

Soft-cancels an appointment by setting its status.

**Authentication**: JWT required

**Data**:
```json
{ "id": "string" }
```

**Returns**:
```json
{ "cancelled": true }
```

**Tables modified**: `appointments`

---

### appointments.complete

Marks an appointment as completed, optionally linking a visit.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "user_id": "string",
  "visit_id": "string | null"
}
```

**Returns**:
```json
{ "completed": true }
```

**Tables modified**: `appointments`

---

### prescriptions.create

Creates a new prescription (upsert).

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string | null — auto-generated if omitted",
  "patient_id": "string",
  "provider_id": "string",
  "filled_by": "string | null",
  "pickup_clinic_id": "string | null",
  "visit_id": "string | null",
  "priority": "string | null",
  "expiration_date": "i64 | null",
  "prescribed_at": "i64",
  "filled_at": "i64 | null",
  "status": "string",
  "items": "string — JSON text",
  "notes": "string",
  "metadata": "string — JSON text",
  "created_at": "i64",
  "updated_at": "i64"
}
```

**Returns**:
```json
{ "prescription_id": "string" }
```

**Tables modified**: `prescriptions`

---

### prescriptions.update

Updates mutable fields on an existing prescription. Only provided fields are changed.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "filled_by": "string | null — optional",
  "pickup_clinic_id": "string | null — optional",
  "priority": "string | null — optional",
  "expiration_date": "i64 | null — optional",
  "filled_at": "i64 | null — optional",
  "status": "string | null — optional",
  "items": "string | null — optional",
  "notes": "string | null — optional",
  "metadata": "string | null — optional",
  "updated_at": "i64 | null — optional"
}
```

**Returns**: Full prescription object.

**Tables modified**: `prescriptions`

---

### prescriptions.update_status

Updates only the status field of a prescription.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "status": "string"
}
```

**Returns**:
```json
{ "ok": true }
```

**Tables modified**: `prescriptions`

---

### prescriptions.pickup

Marks a prescription as picked up by a provider.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "provider_id": "string"
}
```

**Returns**:
```json
{ "ok": true }
```

**Tables modified**: `prescriptions`

---

### prescription_items.create

Creates a new prescription item (upsert).

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string | null — auto-generated if omitted",
  "prescription_id": "string",
  "patient_id": "string",
  "drug_id": "string",
  "clinic_id": "string",
  "dosage_instructions": "string",
  "quantity_prescribed": "i64",
  "quantity_dispensed": "i64 | null",
  "refills_authorized": "i64 | null",
  "refills_used": "i64 | null",
  "item_status": "string | null",
  "notes": "string | null",
  "metadata": "string | null",
  "created_at": "i64",
  "updated_at": "i64"
}
```

**Returns**:
```json
{ "id": "string" }
```

**Tables modified**: `prescription_items`

---

### prescription_items.update

Updates mutable fields on a prescription item. Only provided fields are changed.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string",
  "dosage_instructions": "string | null — optional",
  "quantity_prescribed": "i64 | null — optional",
  "quantity_dispensed": "i64 | null — optional",
  "refills_authorized": "i64 | null — optional",
  "refills_used": "i64 | null — optional",
  "item_status": "string | null — optional",
  "notes": "string | null — optional",
  "metadata": "string | null — optional",
  "updated_at": "i64 | null — optional"
}
```

**Returns**: Full prescription item object.

**Tables modified**: `prescription_items`

---

### prescription_items.dispense

Records dispensing of a prescription item from one or more inventory batches. Decrements inventory and increments `quantity_dispensed`.

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string — prescription item ID",
  "provider_id": "string",
  "batch_quantities": {
    "<batch_id>": "i64 — quantity to dispense from this batch"
  }
}
```

**Returns**:
```json
{ "ok": true, "total_dispensed": "i64" }
```

**Tables modified**: `prescription_items`, `clinic_inventory`

---

### dispensing.create

Records a dispensing event (medication given to a patient).

**Authentication**: JWT required

**Data**:
```json
{
  "id": "string | null — auto-generated if omitted",
  "clinic_id": "string",
  "drug_id": "string",
  "batch_id": "string | null",
  "prescription_item_id": "string | null",
  "patient_id": "string",
  "quantity_dispensed": "i64",
  "dosage_instructions": "string | null",
  "days_supply": "i64 | null",
  "dispensed_by": "string",
  "dispensed_at": "i64",
  "metadata": "string | null",
  "created_at": "i64 | null",
  "updated_at": "i64 | null"
}
```

**Returns**:
```json
{ "id": "string" }
```

**Tables modified**: `dispensing_records`

---

## Queries

Read operations dispatched through `/rpc/query`.

### ping

Health check. No database required.

**Authentication**: None (exempt)

**Params**: `{}`

**Returns**:
```json
{ "pong": true }
```

---

### heartbeat

Alternative health check. No database required.

**Authentication**: None (exempt)

**Params**: `{}`

**Returns**:
```json
{ "status": "ok" }
```

---

### sync_pull

Retrieves all changes since the client's last pull timestamp. This is the RPC equivalent of `GET /api/v2/sync?lastPulledAt=<timestamp>`.

**Authentication**: JWT required

**Params**:
```json
{
  "last_pulled_at": "i64 — timestamp in ms since epoch (0 for initial sync)"
}
```

**Returns**:
```json
{
  "changes": {
    "<table_name>": {
      "created": [{ "id": "string", "created_at": "i64", "updated_at": "i64", "...": "..." }],
      "updated": [{ "id": "string", "created_at": "i64", "updated_at": "i64", "...": "..." }],
      "deleted": ["id1", "id2"]
    }
  },
  "timestamp": "i64 — server timestamp to use as last_pulled_at next time"
}
```

**Notes**:
- Returns changes for all 25 syncable tables
- `created`: records with `local_server_created_at > last_pulled_at` (not soft-deleted)
- `updated`: records with `local_server_last_modified_at > last_pulled_at` AND `local_server_created_at <= last_pulled_at` (not soft-deleted)
- `deleted`: IDs of records with `local_server_deleted_at > last_pulled_at`
- Use `last_pulled_at: 0` for initial full sync

---

### get_patient

Retrieves a single patient with their registration form fields and values.

**Authentication**: JWT required

**Params**:
```json
{
  "patient_id": "string"
}
```

**Returns**:
```json
{
  "fields": [
    {
      "id": "string",
      "position": "i64",
      "column": "string",
      "label": { "en": "string", "...": "..." },
      "field_type": "string",
      "options": [],
      "required": "boolean",
      "base_field": "boolean",
      "visible": "boolean",
      "is_search_field": "boolean",
      "deleted": "boolean"
    }
  ],
  "values": {
    "<column>": "value"
  }
}
```

---

### search_patients

Searches patients by field filters with LIKE matching. All filters are ANDed.

**Authentication**: JWT required

**Params**:
```json
{
  "filters": {
    "<column>": "value"
  },
  "limit": "i64 — optional, default 20",
  "offset": "i64 — optional, default 0"
}
```

**Patient column filters**: `given_name`, `surname`, `date_of_birth`, `citizenship`, `hometown`, `phone`, `sex`, `camp`, `government_id`, `external_patient_id`, `id`

**Additional attribute filters**: Any key not in the patient column list is treated as an `attribute_id` and searched against `patient_additional_attributes` via an EXISTS subquery. Both `string_value` (LIKE) and `number_value` (CAST to TEXT, LIKE) are checked. Multiple attribute filters are ANDed together and with any patient column filters.

String values are wrapped with `%` for LIKE matching. All filter parameters are bound (never interpolated) to prevent SQL injection.

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "given_name": "string",
      "surname": "string",
      "date_of_birth": "string",
      "sex": "string",
      "phone": "string",
      "government_id": "string",
      "updated_at": "i64"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### get_patients

Retrieves a paginated list of all active patients, most recently updated first.

**Authentication**: JWT required

**Params**:
```json
{
  "limit": "i64 — optional, default 20",
  "offset": "i64 — optional, default 0"
}
```

**Returns**: Same shape as `search_patients`.

**Excludes**: Soft-deleted records (where `is_deleted` is truthy or `local_server_deleted_at` is set).

---

### check_government_id

Checks whether a government ID already exists in the patients table.

**Authentication**: JWT required

**Params**:
```json
{
  "government_id": "string"
}
```

**Returns**:
```json
{ "exists": true }
```

---

### patients.similar

Finds patients with similar names using Levenshtein distance, ranked by closeness.

**Authentication**: JWT required

**Params**:
```json
{
  "given_name": "string",
  "surname": "string",
  "limit": "integer — max results to return"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "given_name": "string",
      "surname": "string",
      "date_of_birth": "string",
      "...": "..."
    }
  ]
}
```

**Excludes**: Soft-deleted records.

---

### get_visits

Retrieves all visits for a patient, most recent check-in first.

**Authentication**: JWT required

**Params**:
```json
{
  "patient_id": "string"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "patient_id": "string",
      "clinic_id": "string",
      "provider_id": "string",
      "provider_name": "string",
      "check_in_timestamp": "i64",
      "metadata": "string — JSON text",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ]
}
```

**Excludes**: Soft-deleted records.

---

### get_visit_events

Retrieves all events for a specific patient + visit, most recent first.

**Authentication**: JWT required

**Params**:
```json
{
  "patient_id": "string",
  "visit_id": "string"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "patient_id": "string",
      "form_id": "string",
      "visit_id": "string",
      "event_type": "string",
      "form_data": "string — JSON text",
      "metadata": "string — JSON text",
      "created_at": "i64",
      "updated_at": "i64",
      "recorded_by_user_id": "string"
    }
  ]
}
```

**Excludes**: Soft-deleted records.

---

### get_patient_registration_form

Retrieves the most recently updated patient registration form.

**Authentication**: JWT required

**Params**: `{}`

**Returns** (success):
```json
{
  "id": "string",
  "name": "string",
  "fields": "string — JSON text",
  "metadata": "string — JSON text",
  "created_at": "i64",
  "updated_at": "i64"
}
```

**Returns** (no form found):
```json
{
  "error": "No registration form found"
}
```

---

### get_all_registration_forms

Retrieves all registration forms (including deleted).

**Authentication**: JWT required

**Params**: `{}`

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "fields": "string — JSON text",
      "metadata": "string",
      "is_deleted": "i64",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ]
}
```

---

### registration_form.get

Retrieves the most recently updated registration form, with optional language filter.

**Authentication**: JWT required

**Params**:
```json
{
  "language": "string | null — optional language filter"
}
```

**Returns**: Same shape as `get_patient_registration_form`.

---

### get_event_forms

Retrieves all active event forms, sorted alphabetically by name.

**Authentication**: JWT required

**Params**: `{}`

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "language": "string",
      "is_editable": "boolean",
      "is_snapshot_form": "boolean",
      "form_fields": "string — JSON text",
      "metadata": "string — JSON text",
      "created_at": "i64",
      "updated_at": "i64",
      "clinic_ids": "string — JSON text"
    }
  ]
}
```

---

### event_forms.list

Retrieves event forms with optional language and clinic filters.

**Authentication**: JWT required

**Params**:
```json
{
  "language": "string | null — optional language filter",
  "clinic_id": "string | null — optional clinic filter"
}
```

**Returns**: Same shape as `get_event_forms`.

---

### get_event_form

Retrieves a single event form by ID.

**Authentication**: JWT required

**Params**:
```json
{
  "form_id": "string"
}
```

**Returns** (success):
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "language": "string",
  "is_editable": "boolean",
  "is_snapshot_form": "boolean",
  "form_fields": "string — JSON text",
  "metadata": "string — JSON text",
  "created_at": "i64",
  "updated_at": "i64",
  "clinic_ids": "string — JSON text",
  "translations": "string | null"
}
```

**Returns** (not found):
```json
{
  "error": "Event form '<form_id>' not found"
}
```

---

### clinics.list

Retrieves all active clinics.

**Authentication**: JWT required

**Params**: `{}`

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "address": "string",
      "attributes": "string",
      "metadata": "string",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ]
}
```

---

### clinic_departments.list

Retrieves all departments for a clinic.

**Authentication**: JWT required

**Params**:
```json
{
  "clinic_id": "string"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "clinic_id": "string",
      "name": "string",
      "code": "string",
      "description": "string",
      "status": "string",
      "can_dispense_medications": "i64",
      "can_perform_labs": "i64",
      "can_perform_imaging": "i64",
      "additional_capabilities": "string",
      "metadata": "string",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ]
}
```

---

### appointments.list

Retrieves appointments within a date range, with optional filters.

**Authentication**: JWT required

**Params**:
```json
{
  "start_date": "i64 — timestamp ms",
  "end_date": "i64 — timestamp ms",
  "clinic_id": "string | null — optional",
  "status": "string | null — optional",
  "limit": "i64",
  "offset": "i64"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "provider_id": "string",
      "clinic_id": "string",
      "patient_id": "string",
      "user_id": "string",
      "current_visit_id": "string",
      "fulfilled_visit_id": "string | null",
      "timestamp": "i64",
      "duration": "i64 | null",
      "reason": "string",
      "notes": "string",
      "is_walk_in": "i64",
      "departments": "string",
      "status": "string",
      "metadata": "string",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ],
  "total": "i64",
  "limit": "i64",
  "offset": "i64"
}
```

---

### appointments.get

Retrieves a single appointment by ID.

**Authentication**: JWT required

**Params**:
```json
{
  "id": "string"
}
```

**Returns**: Single appointment object (same shape as list items), or `null`.

---

### appointments.by_patient

Retrieves all appointments for a patient.

**Authentication**: JWT required

**Params**:
```json
{
  "patient_id": "string"
}
```

**Returns**:
```json
{
  "data": ["...appointment objects"]
}
```

---

### appointments.search

Searches appointments by text query with filters.

**Authentication**: JWT required

**Params**:
```json
{
  "search_query": "string",
  "clinic_id": "string",
  "department_ids": ["string"] ,
  "status": ["string"],
  "date": "i64 — timestamp ms",
  "limit": "i64",
  "offset": "i64"
}
```

**Returns**: Same paginated shape as `appointments.list`.

---

### prescriptions.search

Searches prescriptions with optional filters.

**Authentication**: JWT required

**Params**:
```json
{
  "search_query": "string | null — optional text search",
  "clinic_id": "string | null — optional",
  "status": ["string"],
  "date": "i64 | null — optional",
  "limit": "i64",
  "offset": "i64"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "patient_id": "string",
      "provider_id": "string",
      "filled_by": "string | null",
      "pickup_clinic_id": "string | null",
      "visit_id": "string | null",
      "priority": "string | null",
      "expiration_date": "i64 | null",
      "prescribed_at": "i64",
      "filled_at": "i64 | null",
      "status": "string",
      "items": "string",
      "notes": "string",
      "metadata": "string",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ],
  "total": "i64",
  "limit": "i64",
  "offset": "i64"
}
```

---

### prescriptions.by_patient_visit

Retrieves all prescriptions for a specific patient + visit.

**Authentication**: JWT required

**Params**:
```json
{
  "patient_id": "string",
  "visit_id": "string"
}
```

**Returns**:
```json
{
  "data": ["...prescription objects"]
}
```

---

### prescription_items.by_prescription

Retrieves all items for a prescription.

**Authentication**: JWT required

**Params**:
```json
{
  "prescription_id": "string"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "prescription_id": "string",
      "patient_id": "string",
      "drug_id": "string",
      "clinic_id": "string",
      "dosage_instructions": "string",
      "quantity_prescribed": "i64",
      "quantity_dispensed": "i64 | null",
      "refills_authorized": "i64 | null",
      "refills_used": "i64 | null",
      "item_status": "string | null",
      "notes": "string | null",
      "metadata": "string | null",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ]
}
```

---

### prescription_items.by_patient

Retrieves all prescription items for a patient (across all prescriptions).

**Authentication**: JWT required

**Params**:
```json
{
  "patient_id": "string"
}
```

**Returns**: Same shape as `prescription_items.by_prescription`.

---

### drugs.search

Searches the drug catalogue with optional filters.

**Authentication**: JWT required

**Params**:
```json
{
  "search_term": "string | null — LIKE match on generic_name, brand_name, barcode",
  "form": "string | null — exact match",
  "route": "string | null — exact match",
  "is_active": "boolean | null — filter by active status"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "barcode": "string",
      "generic_name": "string",
      "brand_name": "string",
      "form": "string",
      "route": "string",
      "dosage_quantity": "f64",
      "dosage_units": "string",
      "manufacturer": "string",
      "sale_price": "f64",
      "sale_currency": "string",
      "min_stock_level": "i64",
      "max_stock_level": "i64",
      "is_controlled": "i64",
      "requires_refrigeration": "i64",
      "is_active": "i64",
      "notes": "string",
      "metadata": "string",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ]
}
```

---

### drugs.get

Retrieves a single drug by ID.

**Authentication**: JWT required

**Params**:
```json
{
  "id": "string"
}
```

**Returns**: Single drug object (same shape as search items), or `null`.

---

### drugs.by_barcode

Retrieves a drug by its barcode.

**Authentication**: JWT required

**Params**:
```json
{
  "barcode": "string"
}
```

**Returns**: Single drug object, or `null`.

---

### inventory.by_clinic

Retrieves all inventory records for a clinic.

**Authentication**: JWT required

**Params**:
```json
{
  "clinic_id": "string"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "clinic_id": "string",
      "drug_id": "string",
      "batch_id": "string",
      "batch_number": "string",
      "batch_expiry_date": "i64",
      "quantity_available": "i64",
      "reserved_quantity": "i64",
      "last_counted_at": "i64",
      "metadata": "string",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ]
}
```

---

### inventory.search

Searches inventory within a clinic by drug name or batch number.

**Authentication**: JWT required

**Params**:
```json
{
  "clinic_id": "string",
  "search_term": "string"
}
```

**Returns**: Same shape as `inventory.by_clinic`.

---

### inventory.check_availability

Checks whether a drug has sufficient stock at a clinic.

**Authentication**: JWT required

**Params**:
```json
{
  "drug_id": "string",
  "clinic_id": "string",
  "required_quantity": "i64"
}
```

**Returns**:
```json
{
  "available": "boolean",
  "total_available": "i64"
}
```

---

### dispensing.by_patient

Retrieves all dispensing records for a patient.

**Authentication**: JWT required

**Params**:
```json
{
  "patient_id": "string"
}
```

**Returns**:
```json
{
  "data": [
    {
      "id": "string",
      "clinic_id": "string",
      "drug_id": "string",
      "batch_id": "string | null",
      "prescription_item_id": "string | null",
      "patient_id": "string",
      "quantity_dispensed": "i64",
      "dosage_instructions": "string | null",
      "days_supply": "i64 | null",
      "dispensed_by": "string",
      "dispensed_at": "i64",
      "metadata": "string | null",
      "created_at": "i64",
      "updated_at": "i64"
    }
  ]
}
```

---

## Cross-Cutting Concerns

- **Authentication**: All commands and queries require a valid JWT token in the `token` field of the decrypted payload, except exempt operations (`ping`, `login`, `heartbeat`). Tokens are obtained via the `login` command and expire after 24 hours.
- **Authorization**: On each authenticated request, the user's permissions are loaded from `user_clinic_permissions` using the JWT's `sub` (user_id) and `clinic_id`. Per-handler permission checks can be enforced via `require_permission()`.
- **Soft deletes**: All queries exclude records where `is_deleted` is truthy or `local_server_deleted_at` is set
- **Server timestamps**: All write commands automatically set `local_server_created_at` and `local_server_last_modified_at` to the current time
- **Upsert semantics**: Commands use upsert logic (insert or update on conflict) for idempotent writes
- **Default pagination**: Limit defaults to 20, offset to 0
- **Error shape**: Handler errors are returned as JSON objects in the encrypted response payload, not as HTTP error codes
