import { createServerFileRoute, getCookie, deleteCookie } from '@tanstack/react-start/server'
import Token from '@/models/token'
import {Option} from 'effect'

export const ServerRoute = createServerFileRoute('/api/auth/is-valid-token').methods({
  POST: async ({  }) => {
    const token = Option.fromNullable(getCookie("token"));

    console.log({ token })

    return Option.match(token, {
      onNone: () => {
        console.log("No token found, deleting cookie")
        deleteCookie("token");
        return new Response(JSON.stringify({ isValid: false }), {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 401,
        })
      },
      onSome: async (token) => {
        const user = await Token.getUser(token)
        console.log({ user, token })
        const isValid = Option.isSome(user)
        if (!isValid) {
          console.log("Invalid token, deleting cookie", token)
          deleteCookie("token");
        }
        return new Response(JSON.stringify({ isValid }), {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        })
      }
    })
  },
})
