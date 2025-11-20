from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Optional

try:
    import simpleaudio as sa
except ImportError:  # pragma: no cover
    sa = None  # type: ignore

logger = logging.getLogger(__name__)
__all__ = ["TonePlayer"]


class TonePlayer:
    """Loop a short PCM clip while the system waits for a remote answer."""

    def __init__(self, file_path: Optional[str]) -> None:
        self._enabled = bool(file_path and sa)
        self._wave: Optional["sa.WaveObject"] = None
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        if not self._enabled:
            if not sa:
                logger.warning(
                    "simpleaudio is not available; sound loop will be skipped"
                )
            return

        path = Path(file_path or "")
        if not path.exists():
            logger.warning("Tone file %s not found; disabling tone loop", path)
            self._enabled = False
            return

        self._wave = sa.WaveObject.from_wave_file(str(path))

    def start(self) -> None:
        if not self._enabled or self._thread:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if not self._enabled:
            return
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1)
        self._thread = None

    def _loop(self) -> None:
        if not self._wave:
            return
        while not self._stop_event.is_set():
            play_obj = self._wave.play()
            play_obj.wait_done()
