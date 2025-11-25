import { useState } from "react";

export default function SosButton({
  stationId,
  stationName,
}: {
  stationId: string;
  stationName: string;
}) {
  const [loading, setLoading] = useState(false);

  const trigger = async () => {
    setLoading(true);
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
      } catch (mediaError: any) {
        alert(
          `ไม่สามารถเข้าถึงกล้องหรือไมค์ได้: ${mediaError.message}\nกรุณาอนุญาตการเข้าถึงกล้องและไมค์`
        );
        setLoading(false);
        return;
      }
      const response = await fetch("/api/sos/sos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stationId: stationId,
          stationName: stationName,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(`ข้อผิดพลาด: ${data.error || response.status}`);
        return;
      }
      window.location.href = `/call/${data.sosId}?room=${data.roomName}&role=station`;
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถเชื่อมต่อได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={trigger}
      disabled={loading}
      className="bg-red-600 hover:bg-red-700 text-white font-bold text-6xl px-32 py-24 rounded-full shadow-2xl animate-pulse"
    >
      {loading ? "กำลังเรียก..." : "SOS"}
    </button>
  );
}
