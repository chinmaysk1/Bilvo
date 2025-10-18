// // pages/api/dashboard/data.ts
// import { getSession } from "next-auth/react";
// import { prisma } from "@/lib/prisma";

// export default async function handler(req, res) {
//   const session = await getSession({ req });

//   if (!session?.user?.email) {
//     return res.status(401).json({ error: "Unauthorized" });
//   }

//   // Fetch user with household, bills, activities
//   // Return formatted data
// }
