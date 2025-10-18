// pages/api/autopay/toggle.ts
export default async function handler(req, res) {
  const session = await getSession({ req });
  // Update user.autopayEnabled
}
