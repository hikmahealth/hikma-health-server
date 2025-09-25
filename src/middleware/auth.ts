import { createMiddleware } from "@tanstack/react-start";
import { getCookieToken } from "@/lib/auth/request";
import Token from "@/models/token";
import { Option, pipe } from "effect";
import User from "@/models/user";
import UserClinicPermissions from "@/models/user-clinic-permissions";
import * as Sentry from "@sentry/tanstackstart-react";
import type Clinic from "@/models/clinic";

export const authMiddleware = createMiddleware({ type: "function" })
  .validator(
    (data: { capabilities?: (typeof User.CapabilitySchema.Type)[] }) => data,
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
            roleCapabilities.includes(capability),
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

// FIXME: Update capabilities to use the user-clinic-permissions in addition to the user roles
/**
 * @deprecated
 */
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

export const permissionsMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  return Sentry.startSpan(
    { name: "Getting user clinic permissions" },
    async () => {
      const token = getCookieToken();

      if (!token) {
        type ClinicId = Clinic.EncodedT["id"];
        return next({
          context: {
            userId: null as string | null,
            permissions: {} as Record<ClinicId, UserClinicPermissions.EncodedT>,
            role: null as typeof User.RoleSchema.Type | null,
          },
        });
      }

      const caller = await Token.getUser(token);
      const permissionsArray = await Option.match(caller, {
        onNone: async () => [] as UserClinicPermissions.EncodedT[],
        onSome: async (caller) => {
          return await UserClinicPermissions.API.getByUser(caller.id);
        },
      });

      // Transform array to object keyed by clinic_id
      const permissions = permissionsArray.reduce(
        (acc, permission) => {
          acc[permission.clinic_id] = permission;
          return acc;
        },
        {} as Record<Clinic.EncodedT["id"], UserClinicPermissions.EncodedT>,
      );

      return next({
        context: {
          // userId: Option.getOrNull(caller)?.id || null,
          userId: pipe(
            caller,
            Option.map((c) => c.id),
            Option.getOrNull,
          ),
          permissions,
          role: pipe(
            caller,
            Option.map((c) => c.role),
            Option.getOrNull,
          ),
        },
      });
    },
  );
});
