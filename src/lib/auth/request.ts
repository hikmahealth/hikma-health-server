import { getHeader, getCookie, setCookie } from "@tanstack/react-start/server";
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
