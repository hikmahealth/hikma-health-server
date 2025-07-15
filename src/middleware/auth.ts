import { createMiddleware } from "@tanstack/react-start";
import { getCookieToken } from "@/lib/auth/request";
import Token from "@/models/token";
import { Option } from "effect";
import User from "@/models/user";

export const authMiddleware = createMiddleware({ type: "function" })
  .validator(
    (data: { capabilities?: (typeof User.CapabilitySchema.Type)[] }) => data
  )
  .server(async ({ next, data, context }) => {
    console.log("context around authMiddleware", { context, data });

    const { capabilities } = data;

    const token = getCookieToken();
    if (!token) {
      return next({
        context: {
          isAuthorized: false,
        },
      });
    }
    const caller = await Token.getUser(token);

    const isAuthorized = Option.match(caller, {
      onNone: () => {
        return false;
      },
      onSome: (caller) => {
        const roleCapabilities = User.ROLE_CAPABILITIES[caller.role] || [];
        console.log("!!!!!!!!!!!!!!");
        console.log({ roleCapabilities, capabilities, caller });
        if (
          capabilities &&
          !capabilities.every((capability) =>
            roleCapabilities.includes(capability)
          )
        ) {
          return false;
        }
        return true;
      },
    });

    return next({
      context: {
        isAuthorized,
      },
    });
  });

export const capabilitiesMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const token = getCookieToken();
  if (!token) {
    return next({
      context: {
        capabilities: [] as (typeof User.CapabilitySchema.Type)[],
      },
    });
  }
  const caller = await Token.getUser(token);
  const capabilities = Option.match(caller, {
    onNone: () => [] as (typeof User.CapabilitySchema.Type)[],
    onSome: (caller) => User.ROLE_CAPABILITIES[caller.role] || [],
  });
  return next({
    context: {
      capabilities: capabilities as (typeof User.CapabilitySchema.Type)[],
    },
  });
});
