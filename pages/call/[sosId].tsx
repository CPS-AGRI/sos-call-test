import { useRouter } from "next/router";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState, useCallback, useRef } from "react";
import io from "socket.io-client";

export default function Call() {
  const router = useRouter();
  const { sosId, room, role } = router.query as {
    sosId?: string;
    room?: string;
    role?: string;
  };
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [endingCall, setEndingCall] = useState(false);
  const [hangupMessage, setHangupMessage] = useState<string | null>(null);
  const endingRef = useRef(false);

  useEffect(() => {
    endingRef.current = endingCall;
  }, [endingCall]);

  useEffect(() => {
    if (!room || !role || !sosId) return;

    const identity =
      role === "admin" ? `admin-${Date.now()}` : `station-${sosId}`;

    const fetchToken = async () => {
      try {
        const response = await fetch(
          `/sos/api/livekit/token?room=${room}&identity=${identity}&isAdmin=${
            role === "admin"
          }`
        );

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `Token API error ${response.status}: ${body || response.statusText}`
          );
        }

        const data = await response.json();
        const receivedToken =
          typeof data === "string"
            ? data
            : typeof data?.token === "string"
            ? data.token
            : null;

        if (!receivedToken) {
          console.error("Unexpected token response:", data);
          throw new Error("Token API did not return a valid token string");
        }

        setToken(receivedToken);
        setConnected(false);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch LiveKit token:", err);
        setError(
          err?.message ||
            "ไม่สามารถขอโทเคนสำหรับห้อง LiveKit ได้ กรุณาลองใหม่อีกครั้ง"
        );
      }
    };

    fetchToken();
  }, [room, role, sosId]);

  const navigateAway = useCallback(
    (delay = 0) => {
      const go = () => {
        if (role === "admin") {
          if (window.opener) {
            window.close();
          } else {
            window.location.href = "/admin";
          }
        } else {
          window.location.href = "/";
        }
      };
      if (delay > 0) {
        setTimeout(go, delay);
      } else {
        go();
      }
    },
    [role]
  );

  const handleRemoteHangup = useCallback(() => {
    if (endingRef.current) return;
    setHangupMessage("คู่สนทนาวางสายแล้ว");
    setEndingCall(true);
    navigateAway(1500);
  }, [navigateAway]);

  useEffect(() => {
    if (!sosId) return;
    const socket = io();

    socket.on("sos:ended", ({ sosId: endedId }: any) => {
      if (endedId === sosId) {
        handleRemoteHangup();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sosId, handleRemoteHangup]);

  const hangup = useCallback(async () => {
    if (endingRef.current || !sosId) return;
    setHangupMessage("กำลังวางสาย...");
    setEndingCall(true);
    try {
      await fetch("/sos/api/sos/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sosId }),
      });
    } catch (err) {
      console.error("Failed to notify hangup:", err);
    } finally {
      navigateAway(500);
    }
  }, [sosId, navigateAway]);

  if (error) {
    return (
      <div className="h-screen bg-black text-white flex flex-col gap-8 items-center justify-center text-center px-10">
        <p className="text-4xl font-bold text-red-400">
          เกิดปัญหาในการเชื่อมต่อห้องสนทนา
        </p>
        <p className="text-2xl text-gray-200 max-w-3xl">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 bg-red-600 hover:bg-red-700 text-white px-12 py-5 rounded-full text-2xl font-semibold shadow-xl"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center text-4xl text-white">
        กำลังเชื่อมต่อห้องสนทนา...
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
      connect={true}
      audio={true}
      video={true}
      onConnected={() => setConnected(true)}
      onDisconnected={() => setConnected(false)}
    >
      <div className="w-full max-w-4xl mx-auto my-10">
        {connected ? (
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] bg-black/40 backdrop-blur">
            <VideoConference />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-white text-2xl py-10">
            <p>กำลังเตรียมสตรีมวิดีโอ...</p>
          </div>
        )}
      </div>
      <RoomAudioRenderer />
      <button
        onClick={hangup}
        disabled={endingCall}
        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white px-16 py-8 rounded-full text-3xl font-bold shadow-2xl"
      >
        {role === "admin" ? "วางสาย" : "ยกเลิก SOS"}
      </button>
      {endingCall && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center text-white text-3xl">
          <div className="bg-black/60 px-10 py-8 rounded-2xl border border-white/20">
            {hangupMessage || "กำลังยุติสาย..."}
          </div>
        </div>
      )}
    </LiveKitRoom>
  );
}
