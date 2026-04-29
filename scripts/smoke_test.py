#!/usr/bin/env python3
"""HTTP smoke checks for GitHub Pages deploy (stdlib only)."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

UA = {"User-Agent": "PS-smoke-test/1.0"}


def fetch(url: str, limit: int | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = resp.read(limit) if limit else resp.read()
        return resp.status, data


def main() -> int:
    base = (sys.argv[1] if len(sys.argv) > 1 else "https://nomadbuilder.github.io/PS/").strip()
    if not base.endswith("/"):
        base += "/"

    print("Base:", base)

    try:
        st, raw = fetch(base + "programs-manifest.json")
    except urllib.error.HTTPError as e:
        print("FAIL manifest HTTP", e.code, e.reason, file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print("FAIL manifest", e.reason, file=sys.stderr)
        return 1

    if st != 200:
        print("FAIL manifest status", st, file=sys.stderr)
        return 1

    manifest = json.loads(raw.decode("utf-8"))
    fragments = manifest.get("fragments") or {}
    sf = manifest.get("searchForm")
    if not sf:
        print("FAIL manifest.searchForm missing", file=sys.stderr)
        return 1

    print("OK manifest", len(fragments), "fragment keys")

    try:
        st, body = fetch(base + sf)
    except urllib.error.HTTPError as e:
        print("FAIL search form HTTP", e.code, file=sys.stderr)
        return 1
    if st != 200 or len(body) < 500:
        print("FAIL search form", st, "len", len(body), file=sys.stderr)
        return 1
    if b"programs-services-form" not in body:
        print("FAIL search form missing #programs-services-form", file=sys.stderr)
        return 1
    print("OK search-form.html", len(body), "bytes")

    for key, rel in sorted(fragments.items(), key=lambda x: x[1]):
        url = base + rel
        try:
            st, body = fetch(url)
        except urllib.error.HTTPError as e:
            print("FAIL", rel, "HTTP", e.code, file=sys.stderr)
            return 1
        if st != 200:
            print("FAIL", rel, "status", st, file=sys.stderr)
            return 1
        if len(body.strip()) < 50:
            print("FAIL", rel, "too small", len(body), file=sys.stderr)
            return 1
        print("OK", rel, len(body), "bytes")

    for path, needle in (
        ("programs-services.js", b"refreshResults"),
        ("programs-services.css", b"program-service"),
        ("canada-map.svg", b"<svg"),
        ("aboutgrief-chrome.js", b"Shadow DOM"),
    ):
        try:
            st, body = fetch(base + path, limit=8000)
        except urllib.error.HTTPError as e:
            print("FAIL", path, "HTTP", e.code, file=sys.stderr)
            return 1
        if st != 200 or needle not in body:
            print("FAIL", path, "status", st, "needle", needle in body, file=sys.stderr)
            return 1
        print("OK", path)

    print("All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
