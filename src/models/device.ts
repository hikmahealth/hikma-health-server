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
import { uuidv7 } from "uuidv7";
import { randomBytes, createHash } from "crypto";

namespace Device {
  // ============================================
  // Constants
  // ============================================

  export const DEVICE_TYPE = {
    ANDROID: "android",
    IOS: "ios",
    LAPTOP: "laptop",
    SYNC_HUB: "sync_hub",
    SERVER: "server",
    OTHER: "other",
    UNKNOWN: "unknown",
  } as const;

  export type DeviceTypeT = (typeof DEVICE_TYPE)[keyof typeof DEVICE_TYPE];

  export const deviceTypes = [
    DEVICE_TYPE.ANDROID,
    DEVICE_TYPE.IOS,
    DEVICE_TYPE.LAPTOP,
    DEVICE_TYPE.SYNC_HUB,
    DEVICE_TYPE.SERVER,
    DEVICE_TYPE.OTHER,
  ] as const;

  export const STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended",
    DECOMMISSIONED: "decommissioned",
  } as const;

  export type StatusT = (typeof STATUS)[keyof typeof STATUS];

  export const statuses = [
    STATUS.ACTIVE,
    STATUS.INACTIVE,
    STATUS.SUSPENDED,
    STATUS.DECOMMISSIONED,
  ] as const;

  // ============================================
  // Plain types (no Effect)
  // ============================================

  export const HARDWARE_ID_TYPE = {
    ANDROID_ID: "android_id",
    IDFV: "idfv",
    SERIAL: "serial",
    MAC: "mac",
    CUSTOM: "custom",
  } as const;

  export type HardwareIdTypeT =
    (typeof HARDWARE_ID_TYPE)[keyof typeof HARDWARE_ID_TYPE];

  export const hardwareIdTypes = [
    HARDWARE_ID_TYPE.ANDROID_ID,
    HARDWARE_ID_TYPE.IDFV,
    HARDWARE_ID_TYPE.SERIAL,
    HARDWARE_ID_TYPE.MAC,
    HARDWARE_ID_TYPE.CUSTOM,
  ] as const;

  export interface T {
    id: string;
    name: string;
    device_type: DeviceTypeT;
    hardware_id: string | null;
    hardware_id_type: HardwareIdTypeT | null;
    os_type: string | null;
    app_version: string | null;
    api_key_hash: string;
    status: StatusT;
    clinic_ids: string[];
    max_pin_attempts: number;
    failed_pin_attempts: number;
    last_seen_at: Date | null;
    specifications: Record<string, any>;
    recorded_by_user_id: string | null;
    metadata: Record<string, any>;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    last_modified: Date;
    server_created_at: Date;
    deleted_at: Date | null;
  }

  // ============================================
  // API Key Helpers
  // ============================================

  /** Generate a random API key and its SHA-256 hash. Returns both — the plaintext is shown once, only the hash is stored. */
  export const generateApiKey = createServerOnlyFn(
    (): {
      plaintext: string;
      hash: string;
    } => {
      const plaintext = `hh_${randomBytes(32).toString("hex")}`;
      const hash = hashApiKey(plaintext);
      return { plaintext, hash };
    },
  );

  export const hashApiKey = createServerOnlyFn((plaintext: string): string => {
    return createHash("sha256").update(plaintext).digest("hex");
  });

  // ============================================
  // Table Definition
  // ============================================

  export namespace Table {
    export const ALWAYS_PUSH_TO_MOBILE = false;
    export const name = "devices";

    export const columns = {
      id: "id",
      name: "name",
      device_type: "device_type",
      hardware_id: "hardware_id",
      hardware_id_type: "hardware_id_type",
      os_type: "os_type",
      app_version: "app_version",
      api_key_hash: "api_key_hash",
      status: "status",
      clinic_ids: "clinic_ids",
      max_pin_attempts: "max_pin_attempts",
      failed_pin_attempts: "failed_pin_attempts",
      last_seen_at: "last_seen_at",
      specifications: "specifications",
      recorded_by_user_id: "recorded_by_user_id",
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
      name: string;
      device_type: string;
      hardware_id: string | null;
      hardware_id_type: string | null;
      os_type: string | null;
      app_version: string | null;
      api_key_hash: string;
      status: Generated<string>;
      clinic_ids: Generated<
        ColumnType<string[], string[] | undefined, string[]>
      >;
      max_pin_attempts: Generated<number>;
      failed_pin_attempts: Generated<number>;
      last_seen_at: ColumnType<
        Date | null,
        string | null | undefined,
        string | null
      >;
      specifications: Generated<JSONColumnType<Record<string, any>>>;
      recorded_by_user_id: string | null;
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

    export type Devices = Selectable<T>;
    export type NewDevice = Insertable<T>;
    export type DeviceUpdate = Updateable<T>;
  }

  // ============================================
  // Input types for API methods
  // ============================================

  export type RegisterDeviceInput = {
    name: string;
    device_type: DeviceTypeT;
    hardware_id?: string | null;
    hardware_id_type?: HardwareIdTypeT | null;
    os_type?: string | null;
    app_version?: string | null;
    clinic_ids?: string[];
    specifications?: Record<string, any>;
    recorded_by_user_id?: string | null;
    metadata?: Record<string, any>;
  };

  export type RegisterDeviceResult = {
    id: string;
    api_key: string; // plaintext — shown only once, can always be re-generated as needed
  };

  export type UpdateDeviceInput = {
    name?: string;
    device_type?: DeviceTypeT;
    hardware_id?: string | null;
    hardware_id_type?: HardwareIdTypeT | null;
    os_type?: string | null;
    app_version?: string | null;
    clinic_ids?: string[];
    specifications?: Record<string, any>;
    metadata?: Record<string, any>;
  };

  // ============================================
  // API
  // ============================================

  export namespace API {
    /**
     * Register a new device. Generates a UUID and API key.
     * Returns the device ID and the plaintext API key (shown once, never stored).
     */
    export const register = createServerOnlyFn(
      async (input: RegisterDeviceInput): Promise<RegisterDeviceResult> => {
        const id = uuidv7();
        const { plaintext, hash } = generateApiKey();

        await db
          .insertInto(Table.name)
          .values({
            id,
            name: input.name,
            device_type: input.device_type,
            hardware_id: input.hardware_id ?? null,
            hardware_id_type: input.hardware_id_type ?? null,
            os_type: input.os_type ?? null,
            app_version: input.app_version ?? null,
            api_key_hash: hash,
            status: STATUS.ACTIVE,
            clinic_ids: sql`${`{${(input.clinic_ids ?? []).join(",")}}`}::uuid[]`,
            specifications: sql`${JSON.stringify(input.specifications ?? {})}::jsonb`,
            recorded_by_user_id: input.recorded_by_user_id ?? null,
            metadata: sql`${JSON.stringify(input.metadata ?? {})}::jsonb`,
            is_deleted: false,
            created_at: sql`now()`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
            server_created_at: sql`now()`,
            deleted_at: null,
          })
          .execute();

        return { id, api_key: plaintext };
      },
    );

    /**
     * Update a device's fields. Only provided fields are updated.
     */
    export const update = createServerOnlyFn(
      async (id: string, input: UpdateDeviceInput): Promise<void> => {
        const setClauses: Record<string, any> = {
          updated_at: sql`now()`,
          last_modified: sql`now()`,
        };

        if (input.name !== undefined) setClauses.name = input.name;
        if (input.device_type !== undefined)
          setClauses.device_type = input.device_type;
        if (input.hardware_id !== undefined)
          setClauses.hardware_id = input.hardware_id;
        if (input.hardware_id_type !== undefined)
          setClauses.hardware_id_type = input.hardware_id_type;
        if (input.os_type !== undefined) setClauses.os_type = input.os_type;
        if (input.app_version !== undefined)
          setClauses.app_version = input.app_version;
        if (input.clinic_ids !== undefined)
          setClauses.clinic_ids = sql`${`{${input.clinic_ids.join(",")}}`}::uuid[]`;
        if (input.specifications !== undefined)
          setClauses.specifications = sql`${JSON.stringify(input.specifications)}::jsonb`;
        if (input.metadata !== undefined)
          setClauses.metadata = sql`${JSON.stringify(input.metadata)}::jsonb`;

        await db
          .updateTable(Table.name)
          .set(setClauses)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();
      },
    );

    /**
     * Get all non-deleted devices.
     */
    export const getAll = createServerOnlyFn(
      async (): Promise<Table.Devices[]> => {
        return db
          .selectFrom(Table.name)
          .where("is_deleted", "=", false)
          .selectAll()
          .orderBy("created_at", "desc")
          .execute();
      },
    );

    /**
     * Get a device by ID. Returns null if not found or soft-deleted.
     */
    export const getById = createServerOnlyFn(
      async (id: string): Promise<Table.Devices | null> => {
        const device = await db
          .selectFrom(Table.name)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .selectAll()
          .executeTakeFirst();

        return device ?? null;
      },
    );

    /**
     * Update the status of a device.
     */
    export const updateStatus = createServerOnlyFn(
      async (id: string, status: StatusT): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set({
            status,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();
      },
    );

    /**
     * Regenerate the API key for a device.
     * Returns the new plaintext key (shown once).
     */
    export const regenerateApiKey = createServerOnlyFn(
      async (id: string): Promise<{ api_key: string }> => {
        const { plaintext, hash } = generateApiKey();

        await db
          .updateTable(Table.name)
          .set({
            api_key_hash: hash,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();

        return { api_key: plaintext };
      },
    );

    /**
     * Update last_seen_at to now. Call this on device heartbeat / activity.
     */
    export const touchLastSeen = createServerOnlyFn(
      async (id: string): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set({
            last_seen_at: sql`now()`,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();
      },
    );

    /**
     * Soft delete a device.
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

    /**
     * Reset the failed PIN attempts counter to 0. Called by an admin to unlock
     * a device that has been locked out due to too many failed PIN attempts.
     */
    export const resetFailedPinAttempts = createServerOnlyFn(
      async (id: string): Promise<void> => {
        await db
          .updateTable(Table.name)
          .set({
            failed_pin_attempts: 0,
            updated_at: sql`now()`,
            last_modified: sql`now()`,
          })
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .execute();
      },
    );

    /**
     * Verify an API key against a device ID. Returns true if the hash matches.
     */
    export const verifyApiKey = createServerOnlyFn(
      async (id: string, plaintextKey: string): Promise<boolean> => {
        const device = await db
          .selectFrom(Table.name)
          .where("id", "=", id)
          .where("is_deleted", "=", false)
          .select("api_key_hash")
          .executeTakeFirst();

        if (!device) return false;
        return device.api_key_hash === hashApiKey(plaintextKey);
      },
    );

    /**
     * Look up a device by its plaintext API key.
     * Hashes the key and finds the matching active, non-deleted device.
     * Returns the full device record or null if not found.
     */
    export const getByApiKey = createServerOnlyFn(
      async (plaintextKey: string): Promise<Table.Devices | null> => {
        const keyHash = hashApiKey(plaintextKey);
        const device = await db
          .selectFrom(Table.name)
          .where("api_key_hash", "=", keyHash)
          .where("is_deleted", "=", false)
          .selectAll()
          .executeTakeFirst();

        return device ?? null;
      },
    );
  }
}

export default Device;
