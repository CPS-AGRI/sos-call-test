import { AccessToken } from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

export const generateToken = (
  roomName: string,
  participantName: string,
  isAdmin = false
) => {
  const at = new AccessToken(apiKey, apiSecret, {
    identity: `${isAdmin ? "admin" : "station"}-${participantName}`,
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });
  return at.toJwt();
};

export const createRoomName = (sosId: string) => `sos-room-${sosId}`;
