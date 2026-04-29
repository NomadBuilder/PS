#!/usr/bin/env python3
"""
Fetch About Grief UpdateCategories + programs POST HTML, write static files
for GitHub Pages (search-form.html + fragments/*.html).

Run from repo root:  python3 scripts/export_aboutgrief.py
Requires: pip install -r scripts/requirements.txt
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

API_CATEGORIES = "https://aboutgrief.ca/umbraco/Surface/GriefContent/UpdateCategories"
API_PROGRAMS = "https://aboutgrief.ca/programs-and-services/"
HEADERS = {
    "User-Agent": "LMC-Programs-StaticExport/1.0 (+https://github.com/NomadBuilder/PS)",
    "Accept-Language": "en-US,en;q=0.9",
}

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "programs-manifest.json"
SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def extract_results_inner(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    el = soup.select_one("#results-container")
    if not el:
        raise ValueError("no #results-container in response")
    inner = el.decode_contents()
    if not inner.strip():
        return "<!-- empty results -->\n"
    return inner


def main() -> int:
    if not MANIFEST.exists():
        print("Missing programs-manifest.json at", MANIFEST, file=sys.stderr)
        return 1

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    fragments = manifest.get("fragments") or {}
    if not fragments:
        print("Manifest has no fragments", file=sys.stderr)
        return 1

    print("GET UpdateCategories (national form)…")
    r = SESSION.get(
        API_CATEGORIES,
        params={
            "location": "",
            "category": "",
            "subcategory": "",
            "lang": "en-US",
        },
        timeout=120,
    )
    r.raise_for_status()
    (ROOT / "search-form.html").write_text(r.text, encoding="utf-8")
    print("  wrote search-form.html", len(r.text), "bytes")

    for loc_key, rel_path in sorted(fragments.items(), key=lambda x: x[1]):
        out = ROOT / rel_path
        out.parent.mkdir(parents=True, exist_ok=True)
        label = "(national)" if loc_key == "" else loc_key
        if loc_key == "":
            # National listings are in the initial GET body; POST returns an empty shell.
            print("GET programs page (national results)…")
            pr = SESSION.get(API_PROGRAMS, timeout=180)
            pr.raise_for_status()
        else:
            data = {
                "location": loc_key,
                "category": "",
                "subcategory": "",
                "radius": "0",
                "postalCode": "",
            }
            print("POST programs", label, "…")
            pr = SESSION.post(API_PROGRAMS, data=data, timeout=180)
            pr.raise_for_status()
        inner = extract_results_inner(pr.text)
        out.write_text(inner, encoding="utf-8")
        print(" ", rel_path, len(inner), "bytes")
        time.sleep(0.35)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
