import { prisma } from "../../../lib/prisma";
import { getIO } from "../../../lib/socket";

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { stationId, stationName } = req.body;

  console.log("Received SOS:", { stationId, stationName });

  if (!stationId || !stationName) {
    return res.status(400).json({ error: "Missing stationId or stationName" });
  }

  const sos = await prisma.sosEvent.create({
    data: {
      stationId,
      stationName,
      status: "pending",
    },
  });

  const roomName = `sos-${sos.id}`;

  try {
    getIO()?.to("admins")?.emit("sos:new", {
      id: sos.id,
      stationId,
      stationName,
      roomName,
      createdAt: sos.createdAt,
    });
  } catch (e) {
    console.log("Socket not ready yet");
  }

  return res.status(200).json({
    sosId: sos.id,
    roomName,
  });
}

export const config = {
  api: {
    bodyParser: true,
  },
};
