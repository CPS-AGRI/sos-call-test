import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [pending, history] = await Promise.all([
      prisma.sosEvent.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sosEvent.findMany({
        where: { status: { in: ["accepted", "ended"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const withRoomName = (items: any[]) =>
      items.map((item) => ({
        ...item,
        roomName: item.roomName ?? `sos-${item.id}`,
      }));

    res.status(200).json({
      pending: withRoomName(pending),
      history: withRoomName(history),
    });
  } catch (err: any) {
    console.error("Failed to fetch SOS history:", err);
    res.status(500).json({
      error: "Failed to fetch SOS history",
      details: err?.message ?? err?.toString(),
    });
  }
}

