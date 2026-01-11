import {
  getCookie,
  deleteCookie,
  setCookie,
} from "@tanstack/react-start/server";
import Token from "@/models/token";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import User from "@/models/user";
import Clinic from "@/models/clinic";

/**
 * Check's if the token that's assigned to the user exists/is valid
 */
export const checkIsTokenValid = createServerFn().handler(async function () {
  const token = getCookie("token");

  if (!token) {
    console.log("No token found");
    return { isValid: false };
  }

  const user = await Token.getUser(token);
  if (!user) {
    console.log("Invalid token, deleting cookie", token);
    deleteCookie("token");
    return { isValid: false };
  }

  return { isValid: true };
});

export const signIn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string(), password: z.string() }))
  .handler(async function (input) {
    const { email, password } = input.data;
    const { user, token } = await User.signIn(email, password);

    const clinic = user.clinic_id ? await Clinic.getById(user.clinic_id) : null;
    setCookie("token", token, {
      httpOnly: true,
      secure: import.meta.env.DEV ? false : true,
      sameSite: "strict",
      path: "/",
      expires: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    return {
      user: {
        ...user,
        hashed_password: "************",
        clinic_name: clinic?.name,
      },
      token,
    };
  });

export const signOut = createServerFn({ method: "POST" }).handler(
  async function () {
    const token = getCookie("token");
    if (!token) {
      throw new Error("not authenticated");
    }

    await Token.invalidate(token);
    deleteCookie("token");
  },
);

// export const Route = createFileRoute("/api/auth/is-valid-token")({
//   server: {
//     handlers: {
//       POST: async ({}) => {
//         const token = Option.fromNullable(getCookie("token"));

//         console.log({ token });

//         return Option.match(token, {
//           onNone: () => {
//             console.log("No token found, deleting cookie");
//             deleteCookie("token");
//             return new Response(JSON.stringify({ isValid: false }), {
//               headers: {
//                 "Content-Type": "application/json",
//               },
//               status: 401,
//             });
//           },
//           onSome: async (token) => {
//             const user = await Token.getUser(token);
//             console.log({ user, token });
//             const isValid = Option.isSome(user);
//             if (!isValid) {
//               console.log("Invalid token, deleting cookie", token);
//               deleteCookie("token");
//             }
//             return new Response(JSON.stringify({ isValid }), {
//               headers: {
//                 "Content-Type": "application/json",
//               },
//               status: 200,
//             });
//           },
//         });
//       },
//     },
//   },
// });
