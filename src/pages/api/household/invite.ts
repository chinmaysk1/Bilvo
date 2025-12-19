// pages/api/household/invite.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { assertHouseholdAdmin, AuthError } from "@/utils/household/permissions";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { household } = await assertHouseholdAdmin(req, res);

    const { mode, name, email, phone } = req.body as {
      mode: "email" | "sms";
      name?: string;
      email?: string;
      phone?: string;
    };

    // TODO: send actual email/SMS here

    return res.status(200).json("");
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error creating invite:", err);
    return res.status(500).json({ error: "Failed to invite member" });
  }
}
