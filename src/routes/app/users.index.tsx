import { createFileRoute, useRouter } from "@tanstack/react-router";
import User from "@/models/user";
import { createServerFn } from "@tanstack/react-start";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
// import { getCookieToken } from "@/lib/auth/request";
// import Token from "@/models/token";
// import { Option } from "effect";
import If from "@/components/if";
import { getCurrentUserId } from "@/lib/server-functions/auth";
import { toast } from "sonner";

// const getCurrentUserId = createServerFn({ method: "GET" }).handler(async () => {
//   const tokenCookie = getCookieToken();
//   if (!tokenCookie) return null;

//   const userOption = await Token.getUser(tokenCookie);
//   return Option.match(userOption, {
//     onNone: () => null,
//     onSome: (user) => user.id,
//   });
// });

const getAllUsers = createServerFn({ method: "GET" }).handler(async () => {
  const users = await User.API.getAll();
  return users;
});

const deleteUser = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    return User.API.softDelete(data.id);
  });

export const Route = createFileRoute("/app/users/")({
  component: RouteComponent,

  loader: async () => {
    return {
      users: await getAllUsers(),
      currentUserId: await getCurrentUserId(),
    };
  },
});

function RouteComponent() {
  const { users, currentUserId } = Route.useLoaderData();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    setIsDeleting(id);
    try {
      await deleteUser({ data: { id } });
      router.invalidate({ sync: true });
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast.error("Failed to delete user");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button asChild>
          <Link to="/app/users/edit">Add New User</Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/app/users/edit/$" params={{ _splat: user.id }}>
                      Edit
                    </Link>
                  </Button>
                  <If show={currentUserId !== user.id}>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(user.id)}
                      disabled={isDeleting === user.id}
                    >
                      {isDeleting === user.id ? "Deleting..." : "Delete"}
                    </Button>
                  </If>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
