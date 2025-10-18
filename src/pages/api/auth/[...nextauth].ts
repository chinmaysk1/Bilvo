// pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Augment the JWT so we can carry onboarding status in middleware
declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    hasCompletedOnboarding?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  // 1) Persist users/accounts/sessions in Postgres via Prisma
  adapter: PrismaAdapter(prisma),

  // 2) Keep JWT sessions so your middleware can read them
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // (optional) only allow verified Google emails:
      // allowDangerousEmailAccountLinking: false,
    }),
  ],

  callbacks: {
    /**
     * jwt() runs on sign-in and on every subsequent request.
     * We load minimal user fields from DB and store them in the token
     * so middleware can gate on hasCompletedOnboarding without extra DB calls there.
     */
    async jwt({ token, user, account }) {
      // On first sign-in, user is defined
      if (user?.id) {
        token.userId = user.id;
      }

      // When we have a userId (either just set above, or from a previous token),
      // fetch the latest onboarding flag from DB.
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId },
          select: { hasCompletedOnboarding: true },
        });
        if (dbUser) {
          token.hasCompletedOnboarding = dbUser.hasCompletedOnboarding;
        }
      }

      // (Optional) keep provider access token if you need it client-side
      if (account?.access_token) {
        (token as any).accessToken = account.access_token;
      }

      return token;
    },

    /**
     * session() exposes token fields to the client session if you need them there too.
     */
    async session({ session, token }) {
      if (token?.userId) (session as any).userId = token.userId;
      if (typeof token.hasCompletedOnboarding === "boolean") {
        (session as any).hasCompletedOnboarding = token.hasCompletedOnboarding;
      }
      if ((token as any).accessToken) {
        (session as any).accessToken = (token as any).accessToken;
      }
      return session;
    },

    /**
     * (Optional) signIn() gate:
     * If you want to ensure Google gives you a verified email, you can reject otherwise.
     * NextAuth with Prisma will:
     *   - find existing user by email and reuse it, OR
     *   - create a new User row
     *   - create/link an Account row for provider='google'
     * No duplicates as long as User.email is unique (it is in your schema).
     */
    // async signIn({ account, profile }) {
    //   if (account?.provider === "google") {
    //     const p = profile as any
    //     if (!p?.email_verified) return false
    //   }
    //   return true
    // },
  },
};

export default NextAuth(authOptions);
