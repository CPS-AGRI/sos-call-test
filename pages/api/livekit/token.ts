import { AccessToken, TrackSource } from "livekit-server-sdk";

export default async function handler(req: any, res: any) {
  const { room, identity } = req.query;

  if (!room || !identity) {
    return res.status(400).json({ error: "Missing room or identity" });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    return res.status(500).json({
      error:
        "LiveKit environment variables are missing. Please configure LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and NEXT_PUBLIC_LIVEKIT_URL.",
    });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: identity as string,
    ttl: "10m",
  });

  at.addGrant({
    roomJoin: true,
    room: room as string,
    canPublish: true,
    canSubscribe: true,
    canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA],
  });

  try {
    const token = await at.toJwt();
    return res.status(200).json({ token });
  } catch (err: any) {
    console.error("Failed to generate LiveKit token:", err);
    return res.status(500).json({
      error: "Failed to generate LiveKit token",
      details: err?.message ?? err?.toString(),
    });
  }
}
