#!/usr/bin/env node
/**
 * Split PS/IndigenousPrograms.html into per-location fragments for the widget manifest.
 * Run: node PS/split-indigenous-programs.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname);
const SOURCE = path.join(ROOT, "IndigenousPrograms.html");
const OUT_DIR = path.join(ROOT, "indigenous-fragments");

/** Comment label in source file -> program-location / map data-location value */
const LOCATION_MAP = {
  "Ontario filter": "Ontario",
  National: "",
  Alberta: "Alberta",
  "British Columbia": "British Columbia",
  Manitoba: "Manitoba",
  "New Brunswick": "New Brunswick",
  "Newfoundland and Labrador": "Newfoundland and Labrador",
  "Prince Edward Island": "Prince Edward Island",
  Quebec: "Quebec",
  Saskatchewan: "Saskatchewan",
  Yukon: "Yukon",
  "Northwest Territories": "Northwest Territories",
  Nunavut: "Nunavut",
};

function slugify(key) {
  if (key === "") {
    return "canada";
  }
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeFragment(html) {
  return html
    .replace(/<svg class="svg-inline--fa[^>]*>[\s\S]*?<\/svg><!-- <i class="fas fa-(plus|minus)"><\/i> -->/gi, function (_, icon) {
      return '<i class="fas fa-' + icon + '"></i>';
    })
    .trim();
}

function main() {
  const raw = fs.readFileSync(SOURCE, "utf8");
  const parts = raw.split(/<!--\s*([^>]+?)\s*-->/);
  const fragments = {};
  const seen = new Set();

  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i].trim();
    const body = normalizeFragment(parts[i + 1] || "");
    if (!body) {
      continue;
    }
    const location = LOCATION_MAP[label];
    if (location === undefined) {
      console.warn("Unknown section label (skipped):", label);
      continue;
    }
    const key = location === "" ? "" : location;
    if (seen.has(key)) {
      console.warn("Duplicate section for location (skipped):", key || "Canada");
      continue;
    }
    seen.add(key);
    fragments[key] = body;
  }

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const manifestFragments = {};
  Object.keys(fragments)
    .sort()
    .forEach(function (loc) {
      const file = "indigenous-" + slugify(loc) + ".html";
      fs.writeFileSync(path.join(OUT_DIR, file), fragments[loc], "utf8");
      manifestFragments[loc] = "indigenous-fragments/" + file;
      console.log("Wrote", file, "->", loc === "" ? "Canada (default)" : loc);
    });

  const manifest = {
    description:
      "Indigenous-only program listing snapshots from IndigenousPrograms.html. Keys match #program-location / map data-location.",
    fragments: manifestFragments,
  };

  fs.writeFileSync(
    path.join(ROOT, "indigenous-programs-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
  console.log("\nManifest:", path.join(ROOT, "indigenous-programs-manifest.json"));
  console.log("Fragment count:", Object.keys(manifestFragments).length);
}

main();
