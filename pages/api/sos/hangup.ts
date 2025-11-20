import { prisma } from "../../../lib/prisma";
import { getIO } from "../../../lib/socket";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).end();

  const { sosId } = req.body;

  await prisma.sosEvent.update({
    where: { id: sosId },
    data: { status: "ended", endedAt: new Date() },
  });

  getIO().emit("sos:ended", { sosId });

  res.json({ success: true });
}
