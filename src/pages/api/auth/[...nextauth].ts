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
    async jwt({ token, user, account }) {
      if (user?.id) token.userId = user.id;

      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;

        // Safer than update() (avoids "record not found" race)
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

      if (token.accessToken) {
        (session as any).accessToken = token.accessToken;
      }

      // Single DB lookup for both name + onboarding (and by userId)
      if (token?.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId },
          select: { name: true, hasCompletedOnboarding: true },
        });

        if (dbUser) {
          session.user.name = dbUser.name ?? session.user.name ?? null;
          (session as any).hasCompletedOnboarding =
            dbUser.hasCompletedOnboarding;
        }
      }

      return session;
    },
  },
};

export default NextAuth(authOptions);
