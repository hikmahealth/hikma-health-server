import db from "@/db";
import { createServerOnlyFn } from "@tanstack/react-start";
import {
  type ColumnType,
  type Generated,
  type Selectable,
  type Insertable,
  type Updateable,
  type JSONColumnType,
  sql,
} from "kysely";
import { v1 as uuidV1 } from "uuid";
import { createHash } from "crypto";

namespace DevicePinCode {
  // ============================================
  // Constants
  // ============================================

  export const STATUS = {
    ACTIVE: "active",
    EXPIRED: "expired",
    REVOKED: "revoked",
  } as const;

  export type StatusT = (typeof STATUS)[keyof typeof STATUS];

  export const statuses = [
    STATUS.ACTIVE,
    STATUS.EXPIRED,
    STATUS.REVOKED,
  ] as const;

  /** PIN must be exactly 6 digits */
  export const PIN_LENGTH = 6;
  const PIN_REGEX = /^\d{6}$/;

  // ============================================
  // PIN Helpers
  // ============================================

  export function hashPin(pin: string): string {
    return createHash("sha256").update(pin).digest("hex");
  }

  export function isValidPin(pin: string): boolean {
    return PIN_REGEX.test(pin);
  }

  // ============================================
  // Table Definition
  // ============================================

  export namespace Table {
    export const ALWAYS_PUSH_TO_MOBILE = true;
    export const name = "device_pin_codes";
    export const mobileName = "device_pin_codes";

    export const columns = {
      id: "id",
      device_id: "device_id",
      pin_hash: "pin_hash",
      label: "label",
      issued_to_user_id: "issued_to_user_id",
      issued_by_user_id: "issued_by_user_id",
      status: "status",
      expires_at: "expires_at",
      last_used_at: "last_used_at",
      metadata: "metadata",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      last_modified: "last_modified",
      server_created_at: "server_created_at",
      deleted_at: "deleted_at",
    };

    export interface T {
      id: Generated<string>;
      device_id: string;
      pin_hash: string;
      label: string | null;
      issued_to_user_id: string | null;
      issued_by_user_id: string | null;
      status: Generated<string>;
      expires_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      last_used_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      metadata: Generated<JSONColumnType<Record<string, any>>>;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<
        ColumnType<Date, string | undefined, string | undefined>
      >;
      last_modified: Generated<ColumnType<Date, string | undefined, never>>;
      server_created_at: Generated<ColumnType<Date, string | undefined, never>>;
      deleted_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
    }

    export type DevicePinCodes = Selectable<T>;
    export type NewDevicePinCode = Insertable<T>;
    export type DevicePinCodeUpdate = Updateable<T>;
  }

  // ============================================
  // Input types
  // ============================================

  export interface CreatePinInput {
    device_id: string;
    pin: string; // 6-digit plaintext — hashed before storage
    label?: string | null;
    issued_to_user_id?: string | null;
    issued_by_user_id?: string | null;
    expires_at?: string | null; // ISO date string
    metadata?: Record<string, any>;
  }

  // ============================================
  // API
  // ============================================

  export namespace API {
    /**
     * Create a new PIN for a device.
     * Validates the PIN is exactly 6 digits, hashes it, and stores the hash.
     */
    export const create = createServerOnlyFn(
      async (input: CreatePinInput): Promise<string> => {
        if (!isValidPin(input.pin)) {
          throw new Error(
            `PIN must be exactly ${PIN_LENGTH} digits (0-9).`,
          );
        }

        const id = uuidV1();
        const pinHash = hashPin(input.pin);

        await db
          .insertInto(Table.name)
          .values({
            id,
            device_id: input.device_id,
            pin_hash: pinHash,
            label: input.label ?? null,
            issued_to_user_id: input.issued_to_user_id ?? null,
            issued_by_user_id: input.issued_by_user_id ?? null,
            status: STATUS.ACTIVE,
            expires_at: input.expires_at ?? null,
            metadata: sql`${JSON.stringify(input.metadata ?? {})}::jsonb`,
            is_deleted: false,
            created_at: sql`now()`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
            server_created_at: sql`now()`,
            deleted_at: null,
          })
          .execute();

        return id;
      },
    );

    /**
     * Get all active, non-expired PINs for a device.
     * This is what gets synced to the device for offline verification.
     */
    export const getActiveByDeviceId = createServerOnlyFn(
      async (deviceId: string): Promise<Table.DevicePinCodes[]> => {
        return db
          .selectFrom(Table.name)
          .where("device_id", "=", deviceId)
          .where("status", "=", STATUS.ACTIVE)
          .where("is_deleted", "=", false)
          .where((eb) =>
            eb.or([
              eb("expires_at", "is", null),
              eb("expires_at", ">", sql`now()`),
            ]),
          )
          .selectAll()
          .execute();
      },
    );

    /**
     * Get all PINs for a device (including expired/revoked), for admin view.
     */
    export const getAllByDeviceId = createServerOnlyFn(
      async (deviceId: string): Promise<Table.DevicePinCodes[]> => {
        return db
          .selectFrom(Table.name)
          .where("device_id", "=", deviceId)
          .where("is_deleted", "=", false)
          .selectAll()
          .orderBy("created_at", "desc")
          .execute();
      },
    );

    /**
     * Get a PIN by ID.
     */
    export const getById = createServerOnlyFn(
      async (id: string): Promise<Table.DevicePinCodes | null> => {
        const pin = await db
          .selectFrom(Table.name)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .selectAll()
          .executeTakeFirst();

        return pin ?? null;
      },
    );

    /**
     * Revoke a PIN. It will no longer work on the device after next sync.
     */
    export const revoke = createServerOnlyFn(async (id: string): Promise<void> => {
      await db
        .updateTable(Table.name)
        .set({
          status: STATUS.REVOKED,
          updated_at: sql`now()`,
          last_modified: sql`now()`,
        })
        .where("id", "=", id)
        .where("is_deleted", "=", false)
        .execute();
    });

    /**
     * Revoke all active PINs for a device. Useful when decommissioning a device
     * or when an admin wants to force all users to get new PINs.
     */
    export const revokeAllForDevice = createServerOnlyFn(
      async (deviceId: string): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set({
            status: STATUS.REVOKED,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("device_id", "=", deviceId)
          .where("status", "=", STATUS.ACTIVE)
          .where("is_deleted", "=", false)
          .execute();
      },
    );

    /**
     * Record that a PIN was used (update last_used_at).
     */
    export const touchLastUsed = createServerOnlyFn(
      async (id: string): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set({
            last_used_at: sql`now()`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();
      },
    );

    /**
     * Soft delete a PIN.
     */
    export const softDelete = createServerOnlyFn(
      async (id: string): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set({
            is_deleted: true,
            deleted_at: sql`now()`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .execute();
      },
    );
  }

  // ============================================
  // Sync
  // ============================================

  export namespace Sync {
    export const upsertFromDelta = createServerOnlyFn(
      async (_delta: Table.NewDevicePinCode) => {
        // PINs are created server-side only — mobile never pushes PINs.
        // This exists to satisfy the sync interface.
        return;
      },
    );

    export const deleteFromDelta = createServerOnlyFn(async (_id: string) => {
      return;
    });
  }
}

export default DevicePinCode;
