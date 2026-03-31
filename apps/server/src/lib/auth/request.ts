import { getCookie } from "@tanstack/react-start/server";
import { createServerOnlyFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import Token from "@/models/token";
import User from "@/models/user";
import { Option } from "effect";

export const getCookieToken = createServerOnlyFn(() => {
  const token = getCookie("token");
  return token;
});

export const getToken = createServerFn({ method: "GET" }).handler(async () => {
  return getCookie("token");
});

export const userRoleTokenHasCapability = createServerOnlyFn(
  async (capabilities: (typeof User.CapabilitySchema.Type)[]) => {
    const token = getCookie("token");
    if (!token) return false;
    const userOption = await Token.getUser(token);
    return Option.match(userOption, {
      onNone: () => false,
      onSome: (user) => {
        const role = user.role;
        const roleCapabilities = User.ROLE_CAPABILITIES[role] || [];
        return capabilities.every((capability) =>
          roleCapabilities.includes(capability),
        );
      },
    });
  },
);

/**
 * Returns a boolean for whether the current user has the role of super_admin or not
 */
export const isUserSuperAdmin = createServerFn().handler(async () => {
  const token = getCookie("token");
  if (!token) return false;
  const userOption = await Token.getUser(token);
  return Option.match(userOption, {
    onNone: () => false,
    onSome: (user) => user.role === User.ROLES.SUPER_ADMIN,
  });
});

/** Returns the current authenticated user's ID, or null if not authenticated */
export const getCurrentUserId = createServerFn().handler(
  async (): Promise<string | null> => {
    const token = getCookie("token");
    if (!token) return null;
    const userOption = await Token.getUser(token);
    return Option.match(userOption, {
      onNone: () => null,
      onSome: (user) => user.id,
    });
  },
);
