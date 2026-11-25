/**
 * Auth.js v5 root config — Credentials provider (username + password).
 *
 * Why Credentials + JWT (not database) strategy:
 *   Auth.js v5 supports database sessions only when every provider writes
 *   into the accounts table. Credentials doesn't, so signIn() throws if
 *   `strategy: "database"`. JWT is stateless; the cookie is signed with
 *   AUTH_SECRET, and the jwt / session callbacks (in ./config.ts) shuttle
 *   user.id from row → token → session.user.
 *
 * Why no DrizzleAdapter:
 *   Credentials never calls createUser / linkAccount on the adapter.
 *   With JWT sessions the adapter is dead weight and gives the wrong signal.
 *   Re-add when an OAuth or Email provider needs it.
 *
 * Signup flow: see src/lib/auth/actions.ts — we INSERT into users ourselves,
 * then call signIn("credentials", ...) to mint the JWT.
 *
 * The exported handlers are imported by
 * src/app/api/auth/[...nextauth]/route.ts.
 */

import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { authConfig } from "./config";
import { verifyPassword } from "./password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "username", type: "text" },
        password: { label: "password", type: "password" },
      },
      authorize: async (creds) => {
        if (!db) return null;
        const username =
          typeof creds?.username === "string" ? creds.username.trim() : "";
        const password =
          typeof creds?.password === "string" ? creds.password : "";
        if (!username || !password) return null;

        const [row] = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            email: users.email,
            avatarUrl: users.avatarUrl,
            passwordHash: users.passwordHash,
          })
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!row?.passwordHash) return null;
        const ok = await verifyPassword(password, row.passwordHash);
        if (!ok) return null;

        return {
          id: row.id,
          name: row.displayName ?? row.username ?? undefined,
          email: row.email ?? undefined,
          image: row.avatarUrl ?? undefined,
        };
      },
    }),
  ],
});
