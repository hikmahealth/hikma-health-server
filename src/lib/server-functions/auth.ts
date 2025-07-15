import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import Token from "@/models/token";
import { Option, Schema } from "effect";
import User from "@/models/user";

/**
 * Get the current user's ID
 * @returns {Promise<string | null>} - The user's ID or null if not authenticated
 */
const getCurrentUserId = createServerFn({ method: "GET" })
  .validator(() => ({}))
  .handler(async () => {
    const tokenCookie = getCookie("token");
    if (!tokenCookie) return null;

    const userOption = await Token.getUser(tokenCookie);
    return Option.match(userOption, {
      onNone: () => null,
      onSome: (user) => user.id,
    });
  });

/**
 * Get the current user all masked details
 * @returns {Promise<User.EncodedT | null>} - The user or null if not authenticated
 */
const getCurrentUser = createServerFn({ method: "GET" })
  .validator(() => ({}))
  .handler(async () => {
    const tokenCookie = getCookie("token");
    if (!tokenCookie) return null;

    const userOption = await Token.getUser(tokenCookie);
    const user = Option.match(userOption, {
      onNone: () => null,
      onSome: (user) => {
        const encodedUser = Schema.encodeUnknownSync(User.UserSchema)({
          ...user,
          instance_url: Option.fromNullable(user.instance_url),
          clinic_id: Option.fromNullable(user.clinic_id),
          deleted_at: Option.fromNullable(user.deleted_at),
        });
        return encodedUser;
      },
    });

    return user;
  });

export { getCurrentUserId, getCurrentUser };
