#!/usr/bin/env node
/**
 * Compare About Grief Indigenous API listings vs static indigenous-fragments/.
 * Run: node PS/compare-indigenous-api-static.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(ROOT, "indigenous-programs-manifest.json"), "utf8")
);
const API = "https://aboutgrief.ca/programs-and-services/";

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

async function fetchApi(location) {
  const body = new URLSearchParams({
    location: location || "",
    category: "",
    subcategory: "Indigenous",
    radius: "0",
    postalCode: "",
  });
  const r = await fetch(API, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!r.ok) {
    throw new Error("HTTP " + r.status + " for " + (location || "Canada"));
  }
  return r.text();
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

(async function () {
  const entries = Object.entries(MANIFEST.fragments);
  let allMatch = true;
  console.log("\n=== Indigenous filter: API vs static snapshots ===\n");

  for (var i = 0; i < entries.length; i++) {
    var loc = entries[i][0];
    var rel = entries[i][1];
    var name = loc || "Canada";
    process.stderr.write("Fetching API: " + name + "...\n");
    var apiHtml = await fetchApi(loc);
    var staticHtml = readStatic(rel);
    var result = diffLists(name, extractTitles(apiHtml), extractTitles(staticHtml));
    if (!result.match) {
      allMatch = false;
    }
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
    await new Promise(function (r) {
      setTimeout(r, 250);
    });
  }

  console.log(
    allMatch
      ? "Overall: all regions MATCH."
      : "Overall: some regions DIFFER (see above)."
  );
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
