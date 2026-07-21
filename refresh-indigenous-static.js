#!/usr/bin/env node
/**
 * Refresh indigenous-fragments/ from the live About Grief API.
 *
 * Run: node refresh-indigenous-static.js
 * Then: git add indigenous-fragments indigenous-programs-manifest.json && git commit && git push
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, "indigenous-fragments");
const API = "https://aboutgrief.ca/programs-and-services/";

const LOCATIONS = [
  "",
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

function slugify(key) {
  if (key === "") {
    return "canada";
  }
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildPostBody(loc) {
  const params = new URLSearchParams();
  params.set("SelectedLocation", loc);
  params.set("SelectedCategory", "");
  params.set("SelectedSubcategory", "Indigenous");
  params.set("SelectedRadius", "0");
  params.set("postalCode", "");
  params.set("location", loc);
  params.set("category", "");
  params.set("subcategory", "Indigenous");
  params.set("radius", "0");
  return params;
}

function extractFragment(html) {
  if (!html || typeof html !== "string") {
    return "";
  }
  const trimmed = html.trim();
  if (!/<\s*html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  const start = trimmed.search(/id=["']results-container["'][^>]*>/i);
  if (start < 0) {
    return null;
  }
  const afterOpen = trimmed.indexOf(">", start) + 1;
  let i = afterOpen;
  let depth = 1;
  while (i < trimmed.length && depth > 0) {
    const nextOpen = trimmed.indexOf("<div", i);
    const nextClose = trimmed.indexOf("</div>", i);
    if (nextClose < 0) {
      break;
    }
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        return trimmed.slice(afterOpen, nextClose).trim();
      }
      i = nextClose + 6;
    }
  }
  return null;
}

function countTitles(html) {
  const re = /program-item-title[^>]*>([^<]+)</gi;
  let n = 0;
  while (re.exec(html)) {
    n++;
  }
  return n;
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

(async function () {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  const manifestFragments = {};
  let failures = 0;

  for (var li = 0; li < LOCATIONS.length; li++) {
    var loc = LOCATIONS[li];
    var name = loc || "Canada";
    process.stderr.write("Fetching " + name + "...\n");
    var r = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: buildPostBody(loc),
    });
    var text = await r.text();
    if (!r.ok) {
      failures++;
      console.error("FAIL", name, r.status);
      await sleep(250);
      continue;
    }
    var fragment = extractFragment(text);
    if (fragment == null) {
      fragment = text.trim();
    }
    var titles = countTitles(fragment);
    var hasLists =
      fragment.indexOf("program-service__lists") >= 0 ||
      fragment.indexOf("program-service__title") >= 0;
    if (!hasLists && titles === 0) {
      failures++;
      console.error("EMPTY", name, "(skipping write)");
      await sleep(250);
      continue;
    }
    var file = "indigenous-" + slugify(loc) + ".html";
    fs.writeFileSync(path.join(OUT_DIR, file), fragment + "\n", "utf8");
    manifestFragments[loc] = "indigenous-fragments/" + file;
    console.log("OK", name, "listings~", titles, "bytes", fragment.length);
    await sleep(250);
  }

  var ordered = {};
  Object.keys(manifestFragments)
    .sort(function (a, b) {
      return a.localeCompare(b);
    })
    .forEach(function (k) {
      ordered[k] = manifestFragments[k];
    });

  var manifest = {
    description:
      "Indigenous-only program listing snapshots from About Grief API (refreshed). Keys match #program-location / map data-location.",
    refreshedAt: new Date().toISOString(),
    fragments: ordered,
  };
  fs.writeFileSync(
    path.join(ROOT, "indigenous-programs-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
  console.log("\nManifest fragments:", Object.keys(ordered).length);
  if (failures) {
    console.error("Completed with", failures, "failure(s).");
    process.exit(1);
  }
  console.log("Done. Commit and push to update GitHub Pages.");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
