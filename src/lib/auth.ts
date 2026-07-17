import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

async function enrichTokenFromDb(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  // Prefer OWNER > ADMIN > MEMBER
  const preferred = await prisma.membership.findFirst({
    where: {
      userId,
      role: { in: ["OWNER", "ADMIN"] },
    },
    orderBy: { createdAt: "asc" },
  });
  const m = preferred ?? membership;
  return {
    role: m?.role ?? null,
    organizationId: m?.organizationId ?? null,
  };
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM ?? "Conference Booking <onboarding@resend.dev>",
      // In development without a key, Auth.js still creates the verification token;
      // the magic link is printed by NextAuth / visible in the VerificationToken table.
      ...(process.env.AUTH_RESEND_KEY
        ? {}
        : {
            sendVerificationRequest: async ({ identifier, url }) => {
              console.log("\n========== MAGIC LINK ==========");
              console.log(`To: ${identifier}`);
              console.log(`URL: ${url}`);
              console.log("================================\n");
            },
          }),
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (trigger === "update" && session) {
        const role = session.role ?? session.user?.role;
        const organizationId =
          session.organizationId ?? session.user?.organizationId;
        if (role !== undefined) token.role = role;
        if (organizationId !== undefined) {
          token.organizationId = organizationId;
        }
      } else if (token.sub) {
        // Always refresh membership from DB so signup/invites apply without re-login.
        const enrich = await enrichTokenFromDb(token.sub);
        token.role = enrich.role;
        token.organizationId = enrich.organizationId;
      }
      return token;
    },
  },
});
