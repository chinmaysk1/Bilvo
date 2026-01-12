// pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    hasCompletedOnboarding?: boolean;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module "next-auth" {
  interface Session {
    hasCompletedOnboarding?: boolean;
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
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      // Always keep userId on token
      if (user?.id) token.userId = user.id;

      // If client calls `update({ hasCompletedOnboarding: true })`
      if (
        trigger === "update" &&
        session?.hasCompletedOnboarding !== undefined
      ) {
        token.hasCompletedOnboarding = session.hasCompletedOnboarding;
      }

      // On sign-in (user exists) OR if token is missing the field, hydrate from DB
      // This is the part your middleware needs.
      if (
        (user?.id && token.hasCompletedOnboarding === undefined) ||
        (token.userId && token.hasCompletedOnboarding === undefined)
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { id: (user?.id ?? token.userId)! },
          select: { hasCompletedOnboarding: true },
        });
        token.hasCompletedOnboarding = dbUser?.hasCompletedOnboarding ?? false;
      }

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

      // expose these to client if you want
      if (token.accessToken) (session as any).accessToken = token.accessToken;
      (session as any).hasCompletedOnboarding =
        token.hasCompletedOnboarding ?? false;

      // Optional: keep your name lookup if you want, but it's not required for onboarding gating
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
