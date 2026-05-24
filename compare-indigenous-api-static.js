#!/usr/bin/env node
/**
 * Compare About Grief Indigenous API vs static indigenous-fragments/.
 *
 * Mirrors widget behaviour:
 * - Static path: radius=0 (postal optional) → manifest fragment
 * - Live API: radius>0, missing static fragment, pagination
 *
 * Run: node PS/compare-indigenous-api-static.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(ROOT, "indigenous-programs-manifest.json"), "utf8")
);
const API = "https://aboutgrief.ca/programs-and-services/";

/** Same keys as programs-services.js toAboutGriefPostData(). */
function buildPostBody(data) {
  data = data || {};
  const loc = typeof data.location === "string" ? data.location : "";
  const cat = typeof data.category === "string" ? data.category : "";
  const sub = typeof data.subcategory === "string" ? data.subcategory : "Indigenous";
  const rad =
    data.radius != null && data.radius !== "" ? String(data.radius) : "0";
  const pc = typeof data.postalCode === "string" ? data.postalCode.trim() : "";
  const params = new URLSearchParams();
  params.set("SelectedLocation", loc);
  params.set("SelectedCategory", cat);
  params.set("SelectedSubcategory", sub);
  params.set("SelectedRadius", rad);
  params.set("postalCode", pc);
  if (rad === "0") {
    params.set("location", loc);
    params.set("category", cat);
    params.set("subcategory", sub);
    params.set("radius", rad);
  }
  if (data.page) {
    params.set("page", String(data.page));
  }
  return params;
}

function extractTitles(html) {
  const titles = [];
  const re = /program-item-title[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = m[1]
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (t) titles.push(t);
  }
  return [...new Set(titles)].sort((a, b) => a.localeCompare(b));
}

async function fetchApi(data, opts) {
  opts = opts || {};
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts.withXHR !== false) {
    headers["X-Requested-With"] = "XMLHttpRequest";
  }
  const r = await fetch(API, {
    method: "POST",
    headers: headers,
    body: buildPostBody(data),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text: text };
}

