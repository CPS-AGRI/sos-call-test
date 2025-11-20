from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Optional, Tuple

import requests
from livekit import rtc

from tone import TonePlayer

logger = logging.getLogger(__name__)


@dataclass
class DialerConfig:
    api_base_url: str
    station_id: str
    station_name: str
    livekit_url: str
    gpio_pin: int = 17
    button_debounce: float = 0.05
    wait_tone_path: Optional[str] = None
    accept_timeout_seconds: int = 90

    @classmethod
    def from_env(cls) -> "DialerConfig":
        def _get(name: str, default: Optional[str] = None) -> str:
            value = os.getenv(name, default)
            if value is None:
                raise RuntimeError(f"Missing environment variable: {name}")
            return value

        api_base = _get("API_BASE_URL").rstrip("/")
        station_id = _get("STATION_ID")
        station_name = _get("STATION_NAME")
        livekit_url = _get("LIVEKIT_URL")
        gpio_pin = int(os.getenv("GPIO_PIN", "17"))
        debounce = float(os.getenv("BUTTON_DEBOUNCE", "0.05"))
        tone_path = os.getenv("WAIT_TONE_PATH")
        accept_timeout = int(os.getenv("ACCEPT_TIMEOUT_SECONDS", "90"))

        return cls(
            api_base_url=api_base,
            station_id=station_id,
            station_name=station_name,
            livekit_url=livekit_url,
            gpio_pin=gpio_pin,
            button_debounce=debounce,
            wait_tone_path=tone_path,
            accept_timeout_seconds=accept_timeout,
        )


def _create_sos_event(config: DialerConfig) -> Tuple[str, str]:
    endpoint = f"{config.api_base_url}/api/sos"
    payload = {
        "stationId": config.station_id,
        "stationName": config.station_name,
    }
    logger.info("Creating SOS event at %s", endpoint)
    response = requests.post(endpoint, json=payload, timeout=15)
    response.raise_for_status()
    data = response.json()
    sos_id = data["sosId"]
    room_name = data["roomName"]
    logger.info("SOS event %s created (room %s)", sos_id, room_name)
    return sos_id, room_name


def _fetch_livekit_token(config: DialerConfig, room_name: str) -> str:
    endpoint = f"{config.api_base_url}/api/livekit/token"
    identity = f"station-{config.station_id}"
    params = {"room": room_name, "identity": identity}
    logger.info("Requesting LiveKit token for %s", identity)
    response = requests.get(endpoint, params=params, timeout=15)
    response.raise_for_status()
    token = response.json().get("token")
    if not token:
        raise RuntimeError("LiveKit token response missing 'token' field")
    return token


async def _connect_room(config: DialerConfig, token: str, tone: TonePlayer) -> None:
    room = rtc.Room()

    def _on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        logger.info("Remote participant connected: %s", participant.identity)
        tone.stop()

    room.on("participant_connected", _on_participant_connected)

    tone.start()
    logger.info("Connecting to LiveKit room…")
    await room.connect(config.livekit_url, token)

    audio_track = rtc.LocalAudioTrack.create_from_default_device()
    video_track = rtc.LocalVideoTrack.create_from_default_device()

    logger.info("Publishing local audio/video tracks")
    await room.local_participant.publish_track(audio_track)
    await room.local_participant.publish_track(video_track)

    try:
        await asyncio.wait_for(room.wait_for_disconnect(), timeout=config.accept_timeout_seconds)
    except asyncio.TimeoutError:
        logger.warning("Timed out waiting for remote participant; hanging up")
    finally:
        tone.stop()
        await room.disconnect()


async def dial_once(config: DialerConfig) -> None:
    tone = TonePlayer(config.wait_tone_path)
    sos_id, room_name = _create_sos_event(config)
    token = _fetch_livekit_token(config, room_name)
    try:
        await _connect_room(config, token, tone)
    finally:
        logger.info("Call flow completed for SOS %s", sos_id)
