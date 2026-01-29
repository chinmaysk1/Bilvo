// pages/api/household/invite.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { assertHouseholdAdmin, AuthError } from "@/utils/household/permissions";
import sgMail from "@sendgrid/mail";

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { household, user } = await assertHouseholdAdmin(req, res);

    const { mode, name, email } = req.body as {
      mode: "email" | "sms";
      name?: string;
      email?: string;
    };

    if (mode !== "email") {
      return res.status(501).json({ error: "SMS invites not implemented yet" });
    }

    const toEmail = (email || "").trim().toLowerCase();
    if (!toEmail) return res.status(400).json({ error: "Email is required" });

    const apiKey = mustGetEnv("SENDGRID_API_KEY");
    const from = mustGetEnv("SENDGRID_FROM_EMAIL");
    const appUrl = mustGetEnv("NEXTAUTH_URL");

    sgMail.setApiKey(apiKey);

    const code = household.inviteCode; // <- reuse household invite code
    if (!code)
      return res
        .status(500)
        .json({ error: "Household invite code is missing" });

    const joinUrl = `${appUrl}/onboarding/join?code=${encodeURIComponent(code)}`;

    const inviterName = user?.name || user?.email || "A roommate";
    const recipientName = (name || "").trim();

    const subject = `Bilvo: ${inviterName} invited you to join ${household.name}`;

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
        <h2>You’ve been invited to join a household</h2>
        <p>${inviterName} invited you to join <b>${household.name}</b>.</p>
        ${recipientName ? `<p>Hi ${recipientName},</p>` : ""}
        <p>Invite code: <b style="font-size:18px;letter-spacing:2px">${code}</b></p>
        <p>
          <a href="${joinUrl}" style="display:inline-block;background:#008a4b;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600">
            Join household
          </a>
        </p>
        <p style="color:#666;font-size:12px">
          If the button doesn’t work, paste this link into your browser:<br/>
          ${joinUrl}
        </p>
      </div>
    `;

    await sgMail.send({
      to: toEmail,
      from,
      subject,
      html,
      text: `${inviterName} invited you to join ${household.name}. Invite code: ${code}. Join: ${joinUrl}`,
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error sending invite:", err);
    return res.status(500).json({ error: "Failed to invite member" });
  }
}
