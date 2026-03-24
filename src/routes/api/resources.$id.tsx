import { createFileRoute } from "@tanstack/react-router";
import db from "@/db";
import { createDiskAdapter } from "@/storage/adapters/disk";

export const Route = createFileRoute("/api/resources/$id")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const resource = await db
          .selectFrom("resources")
          .selectAll()
          .where("id", "=", params.id)
          .executeTakeFirst();

        if (!resource) {
          return new Response("Not found", { status: 404 });
        }

        // Only serve resources linked to published + public education content.
        // This prevents enumeration of private/draft resources.
        const linkedContent = await db
          .selectFrom("education_content")
          .select("id")
          .where("resource_id", "=", resource.id)
          .where("is_deleted", "=", false)
          .where("status", "=", "published")
          .where("visibility", "=", "public")
          .executeTakeFirst();

        if (!linkedContent) {
          return new Response("Not found", { status: 404 });
        }

        if (resource.store !== "disk") {
          return new Response("Unsupported storage backend", { status: 501 });
        }

        try {
          const adapter = await createDiskAdapter();
          const bytes = await adapter.downloadAsBytes(resource.uri);

          return new Response(bytes as unknown as BodyInit, {
            headers: {
              "Content-Type": resource.mimetype,
              "Cache-Control": "public, max-age=86400",
            },
          });
        } catch {
          return new Response("Failed to read resource", { status: 500 });
        }
      },
    },
  },
});
