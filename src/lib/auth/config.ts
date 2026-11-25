/**
 * Edge-safe Auth.js config — shared between the full NextAuth instance
 * (src/lib/auth/index.ts) and the middleware (src/middleware.ts).
 *
 * Why split:
 *   Middleware runs in Edge runtime. The full config imports `db` (postgres-js)
 *   and `verifyPassword` (Bun-only `Bun.password`), neither of which compile
 *   for Edge. This file holds only the bits middleware needs — session
 *   strategy, JWT callbacks, the authorized guard, and pages — leaving the
 *   Credentials provider to the Node-runtime sibling.
 *
 * `authorized` is the route-level gate: middleware calls it on every
 * matched request and redirects to `pages.signIn` when it returns false.
 */

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" as const },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.sub = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    authorized: ({ auth }) => !!auth?.user,
  },
  pages: {
    signIn: "/signin",
  },
} satisfies NextAuthConfig;
