import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getIO } from "../../../lib/socket";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sosId, adminName } = req.body as {
    sosId?: string;
    adminName?: string;
  };

  if (!sosId || !adminName) {
    return res.status(400).json({ error: "Missing sosId or adminName" });
  }

  try {
    const result = await prisma.sosEvent.updateMany({
      where: {
        id: sosId,
        status: "pending",
      },
      data: {
        status: "accepted",
        acceptedBy: adminName,
        acceptedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return res
        .status(409)
        .json({ error: "สายนี้ถูกจับคู่แล้ว หรือไม่อยู่ในสถานะรอรับ" });
    }

    const updated = await prisma.sosEvent.findUnique({
      where: { id: sosId },
    });

    const payload = {
      sosId,
      stationId: updated?.stationId,
      stationName: updated?.stationName,
      acceptedBy: adminName,
      roomName: `sos-${sosId}`,
      acceptedAt: updated?.acceptedAt,
    };

    try {
      getIO().emit("sos:accepted", payload);
    } catch (socketErr) {
      console.warn("Socket emit failed:", socketErr);
    }

    return res.status(200).json({ success: true, roomName: payload.roomName });
  } catch (err: any) {
    console.error("Failed to accept SOS:", err);
    return res.status(500).json({
      error: "ไม่สามารถรับสายได้",
      details: err?.message ?? err?.toString(),
    });
  }
}
