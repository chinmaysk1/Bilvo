import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (session) {
    res.json({ content: "This is protected content." });
  } else {
    res.status(401).json({ error: "Not signed in" });
  }
}
