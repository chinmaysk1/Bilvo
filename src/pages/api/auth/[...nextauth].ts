// pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    householdId?: string | null;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module "next-auth" {
  interface Session {
    householdId?: string | null;
    accessToken?: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          // standard OpenID scopes only
          scope: "openid email profile",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      // Keep userId on token
      if (user?.id) token.userId = user.id;

      // Hydrate householdId from DB:
      // - on sign-in (user exists)
      // - on client-triggered update()
      // - if missing on an old token
      const shouldHydrate =
        !!user?.id || trigger === "update" || token.householdId === undefined;

      if (shouldHydrate) {
        const id = (user?.id ?? token.userId) as string | undefined;
        if (id) {
          const dbUser = await prisma.user.findUnique({
            where: { id },
            select: { householdId: true },
          });
          token.householdId = dbUser?.householdId ?? null;
        }
      }

      // Persist OAuth tokens if you’re using them elsewhere
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;

        await prisma.account.updateMany({
          where: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
          },
        });
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token?.userId) {
        (session.user as any).id = token.userId;
      }

      (session as any).householdId = token.householdId ?? null;

      if (token.accessToken) (session as any).accessToken = token.accessToken;

      // Optional: name lookup (kept from your version)
      if (token?.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId },
          select: { name: true },
        });
        if (dbUser?.name) session.user.name = dbUser.name;
      }

      return session;
    },
  },
};

export default NextAuth(authOptions);
