#!/usr/bin/env python3
"""
Fetch About Grief UpdateCategories + programs POST HTML, write static files
for GitHub Pages (search-form.html + fragments/*.html).

Run from repo root:  python3 scripts/export_aboutgrief.py
Requires: pip install -r scripts/requirements.txt
"""
from __future__ import annotations

import json
import re
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


def strip_fragment_click_hints(inner: str) -> str:
    """Remove About Grief boilerplate lines we do not want on LMC."""
    pat1 = re.compile(
        r'(<div class="program-service__lists">)\s*'
        r'<p class="click-text display-default-all-sites"><b>Click on one of the listings below and you will get their full details</b></p>\s*',
        re.MULTILINE,
    )
    pat2 = re.compile(
        r'<div class="program-service__text-block">\s*'
        r'<p class="click-text display-grief"><b>Click on the listing for details or filter your results using the search bar above\.</b></p>\s*'
        r"</div>\s*",
        re.MULTILINE,
    )
    inner = pat1.sub(r"\1\n", inner, count=1)
    inner = pat2.sub("", inner, count=1)

    soup = BeautifulSoup(f'<div id="_lmc_frag_root">{inner}</div>', "html.parser")
    root = soup.find(id="_lmc_frag_root")
    if root:

        def has_class(el, part: str) -> bool:
            c = el.get("class")
            if not c:
                return False
            if isinstance(c, str):
                return part in c.split()
            return part in c

        for p in list(root.find_all("p")):
            if has_class(p, "click-text"):
                p.decompose()
        for div in list(root.find_all("div")):
            if has_class(div, "program-service__text-block"):
                if not div.get_text(strip=True):
                    div.decompose()
        inner = root.decode_contents()
    return inner


def extract_results_inner(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    el = soup.select_one("#results-container")
    if not el:
        raise ValueError("no #results-container in response")
    inner = el.decode_contents()
    if not inner.strip():
        return "<!-- empty results -->\n"
    return inner


def merge_search_form_blocks(html: str) -> str:
    """
    About Grief returns several .form-block rows; merge into one so CSS can
    lay out 5 fields in one row (or two rows max on tablet).
    """
    soup = BeautifulSoup(html, "html.parser")
    form = soup.find("form", id="programs-services-form")
    if not form:
        return html

    items = []
    remove_blocks = []
    for child in form.find_all("div", recursive=False):
        classes = child.get("class") or []
        if "form-buttons-container" in classes:
            continue
        if "form-block" not in classes:
            continue
        for sub in list(child.children):
            if not getattr(sub, "name", None) == "div":
                continue
            subcls = sub.get("class") or []
            if "form-block__item" in subcls:
                items.append(sub.extract())
        remove_blocks.append(child)

    if len(remove_blocks) < 2:
        return html

    for el in remove_blocks:
        el.decompose()

    new_block = soup.new_tag("div", attrs={"class": "form-block"})
    for it in items:
        new_block.append(it)

    btn = form.find(
        "div",
        class_=lambda c: bool(c) and "form-buttons-container" in (c if isinstance(c, list) else [c]),
    )
    if btn:
        btn.insert_before(new_block)
    else:
        form.append(new_block)

    return str(soup)


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
    merged = merge_search_form_blocks(r.text)
    (ROOT / "search-form.html").write_text(merged, encoding="utf-8")
    print("  wrote search-form.html", len(merged), "bytes (merged form-block)")

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
        inner = strip_fragment_click_hints(extract_results_inner(pr.text))
        out.write_text(inner, encoding="utf-8")
        print(" ", rel_path, len(inner), "bytes")
        time.sleep(0.35)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
