import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");

sgMail.setApiKey(apiKey);

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!from) throw new Error("Missing SENDGRID_FROM_EMAIL");

  await sgMail.send({
    to: opts.to,
    from,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
