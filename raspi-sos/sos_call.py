#!/usr/bin/env python3
"""Hardware button entrypoint for the SOS auto-call flow."""

from __future__ import annotations

import asyncio
import logging
from signal import pause

from gpiozero import Button
from dotenv import load_dotenv

from dialer import DialerConfig, dial_once


logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s:%(name)s:%(message)s",
)
logger = logging.getLogger("sos_call")


async def _run_dial(config: DialerConfig) -> None:
    try:
        await dial_once(config)
    except Exception:
        logger.exception("SOS dialing flow failed")


def main() -> None:
    load_dotenv()
    config = DialerConfig.from_env()
    logger.info("Starting SOS watcher on GPIO %s", config.gpio_pin)

    button = Button(config.gpio_pin, pull_up=True, bounce_time=config.button_debounce)
    busy = {"value": False}

    def handle_press() -> None:
        if busy["value"]:
            logger.info("SOS already in progress; ignoring button press")
            return
        busy["value"] = True
        logger.info("Button pressed; launching SOS dialer")
        try:
            asyncio.run(_run_dial(config))
        finally:
            busy["value"] = False
            logger.info("Dialer run finished; ready for next press")

    button.when_pressed = handle_press
    logger.info("Waiting for button events… (Ctrl+C to exit)")
    try:
        pause()
    except KeyboardInterrupt:
        logger.info("Shutting down")


if __name__ == "__main__":
    main()
