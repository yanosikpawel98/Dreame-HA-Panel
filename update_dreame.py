#!/usr/bin/env python3
"""Dreame HA Panel: check GitHub and atomically install a new public JS build."""
from __future__ import annotations
import datetime as dt
import hashlib
import os
from pathlib import Path
import sys
import tempfile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SOURCE = "https://raw.githubusercontent.com/yanosikpawel98/Dreame-HA-Panel/main/dreame-html-card.js"
DEST = Path("/config/www/dreame-html-card.js")
BACKUPS = Path("/config/dreame-panel-backups")
MAX_BYTES = 500_000


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    req = Request(SOURCE, headers={
        "User-Agent": "Dreame-HomeAssistant-Updater/1.0",
        "Cache-Control": "no-cache"
    })
    with urlopen(req, timeout=18) as result:
        data = result.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES or len(data) < 5_000:
        raise ValueError("Nieoczekiwana wielkość pliku JavaScript")
    source = data.decode("utf-8")
    if not all(s in source for s in (
        "class DreameHtmlCard", "customElements.define", "dreame-html-card"
    )):
        raise ValueError("Nieprawidłowa zawartość pliku; aktualizacja przerwana")
    current = DEST.read_bytes() if DEST.exists() else None
    if current == data:
        print("UNCHANGED " + sha256(data)[:12])
        return
    DEST.parent.mkdir(parents=True, exist_ok=True)
    if current is not None:
        BACKUPS.mkdir(parents=True, exist_ok=True)
        timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = BACKUPS / f"dreame-html-card-{timestamp}-{sha256(current)[:10]}.js"
        backup.write_bytes(current)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=DEST.parent, prefix=".dreame-", suffix=".tmp", delete=False
        ) as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
            temporary = Path(out.name)
        os.replace(temporary, DEST)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    print("UPDATED " + sha256(data)[:12] + "; odśwież dashboard")


if __name__ == "__main__":
    try:
        main()
    except (OSError, HTTPError, URLError, ValueError, TimeoutError) as exc:
        print("UPDATE FAILED: " + str(exc), file=sys.stderr)
        sys.exit(1)
