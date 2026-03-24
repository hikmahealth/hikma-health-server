import type {
  ColumnType,
  Generated,
  Selectable,
  Insertable,
  Updateable,
  JSONColumnType,
} from "kysely";
import db from "@/db";
import { sql } from "kysely";

namespace EducationContent {
  export type ContentType = "tiptap" | "resource";
  export type Status = "draft" | "published";
  export type Visibility = "public" | "private";

  /** Plain serializable type for client-side use (no Kysely wrappers). */
  export type Serialized = {
    id: string;
    title: string;
    description: string | null;
    content_type: string;
    tiptap_content: Record<string, unknown> | null;
    resource_id: string | null;
    status: string;
    visibility: string;
    language: string;
    tags: string[];
    metadata: Record<string, unknown>;
    author_id: string | null;
    published_at: Date | null;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
  };

  export namespace Table {
    export const name = "education_content" as const;

    export const columns = {
      id: "id",
      title: "title",
      description: "description",
      content_type: "content_type",
      tiptap_content: "tiptap_content",
      resource_id: "resource_id",
      status: "status",
      visibility: "visibility",
      language: "language",
      tags: "tags",
      metadata: "metadata",
      author_id: "author_id",
      published_at: "published_at",
      is_deleted: "is_deleted",
      created_at: "created_at",
      updated_at: "updated_at",
      deleted_at: "deleted_at",
    } as const;

    export interface T {
      id: Generated<string>;
      title: string;
      description: string | null;
      content_type: string;
      tiptap_content: JSONColumnType<Record<string, unknown> | null>;
      resource_id: string | null;
      status: Generated<string>;
      visibility: Generated<string>;
      language: Generated<string>;
      tags: JSONColumnType<string[]>;
      metadata: JSONColumnType<Record<string, unknown>>;
      author_id: string | null;
      published_at: ColumnType<Date | null, string | null | undefined, string | null>;
      is_deleted: Generated<boolean>;
      created_at: Generated<ColumnType<Date, string | undefined, never>>;
      updated_at: Generated<ColumnType<Date, string | undefined, string | undefined>>;
      deleted_at: ColumnType<Date | null, string | null | undefined, string | null>;
    }

    export type EducationContents = Selectable<T>;
    export type NewEducationContent = Insertable<T>;
    export type EducationContentUpdate = Updateable<T>;
  }

  /** Insert a new education content item. */
  export async function create(
    content: Table.NewEducationContent,
  ): Promise<Table.EducationContents> {
    return db
      .insertInto(Table.name)
      .values(content)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** Retrieve a single content item by ID. Returns null if not found or deleted. */
  export async function getById(
    id: string,
  ): Promise<Table.EducationContents | null> {
    const row = await db
      .selectFrom(Table.name)
      .selectAll()
      .where("id", "=", id)
      .where("is_deleted", "=", false)
      .executeTakeFirst();
    return row ?? null;
  }

  /** List all content for admin view (non-deleted). */
  export async function list(): Promise<Table.EducationContents[]> {
    return db
      .selectFrom(Table.name)
      .selectAll()
      .where("is_deleted", "=", false)
      .orderBy("updated_at", "desc")
      .execute();
  }

  /** List published + public content for patient-facing view. */
  export async function listPublic(
    search?: string,
  ): Promise<Table.EducationContents[]> {
    let query = db
      .selectFrom(Table.name)
      .selectAll()
      .where("is_deleted", "=", false)
      .where("status", "=", "published")
      .where("visibility", "=", "public");

    if (search && search.trim().length > 0) {
      // Escape SQL LIKE wildcards to prevent unintended pattern matching
      const escaped = search.trim().toLowerCase().replace(/[%_\\]/g, "\\$&");
      const term = `%${escaped}%`;
      query = query.where(({ or, eb }) =>
        or([
          eb(sql`LOWER(title)`, "like", term),
          eb(sql`LOWER(description)`, "like", term),
        ]),
      );
    }

    return query.orderBy("published_at", "desc").execute();
  }

  /** Get a single published + public content item (for patient view). */
  export async function getPublic(
    id: string,
  ): Promise<Table.EducationContents | null> {
    const row = await db
      .selectFrom(Table.name)
      .selectAll()
      .where("id", "=", id)
      .where("is_deleted", "=", false)
      .where("status", "=", "published")
      .where("visibility", "=", "public")
      .executeTakeFirst();
    return row ?? null;
  }

  /** Update a content item. */
  export async function update(
    id: string,
    data: Table.EducationContentUpdate,
  ): Promise<Table.EducationContents> {
    return db
      .updateTable(Table.name)
      .set({ ...data, updated_at: sql`now()` })
      .where("id", "=", id)
      .where("is_deleted", "=", false)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** Soft-delete a content item. */
  export async function softDelete(id: string): Promise<void> {
    await db
      .updateTable(Table.name)
      .set({
        is_deleted: true,
        deleted_at: sql`now()`,
        updated_at: sql`now()`,
      })
      .where("id", "=", id)
      .where("is_deleted", "=", false)
      .execute();
  }
}

export default EducationContent;