function readStatic(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function diffLists(label, apiTitles, staticTitles) {
  const apiSet = new Set(apiTitles);
  const staticSet = new Set(staticTitles);
  const onlyApi = apiTitles.filter(function (t) {
    return !staticSet.has(t);
  });
  const onlyStatic = staticTitles.filter(function (t) {
    return !apiSet.has(t);
  });
  return {
    label: label,
    apiCount: apiTitles.length,
    staticCount: staticTitles.length,
    onlyApi: onlyApi,
    onlyStatic: onlyStatic,
    match: onlyApi.length === 0 && onlyStatic.length === 0,
  };
}

function printDiff(result) {
  console.log("[" + (result.match ? "MATCH" : "DIFF") + "] " + result.label);
  console.log(
    "  API listings: " + result.apiCount + " | Static listings: " + result.staticCount
  );
  if (result.onlyApi.length) {
    console.log("  Only in API (" + result.onlyApi.length + "):");
    result.onlyApi.forEach(function (t) {
      console.log("    + " + t);
    });
  }
  if (result.onlyStatic.length) {
    console.log("  Only in static (" + result.onlyStatic.length + "):");
    result.onlyStatic.forEach(function (t) {
      console.log("    - " + t);
    });
  }
  console.log("");
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

/** Widget uses static when radius=0 and no pagination. */
function widgetUsesStatic(data) {
  if (data.page) return false;
  const rad = data.radius != null && data.radius !== "" ? String(data.radius) : "0";
  return rad === "0";
}

(async function () {
  let failures = 0;

  console.log("\n=== 1) Static path: production POST vs manifest fragments ===");
  console.log("    (radius=0, dual Selected*/legacy keys — what widget uses for browse)\n");

  const entries = Object.entries(MANIFEST.fragments);
  for (var i = 0; i < entries.length; i++) {
    var loc = entries[i][0];
    var rel = entries[i][1];
    var name = loc || "Canada";
    process.stderr.write("  Fetching API: " + name + "...\n");
    var resp = await fetchApi({
      location: loc,
      category: "",
      subcategory: "Indigenous",
      radius: "0",
      postalCode: "",
    });
    if (!resp.ok) {
      failures++;
      console.log("[FAIL] " + name + " — HTTP " + resp.status);
      console.log("");
      continue;
    }
    var result = diffLists(
      name,
      extractTitles(resp.text),
      extractTitles(readStatic(rel))
    );
    if (!result.match) failures++;
    printDiff(result);
    await sleep(200);
  }

  console.log("=== 2) Postal + Full Prov/Terr: API should match province static ===");
  console.log("    (widget serves static for this case; API must agree)\n");

  const postalCases = [
    { location: "Ontario", postalCode: "n2a0c1", rel: MANIFEST.fragments.Ontario },
    { location: "Alberta", postalCode: "t2p1j9", rel: MANIFEST.fragments.Alberta },
    { location: "British Columbia", postalCode: "v6b1a1", rel: MANIFEST.fragments["British Columbia"] },
  ];
  for (var j = 0; j < postalCases.length; j++) {
    var c = postalCases[j];
    process.stderr.write("  Fetching API: " + c.location + " + " + c.postalCode + "...\n");
    var data = {
      location: c.location,
      category: "",
      subcategory: "Indigenous",
      radius: "0",
      postalCode: c.postalCode,
    };
    if (!widgetUsesStatic(data)) {
      console.log("[SKIP] " + c.location + " — would not use static in widget");
      continue;
    }
    var postalResp = await fetchApi(data);
    if (!postalResp.ok) {
      failures++;
      console.log("[FAIL] " + c.location + " + postal — HTTP " + postalResp.status);
      console.log("");
      continue;
    }
    var postalResult = diffLists(
      c.location + " + postal " + c.postalCode,
      extractTitles(postalResp.text),
      extractTitles(readStatic(c.rel))
    );
    if (!postalResult.match) failures++;
    printDiff(postalResult);
    await sleep(200);
  }

  console.log("=== 3) Regions without static fragments (API-only fallback) ===\n");

  var nsResp = await fetchApi({
    location: "Nova Scotia",
    category: "",
    subcategory: "Indigenous",
    radius: "0",
    postalCode: "",
  });
  if (!nsResp.ok) {
    failures++;
    console.log("[FAIL] Nova Scotia — HTTP " + nsResp.status + " (widget falls back to API)\n");
  } else {
    var nsTitles = extractTitles(nsResp.text);
    console.log("[INFO] Nova Scotia — no static fragment; API returned " + nsTitles.length + " listing(s):");
    nsTitles.forEach(function (t) {
      console.log("    • " + t);
    });
    console.log("");
  }

  console.log("=== 4) Live API path smoke (radius > 0 — always API, not static) ===");
  console.log("    (expect HTTP 200; About Grief may return national HTML, not province static)\n");

  var radiusCases = [
    { location: "Ontario", postalCode: "n2a0c1", radius: "20" },
    { location: "Ontario", postalCode: "n2a0c1", radius: "50" },
    { location: "", postalCode: "m5v1j2", radius: "20" },
  ];
  for (var k = 0; k < radiusCases.length; k++) {
    var rc = radiusCases[k];
    var label =
      (rc.location || "Canada") +
      " / " +
      rc.postalCode +
      " / " +
      rc.radius +
      " km";
    process.stderr.write("  Fetching API: " + label + "...\n");
    var radResp = await fetchApi({
      location: rc.location,
      category: "",
      subcategory: "Indigenous",
      radius: rc.radius,
      postalCode: rc.postalCode,
    });
    if (!radResp.ok) {
      failures++;
      console.log("[FAIL] " + label + " — HTTP " + radResp.status);
    } else {
      var radTitles = extractTitles(radResp.text);
      var hasContent = radResp.text.indexOf("program-service__lists") >= 0;
      console.log(
        "[OK] " +
          label +
          " — HTTP 200, " +
          radTitles.length +
          " listing(s)" +
          (hasContent ? "" : " (warning: empty fragment)")
      );
      if (!hasContent) failures++;
    }
    await sleep(200);
  }
  console.log("");

  console.log("=== 5) Legacy vs production POST keys (Ontario browse) ===\n");

  var legacyBody = new URLSearchParams({
    location: "Ontario",
    category: "",
    subcategory: "Indigenous",
    radius: "0",
    postalCode: "",
  });
  var legacyResp = await fetch(API, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: legacyBody,
  });
  var prodResp = await fetchApi({
    location: "Ontario",
    category: "",
    subcategory: "Indigenous",
    radius: "0",
    postalCode: "",
  });
  var legacyTitles = extractTitles(await legacyResp.text());
  var prodTitles = extractTitles(prodResp.text);
  var keyResult = diffLists("Ontario legacy keys vs dual keys", legacyTitles, prodTitles);
  if (!keyResult.match) failures++;
  printDiff(keyResult);

  if (failures === 0) {
    console.log("Overall: PASS — static and API data align for all checked paths.\n");
    process.exit(0);
  }
  console.log("Overall: FAIL — " + failures + " check(s) failed (see above).\n");
  process.exit(1);
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
