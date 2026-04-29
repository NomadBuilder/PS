# PS — static programs data + widget (GitHub Pages)

Public site: **`https://nomadbuilder.github.io/PS/`** after you enable Pages on **`main`** with source **/ (root)**.

This repo holds:

- **Static data:** `programs-manifest.json`, `search-form.html`, `fragments/*.html` (replace placeholders with About Grief exports).
- **Widget assets (same origin for GTM):** `programs-services.js`, `programs-services.css`, `canada-map.svg`, `aboutgrief-chrome.js`.
- **Live demo:** `index.html` sets `LMC_PROGRAMS_DATA_BASE` to this site so the widget loads data from here.
- **GTM:** copy `gtm-custom-html.html` into one Custom HTML tag on LMC (trim jQuery if the page already has it).

Upstream widget sources live in the **LMC Umbraco** project under `lmc-programs-widget/`; sync copies here when you change behaviour or styles.

---

## Static data layout (detail)

| File | Purpose |
|------|--------|
| `programs-manifest.json` | Maps province/territory keys (same strings as the map’s `data-location`, plus `""` for national) to fragment file paths. Declares `searchForm`. |
| `search-form.html` | Markup for `#search-container` (export from About Grief’s `UpdateCategories` response for a national load, or replace with your own as long as IDs match the widget). |
| `fragments/*.html` | Inner HTML for `#results-container` per region (export from About Grief’s programs POST: parse full HTML, take `#results-container` innerHTML). |

Fragments may instead be **JSON** with an `html` string if you prefer escaping in a pipeline.

**Pagination:** static mode loads one fragment per region; extra live-site pages are not fetched unless you extend the manifest and script.

## Enable GitHub Pages

1. Repo **Settings → Pages → Build and deployment**
2. Source: **Deploy from a branch**
3. Branch: **`main`** / **`/ (root)`**
4. Save; after the first push, check **`https://nomadbuilder.github.io/PS/programs-manifest.json`**

## Local preview

```bash
git clone https://github.com/NomadBuilder/PS.git
cd PS
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/index.html`.

## Minimal GTM on LMC

1. Host page should include `#map-root`, `#search-container`, `#results-container` (and jQuery, or use the snippet’s jQuery line).
2. Paste **`gtm-custom-html.html`** into one Custom HTML tag; URLs already target `nomadbuilder.github.io/PS`.
3. Remove the duplicate jQuery script from the snippet if LMC already loads jQuery.
