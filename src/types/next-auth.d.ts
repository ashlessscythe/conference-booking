/// <reference types="next-auth" />

import type { MembershipRole } from "@prisma/client";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: MembershipRole | null;
    organizationId?: string | null;
  }
}
