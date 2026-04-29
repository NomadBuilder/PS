# PS — Programs & services (GitHub Pages + GTM)

**How this fits your goal (GTM on LMC only):** Visitors still use **[LivingMyCulture.ca](https://livingmyculture.ca/)** as normal. **Google Tag Manager** injects one Custom HTML tag that loads the widget. That tag points at **this GitHub Pages site** only as a **static file host** (like a small CDN): `programs-manifest.json` plus **HTML fragments** per region (and the JS/CSS/SVG). We use **JSON for the manifest** and **`.html` files for listing bodies** because it is simple and avoids one huge JSON blob; the widget can also read a fragment file that contains JSON `{ "html": "..." }` if you prefer. **You do not publish a separate “programs page” on GitHub for end users**—Pages is just where GTM-fetched assets live.

**Demo / QA URL:** [https://nomadbuilder.github.io/PS/](https://nomadbuilder.github.io/PS/) (optional; same files GTM loads).

**Data source:** Exported HTML from [About Grief — Programs & services](https://aboutgrief.ca/programs-and-services/). Refresh periodically with the export script below. (Any old “Replace with exported #results-container…” notes were dev placeholders; current `fragments/*.html` are filled by `scripts/export_aboutgrief.py`.)

## Header / footer

- **GTM on Living My Culture (`gtm-custom-html.html`):** the snippet **replaces only the contents of the main `div.center`** (the column that holds the culture grid — **not** the first `div.center` on the page, since Umbraco can output several). The real **LMC header and footer stay**; we do **not** load `aboutgrief-chrome.js` there.
- **Standalone demo on GitHub Pages (`index.html`):** still uses **`aboutgrief-chrome.js`** to show About Grief’s header/footer in Shadow DOM, because **`X-Frame-Options`** blocks a normal cross-origin iframe of aboutgrief.ca.

## GTM on LMC

1. New **Custom HTML** tag → paste contents of **`gtm-custom-html.html`** (remove the jQuery `appendScript` block if the page already provides jQuery 3.x and call `loadPrograms()` after your jQuery is ready, or keep as-is).
2. **Trigger (recommended):** **DOM Ready** with a URL rule so the tag only runs when you want the programs view, for example:
   - **Page Path** equals `/culture/` or **Page URL** contains `livingmyculture.ca/culture`, **and**
   - **Page URL** matches RegEx so both `programs` and `services` appear in the query (e.g. `?programs&services`).
3. The script **clears `div.center` and injects** the map + search + results. Anything that was inside `.center` (intro, culture grid, partners block in that column) is removed for that page view—plan the trigger so that only happens on the intended URLs.
4. **Content-Security-Policy** on LMC must allow at least:
   - `script-src` / `connect-src`: `https://nomadbuilder.github.io`, `https://code.jquery.com`, `https://aboutgrief.ca`
   - `style-src`: `https://nomadbuilder.github.io`, `https://pro.fontawesome.com`, `https://aboutgrief.ca`, `https://fonts.googleapis.com`
   - `font-src`: `https://fonts.gstatic.com`, `https://pro.fontawesome.com`, `https://aboutgrief.ca` as needed (Capriola loads from Google Fonts for headings)
   - `img-src`: include **`https://aboutgrief.ca`** (listing icons and photos use their `/Assets/` and `/media/` URLs after the widget rewrites paths)

Do not inject the tag twice (duplicate `#map-root` / `#results-container` IDs).

## Refresh static data from About Grief

```bash
cd PS   # this repo
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/export_aboutgrief.py
git add search-form.html fragments && git commit -m "Refresh programs static export" && git push
```

National listings are taken from a **GET** of the programs page (POST returns an empty shell for national). Provinces/territories use **POST** as the live site does.

## Files

| Path | Purpose |
|------|--------|
| `programs-manifest.json` | Maps region keys → `fragments/*.html` paths + `searchForm`. |
| `search-form.html` | Search UI (from `UpdateCategories`). |
| `fragments/*.html` | `#results-container` inner HTML per region. |
| `programs-services.js`, `programs-services.css`, `canada-map.svg`, `aboutgrief-chrome.js` | Widget + chrome (same origin for GTM). |
| `gtm-custom-html.html` | One-tag embed for GTM. |

**Pagination:** static mode serves one HTML snapshot per region; extra live-site pages are not fetched unless you extend the export and `programs-services.js`.

## Local preview

```bash
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/index.html` (uses `LMC_PROGRAMS_DATA_BASE` relative to this folder).

## Smoke test (deployed site)

```bash
python3 scripts/smoke_test.py "https://nomadbuilder.github.io/PS/"
```

Optional second argument is the base URL; defaults to that URL. Verifies manifest, every fragment, search form, and core assets return HTTP 200 with expected content.
