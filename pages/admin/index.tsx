import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";

let socket: any;

export default function Admin() {
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio("/sounds/sos-alert.mp3");
    audio.volume = 0.8;
    audioRef.current = audio;
    audio.load();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const getRoomName = (sos: any) => sos.roomName || `sos-${sos.id}`;

  const fetchSosList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/sos/api/sos/list");
      if (!res.ok) {
        throw new Error(`โหลดรายการ SOS ไม่สำเร็จ (${res.status})`);
      }
      const data = await res.json();
      setPending(data.pending ?? []);
      setHistory(data.history ?? []);
      setFetchError(null);
    } catch (err: any) {
      console.error("Failed to fetch SOS list:", err);
      setFetchError(
        err?.message || "ไม่สามารถโหลดรายการ SOS ได้ กรุณารีเฟรชหน้า"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSosList();
  }, [fetchSosList]);

  const playAlertSound = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setNeedsAudioUnlock(false);
    } catch (err) {
      console.log("ไม่สามารถเล่นเสียงแจ้งเตือนได้:", err);
      setNeedsAudioUnlock(true);
      const fallbackAudio = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/1642/1642-preview.mp3"
      );
      fallbackAudio.volume = 0.7;
      fallbackAudio.play().catch(() => {
        console.log(
          "ไม่สามารถเล่นเสียงสำรองได้ - กรุณาเพิ่มไฟล์เสียงและอนุญาตเสียง"
        );
      });
    }
  }, []);

  const enableAlertManually = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      audioRef.current.muted = true;
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.muted = false;
      audioRef.current.currentTime = 0;
      setNeedsAudioUnlock(false);
    } catch (err) {
      console.log("ยังไม่สามารถเปิดเสียงได้:", err);
      setAlertMessage("กรุณาอนุญาตให้เว็บไซต์เล่นเสียงแจ้งเตือน");
    }
  }, []);

  useEffect(() => {
    socket = io();
    socket.emit("admin:join");
    socket.on("sos:new", (data: any) => {
      setPending((prev) => {
        const exists = prev.some((s) => s.id === data.id);
        if (exists) return prev;
        return [...prev, data];
      });
      playAlertSound();
    });

    socket.on("sos:accepted", (payload: any) => {
      const { sosId } = payload;
      setPending((prev) => {
        const accepted = prev.find((s) => s.id === sosId);
        if (accepted) {
          setHistory((h) => [{ ...accepted, status: "accepted" }, ...h]);
        }
        return prev.filter((s) => s.id !== sosId);
      });
    });

    socket.on("sos:ended", ({ sosId }: any) => {
      setHistory((prev) =>
        prev.map((h) => (h.id === sosId ? { ...h, status: "ended" } : h))
      );
    });

    return () => socket?.disconnect();
  }, []);

  const accept = async (sos: any) => {
    const response = await fetch("/sos/api/sos/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sosId: sos.id, adminName: "Admin A" }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "ไม่สามารถรับสายได้");
      fetchSosList();
      return;
    }
    const { roomName: responseRoomName } = await response.json();
    const roomName = responseRoomName || getRoomName(sos);
    const win = window.open(
      `/call/${sos.id}?room=${roomName || getRoomName(sos)}&role=admin`,
      "_blank"
    );
    if (win) win.focus();
  };

  return (
    <div className="p-10 bg-gray-100 min-h-screen">
      <h1 className="text-5xl font-bold text-red-600 mb-8">ศูนย์ควบคุม SOS</h1>
      {needsAudioUnlock && (
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-900 flex flex-col gap-2">
          <p>เพื่อรับเสียงแจ้งเตือน กรุณากดปุ่มด้านล่างเพื่ออนุญาตเสียง</p>
          <button
            onClick={enableAlertManually}
            className="self-start bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg"
          >
            เปิดเสียงแจ้งเตือน
          </button>
        </div>
      )}
      {alertMessage && (
        <div className="mb-4 p-3 rounded bg-red-100 border border-red-300 text-red-700">
          {alertMessage}
        </div>
      )}
      {fetchError && (
        <div className="mb-6 p-4 rounded-lg bg-red-200 border border-red-400 text-red-800">
          {fetchError}
        </div>
      )}
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-orange-600 mb-4">
          กำลังแจ้งเหตุ ({pending.length})
        </h2>
        {loading && <p className="text-gray-500">กำลังโหลดข้อมูล...</p>}
        {!loading && pending.length > 0 && (
          <div className="mb-4 p-4 bg-red-100 border-4 border-red-500 rounded-lg">
            <p className="text-xl font-bold text-red-700">
              ⚠️ มี SOS รอรับ {pending.length} รายการ
            </p>
          </div>
        )}
        {pending.map((sos) => (
          <div
            key={sos.id}
            className="bg-white p-6 rounded-xl shadow-lg mb-4 border-4 border-red-600"
          >
            <p className="text-2xl font-bold text-red-600">{sos.stationName}</p>
            <p className="text-gray-600">
              เวลา: {new Date(sos.createdAt).toLocaleString("th-TH")}
            </p>
            <button
              onClick={() => accept(sos)}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white px-10 py-5 text-xl rounded-lg font-bold shadow-lg"
            >
              📞 รับสายทันที
            </button>
          </div>
        ))}
      </div>
      <div>
        <h2 className="text-3xl font-bold text-blue-600 mb-4">
          ประวัติการรับสาย
        </h2>
        {history.length === 0 ? (
          <p className="text-gray-500">ยังไม่มีประวัติ</p>
        ) : (
          history.map((sos) => (
            <div
              key={sos.id}
              className={`p-4 rounded-lg mb-3 ${
                sos.status === "ended" ? "bg-gray-300" : "bg-yellow-100"
              }`}
            >
              <p>
                <strong>{sos.stationName}</strong> →{" "}
                {sos.status === "ended" ? "วางสายแล้ว" : "กำลังสนทนา"}
              </p>
              <small>{new Date(sos.createdAt).toLocaleString("th-TH")}</small>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
