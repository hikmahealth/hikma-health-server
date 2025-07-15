import { createServerFileRoute, setCookie } from '@tanstack/react-start/server'
import {Option} from 'effect'
import User from '@/models/user'

export const ServerRoute = createServerFileRoute('/api/auth/sign-in').methods({
  POST: async ({request}) => {
    const { email, password } = await request.json()

    const res = await User.signIn(email, password)

    return Option.match(res, {
      onNone: () => {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 401,
        })
      },
      onSome: async ({ user, token }) => {
        setCookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/",
          expires: new Date(Date.now() + 2 * 60 * 60 * 1000),
        })
        return new Response(JSON.stringify({ user: User.secureMask(user), token }), {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        })
      },
    })
  },
})