(function ($) {
  var API_PAGE = "https://aboutgrief.ca/programs-and-services/";
  var API_CATEGORIES =
    "https://aboutgrief.ca/umbraco/Surface/GriefContent/UpdateCategories";
  var ABOUT_GRIEF_ORIGIN = "https://aboutgrief.ca";

  var manifestPromise = null;
  var liveFormRefreshTimer = null;

  /**
   * Listings use root-relative URLs (/Assets/..., /media/...). On LMC or GitHub
   * Pages those resolve to the wrong host and icons break — point them at About Grief.
   */
  function absolutizeAboutGriefMediaInHtml(html) {
    if (!html || typeof html !== "string") {
      return html;
    }
    return html
      .replace(/(\b(?:href|src))="\/(?!\/)/g, '$1="' + ABOUT_GRIEF_ORIGIN + "/")
      .replace(/\baction="\/(?!\/)/g, 'action="' + ABOUT_GRIEF_ORIGIN + "/")
      .replace(/url\(\/(?!\/)/g, "url(" + ABOUT_GRIEF_ORIGIN + "/");
  }

  function getProgramsDataBase() {
    var w = window.LMC_PROGRAMS_DATA_BASE;
    if (w && typeof w === "string" && $.trim(w) !== "") {
      return w.replace(/\/?$/, "/");
    }
    var el = document.querySelector("script[data-lmc-programs-static-base]");
    if (el) {
      var b = el.getAttribute("data-lmc-programs-static-base");
      if (b && $.trim(b) !== "") {
        return b.replace(/\/?$/, "/");
      }
    }
    return null;
  }

  function isStaticMode() {
    return getProgramsDataBase() !== null;
  }

  /**
   * Static fragments are keyed by location only (see programs-manifest.json).
   * Subcategory / category / postal / radius filters must use the live About Grief
   * POST endpoint or filtered searches (e.g. Indigenous) show the wrong cached HTML.
   */
  function hasActiveResultFilters(data) {
    if (!data || typeof data !== "object") {
      return false;
    }
    var sub = (data.subcategory && String(data.subcategory).trim()) || "";
    var cat = (data.category && String(data.category).trim()) || "";
    var pc = (data.postalCode && String(data.postalCode).trim()) || "";
    if (sub || cat || pc) {
      return true;
    }
    var r =
      data.radius !== undefined && data.radius !== null
        ? String(data.radius).trim()
        : "";
    if (r && r !== "0") {
      return true;
    }
    if (data.page !== undefined && data.page !== null && String(data.page).trim() !== "") {
      return true;
    }
    return false;
  }

  function loadManifest() {
    var base = getProgramsDataBase();
    if (!base) {
      return Promise.reject(new Error("no static base"));
    }
    if (manifestPromise) {
      return manifestPromise;
    }
    manifestPromise = fetch(base + "programs-manifest.json").then(function (
      r
    ) {
      if (!r.ok) {
        throw new Error("manifest");
      }
      return r.json();
    });
    return manifestPromise;
  }

  function scrollResultsIntoView() {
    var el = document.getElementById("results-container");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /** Apply fragment body: raw HTML or JSON { "html": "..." }. */
  function applyResultsFragmentText(text) {
    var trimmed = (text || "").trim();
    if (trimmed.charAt(0) === "{") {
      try {
        var j = JSON.parse(trimmed);
        if (j && typeof j.html === "string") {
          return j.html;
        }
      } catch (e) {}
    }
    return text;
  }

  /** Full-page POST (no XHR header) returns whole document; partial returns HTML fragment only. */
  function extractResultsFragment(html) {
    if (!html || typeof html !== "string") {
      return html;
    }
    var trimmed = html.trim();
    if (!/<\s*html[\s>]/i.test(trimmed)) {
      return html;
    }
    try {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var el = doc.querySelector("#results-container");
      if (el) {
        return el.innerHTML;
      }
    } catch (e) {}
    return null;
  }

  /** National default: first category (e.g. Advocacy) open so listings match aboutgrief.ca behaviour. */
  function enhanceNationalDefaultView() {
    var $c = $("#results-container");
    var hasNational = false;
    $c.find(".program-service__title").each(function () {
      if ($.trim($(this).text()) === "National") {
        hasNational = true;
        return false;
      }
    });
    if (!hasNational) {
      return;
    }
    var $first = $c.find(".program-service-block .faq > .faq__items").first();
    var $acc = $first.find("> .faq__item-accordion").first();
    if ($acc.length && !$acc.hasClass("-active")) {
      $acc.addClass("-active");
      $acc.find(".faq__item-icon").first().addClass("-active");
    }
  }

  function nationalSearchPayload() {
    return {
      location: "",
      category: "",
      subcategory: "",
      radius: "0",
      postalCode: "",
    };
  }

  /** Postal field id/name varies slightly across exports; resolve one jQuery collection. */
  function postalInput$() {
    return $(
      "#search-container input#postalCode, #search-container #postalCode, #search-container input[name='postalCode'], input#postalCode, #postalCode"
    )
      .filter("input")
      .first();
  }

  function programsUrlParams() {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch (e) {
      return new URLSearchParams();
    }
  }

  /** Set <select> only if an option matches (avoids silent clears on typos in URL). */
  function setSelectValueIfAllowed($select, raw) {
    if (!$select.length) {
      return;
    }
    var v = raw == null ? "" : String(raw);
    var has = $select.find("option").filter(function () {
      var $o = $(this);
      var ov = $o.attr("value");
      if (ov === undefined) {
        return ($o.val() || "") === v;
      }
      return ov === v;
    }).length;
    if (has) {
      $select.val(v);
    }
  }

  /** Coerce POST body to strings the Umbraco surface expects; drop stray undefined. */
  function normalizeProgramsPayload(data) {
    var d = data && typeof data === "object" ? data : {};
    var o = {
      location: d.location != null ? String(d.location) : "",
      category: d.category != null ? String(d.category) : "",
      subcategory: d.subcategory != null ? String(d.subcategory) : "",
      radius:
        d.radius != null && String(d.radius).trim() !== ""
          ? String(d.radius)
          : "0",
      postalCode: d.postalCode != null ? String(d.postalCode) : "",
    };
    if (d.page != null && String(d.page).trim() !== "") {
      o.page = String(d.page).trim();
    }
    /**
     * About Grief POST returns an empty #results-container when "Who is it for" (subcategory)
     * is set but national location is "". The form uses value="" for Canada; POST needs
     * location=Canada to render national audience-filtered HTML (curl-verified vs ?location=).
     */
    if ($.trim(o.subcategory) !== "" && $.trim(o.location) === "") {
      o.location = "Canada";
    }
    return o;
  }

  /**
   * Apply ?location=&category=&… to the form.
   * @param {boolean} applyDefaultsForAbsentKeys — if true (e.g. browser back/forward), reset fields whose keys are missing from the URL.
   */
  function syncProgramsFormFromUrl(applyDefaultsForAbsentKeys) {
    applyDefaultsForAbsentKeys = !!applyDefaultsForAbsentKeys;
    if (!window.location.search) {
      if (applyDefaultsForAbsentKeys) {
        $("#program-location").val("");
        $("#program-category").val("");
        $("#program-subcategory").val("");
        $("#program-radius").val("0");
        postalInput$().val("");
      }
      return;
    }
    var p = programsUrlParams();
    if (!hasProgramsSearchParamsInUrl()) {
      if (applyDefaultsForAbsentKeys) {
        $("#program-location").val("");
        $("#program-category").val("");
        $("#program-subcategory").val("");
        $("#program-radius").val("0");
        postalInput$().val("");
      }
      return;
    }
    if (p.has("location")) {
      setSelectValueIfAllowed($("#program-location"), p.get("location") || "");
    } else if (applyDefaultsForAbsentKeys) {
      $("#program-location").val("");
    }
    if (p.has("category")) {
      setSelectValueIfAllowed($("#program-category"), p.get("category") || "");
    } else if (applyDefaultsForAbsentKeys) {
      $("#program-category").val("");
    }
    if (p.has("subcategory")) {
      setSelectValueIfAllowed(
        $("#program-subcategory"),
        p.get("subcategory") || ""
      );
    } else if (applyDefaultsForAbsentKeys) {
      $("#program-subcategory").val("");
    }
    if (p.has("radius")) {
      setSelectValueIfAllowed($("#program-radius"), p.get("radius") || "0");
    } else if (applyDefaultsForAbsentKeys) {
      $("#program-radius").val("0");
    }
    if (p.has("postalCode")) {
      postalInput$().val(p.get("postalCode") || "");
    } else if (applyDefaultsForAbsentKeys) {
      postalInput$().val("");
    }
  }

  function resultsPayloadFromForm() {
    var o = {
      location: $("#program-location").val() || "",
      category: $("#program-category").val() || "",
      subcategory: $("#program-subcategory").val() || "",
      radius: $("#program-radius").val() || "0",
      postalCode: (postalInput$().val() || "").trim(),
    };
    var p = programsUrlParams();
    if (p.has("page") && p.get("page")) {
      o.page = p.get("page");
    }
    return normalizeProgramsPayload(o);
  }

  function escapeForUrlQueryKey(key) {
    return String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function updateQueryString(key, value) {
    var baseUrl = [
      location.protocol,
      "//",
      location.host,
      location.pathname,
    ].join("");
    var urlQueryString = document.location.search;
    var newParam = key + "=" + encodeURIComponent(value);
    var params = "?" + newParam;

    if (urlQueryString) {
      var keyRegex = new RegExp(
        "([?&])" + escapeForUrlQueryKey(key) + "=[^&]*"
      );
      if (urlQueryString.match(keyRegex) !== null) {
        params = urlQueryString.replace(keyRegex, "$1" + newParam);
      } else {
        params = urlQueryString + "&" + newParam;
      }
    }
    window.history.replaceState({}, "", baseUrl + params);
  }

  function removeQueryStringKey(key) {
    var baseUrl = [
      location.protocol,
      "//",
      location.host,
      location.pathname,
    ].join("");
    var p = programsUrlParams();
    p.delete(key);
    var next = p.toString();
    window.history.replaceState({}, "", baseUrl + (next ? "?" + next : ""));
  }

  window.refreshResults = function (data, scrollToResults) {
    scrollToResults = !!scrollToResults;
    data = normalizeProgramsPayload(data);

    $("#results-container").html(
      '<p class="lmc-loading" role="status">Loading programs…</p>'
    );

    var useStaticFragment =
      isStaticMode() && !hasActiveResultFilters(data);

    if (useStaticFragment) {
      var base = getProgramsDataBase();
      var loc = typeof data.location === "string" ? data.location : "";
      loadManifest()
        .then(function (manifest) {
          var fr = manifest.fragments || {};
          var rel = Object.prototype.hasOwnProperty.call(fr, loc)
            ? fr[loc]
            : fr[""];
          if (!rel) {
            throw new Error("no fragment");
          }
          return fetch(base + rel).then(function (r) {
            if (!r.ok) {
              throw new Error("fragment");
            }
            return r.text();
          });
        })
        .then(function (text) {
          var html = absolutizeAboutGriefMediaInHtml(
            applyResultsFragmentText(text)
          );
          $("#results-container").html(html);
          enhanceNationalDefaultView();
          if (scrollToResults) {
            scrollResultsIntoView();
          }
        })
        .catch(function () {
          $("#results-container").html(
            '<p class="lmc-loading lmc-loading--error">Unable to load static program data. Check the manifest and fragment URLs.</p>'
          );
        });
      return;
    }

    $.ajax({
      url: API_PAGE,
      type: "POST",
      crossDomain: true,
      data: data,
      traditional: true,
      success: function (result) {
        var fragment = extractResultsFragment(result);
        if (fragment === null) {
          $("#results-container").html(
            '<p class="lmc-loading lmc-loading--error">Unable to parse results from the server response.</p>'
          );
          return;
        }
        $("#results-container").html(
          absolutizeAboutGriefMediaInHtml(fragment)
        );
        enhanceNationalDefaultView();
        if (scrollToResults) {
          scrollResultsIntoView();
        }
      },
      error: function (xhr) {
        if (
          xhr.status === 500 &&
          xhr.responseText &&
          xhr.responseText.indexOf("Google Geolocation API key") >= 0
        ) {
          window.alert(
            "Please check the validity of Google Geolocation API key."
          );
        }
        $("#results-container").html(
          '<p class="lmc-loading lmc-loading--error">Unable to load results. Try again later.</p>'
        );
      },
    });
  };

  window.refreshCategories = function (data) {
    if (isStaticMode()) {
      var loc =
        typeof data.location === "string" ? data.location : "";
      $("#program-location").val(loc);
      updateQueryString("location", loc || "");

      var category = $("#program-category").val();
      var subcategory = $("#program-subcategory").val();

      var next = {
        location: loc,
        category: category,
        subcategory: subcategory,
      };

      if (typeof data.radius !== "undefined") {
        next.radius = data.radius;
      } else {
        next.radius = $("#program-radius").val() || "0";
      }
      if (typeof data.postalCode !== "undefined") {
        next.postalCode = data.postalCode;
      } else {
        next.postalCode = (postalInput$().val() || "").trim();
      }

      updateQueryString("category", category || "");
      updateQueryString("subcategory", subcategory || "");

      refreshResults(normalizeProgramsPayload(next), true);
      return;
    }

    $.ajax({
      type: "GET",
      url: API_CATEGORIES,
      data: data,
      success: function (result) {
        $("#search-container").html(result);

        var category = $("#program-category").val();
        var subcategory = $("#program-subcategory").val();

        var next = {
          location: data.location,
          category: category,
          subcategory: subcategory,
        };

        if (typeof data.radius !== "undefined") {
          next.radius = data.radius;
        } else {
          next.radius = $("#program-radius").val() || "0";
        }
        if (typeof data.postalCode !== "undefined") {
          next.postalCode = data.postalCode;
        } else {
          next.postalCode = (postalInput$().val() || "").trim();
        }

        updateQueryString("category", category || "");
        updateQueryString("subcategory", subcategory || "");

        refreshResults(normalizeProgramsPayload(next), true);
      },
      error: function () {
        $("#search-container").html(
          '<p class="lmc-loading lmc-loading--error">Unable to load search form.</p>'
        );
      },
    });
  };

  function getProvinceByPostalCode(postalCode) {
    if (!postalCode) {
      return null;
    }

    postalCode = postalCode.toUpperCase().replace(/\s+/g, "");

    if (["X0A", "X0B", "X0C"].some(function (x) {
      return postalCode.indexOf(x) === 0;
    })) {
      return "Nunavut";
    }

    if (["X1A", "X0E", "X0G"].some(function (x) {
      return postalCode.indexOf(x) === 0;
    })) {
      return "Northwest Territories";
    }

    var firstLetter = postalCode.charAt(0);
    var provinceMap = {
      A: "Newfoundland and Labrador",
      B: "Nova Scotia",
      C: "Prince Edward Island",
      E: "New Brunswick",
      G: "Quebec",
      H: "Quebec",
      J: "Quebec",
      K: "Ontario",
      L: "Ontario",
      M: "Ontario",
      N: "Ontario",
      P: "Ontario",
      R: "Manitoba",
      S: "Saskatchewan",
      T: "Alberta",
      V: "British Columbia",
      Y: "Yukon",
    };

    return provinceMap[firstLetter] || null;
  }

  function setProvinceFromPostalCode() {
    var $in = postalInput$();
    if (!$in.length) {
      return;
    }
    var postalCode = ($in.val() || "").trim();
    var province = getProvinceByPostalCode(postalCode);
    if (province) {
      setSelectValueIfAllowed($("#program-location"), province);
    }
  }

  /**
   * If the URL already carries programs filters (e.g. subcategory=Indigenous&location=),
   * do not infer postal/location from IP — that would overwrite national "Canada" and break
   * audience-only searches after syncProgramsFormFromUrl().
   */
  function hasProgramsSearchParamsInUrl() {
    if (!window.location.search) {
      return false;
    }
    var keys = [
      "location",
      "category",
      "subcategory",
      "postalCode",
      "radius",
      "page",
    ];
    var p = programsUrlParams();
    for (var i = 0; i < keys.length; i++) {
      if (p.has(keys[i])) {
        return true;
      }
    }
    return false;
  }

  function tryAutofillPostalFromIp() {
    if (hasProgramsSearchParamsInUrl()) {
      return;
    }
    var postalCodeInput = postalInput$();
    if (!postalCodeInput.length || (postalCodeInput.val() || "").trim() !== "") {
      return;
    }

    fetch("https://api.ipify.org?format=json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        return fetch(
          "https://ip-api.com/json/" +
            encodeURIComponent(data.ip) +
            "?fields=zip"
        );
      })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.zip) {
          postalCodeInput.val(data.zip);
          setProvinceFromPostalCode();
        }
      })
      .catch(function () {});
  }

  function bindDelegatedUi() {
    $(document).on("click", ".map-location", function (e) {
      e.preventDefault();
      var selectedLocation = $(this).attr("data-location");
      var selectedCategory = $("#program-category").val() || "";
      var selectedSubcategory = $("#program-subcategory").val() || "";

      $("#program-location").val(selectedLocation);
      updateQueryString("location", selectedLocation || "");
      updateQueryString("category", selectedCategory || "");
      updateQueryString("subcategory", selectedSubcategory || "");

      refreshCategories({
        location: selectedLocation,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        lang: "en-US",
      });
    });

    $(document).on("submit", "#programs-services-form", function (e) {
      e.preventDefault();
      $("#submit").trigger("click");
    });

    $(document).on("click", "#submit", function (e) {
      e.preventDefault();
      var payload = resultsPayloadFromForm();
      delete payload.page;

      updateQueryString("location", payload.location);
      updateQueryString("category", payload.category);
      updateQueryString("subcategory", payload.subcategory);
      updateQueryString("radius", payload.radius);
      updateQueryString("postalCode", payload.postalCode);
      removeQueryStringKey("page");

      refreshResults(payload, true);
    });

    $(document).on("click", "#reset", function (e) {
      e.preventDefault();
      removeQueryStringKey("page");
      updateQueryString("location", "");
      updateQueryString("category", "");
      updateQueryString("subcategory", "");
      updateQueryString("radius", "0");
      updateQueryString("postalCode", "");

      $("#program-location").val("");
      $("#program-category").val("");
      $("#program-subcategory").val("");
      $("#program-radius").val("0");
      postalInput$().val("");
      refreshResults(nationalSearchPayload(), true);
    });

    $(document).on(
      "change blur",
      "#search-container #postalCode, #search-container input[name='postalCode'], input#postalCode, #postalCode",
      function () {
        setProvinceFromPostalCode();
      }
    );

    $(document).on("click", "#pagination_button", function (e) {
      e.preventDefault();
      var page = $(this).attr("data-page");
      updateQueryString("page", page || "");
      refreshResults(resultsPayloadFromForm(), true);
    });

    $(document).on(
      "change",
      "#search-container #program-subcategory, #search-container #program-category, #search-container #program-location",
      function () {
        if (isStaticMode()) {
          return;
        }
        clearTimeout(liveFormRefreshTimer);
        liveFormRefreshTimer = setTimeout(function () {
          if (!$("#program-location").length) {
            return;
          }
          var location = $("#program-location").val() || "";
          var category = $("#program-category").val() || "";
          var subcategory = $("#program-subcategory").val() || "";
          updateQueryString("location", location);
          updateQueryString("category", category);
          updateQueryString("subcategory", subcategory);
          $.ajax({
            type: "GET",
            url: API_CATEGORIES,
            data: {
              location: location,
              category: category,
              subcategory: subcategory,
              lang: "en-US",
            },
            success: function (result) {
              $("#search-container").html(result);
              setSelectValueIfAllowed($("#program-location"), location);
              setSelectValueIfAllowed($("#program-category"), category);
              setSelectValueIfAllowed($("#program-subcategory"), subcategory);
            },
          });
        }, 280);
      }
    );

    $(document).on(
      "click",
      "#results-container .faq__item-accordion",
      function (e) {
        if ($(e.target).closest("a").length) {
          return;
        }
        var $acc = $(this);
        $acc.toggleClass("-active");
        $acc.find(".faq__item-icon").toggleClass("-active");
      }
    );

    $(document).on("click", "#results-container .faq__item-block", function (e) {
      if ($(e.target).closest("a").length) {
        return;
      }
      var $b = $(this);
      $b.find(".faq__item-icon").toggleClass("-active");
      $b.next(".faq__item-info").stop(true, true).slideToggle(200);
    });
  }

  function loadMapSvg() {
    var $host = $("#map-root");
    if (!$host.length) {
      return;
    }

    var src = $("script[data-lmc-programs-map]").attr("data-lmc-programs-map");
    if (!src) {
      src = "canada-map.svg";
    }

    fetch(src)
      .then(function (r) {
        if (!r.ok) {
          throw new Error("map");
        }
        return r.text();
      })
      .then(function (svg) {
        $host.html(svg);
      })
      .catch(function () {
        $host.html(
          '<p class="lmc-loading lmc-loading--error">Could not load the map. Ensure <code>canada-map.svg</code> is served from the same folder as this page (use a local web server, not file://).</p>'
        );
      });
  }

  function initCategoriesAndResults() {
    $("#search-container").html(
      '<p class="lmc-loading" role="status">Loading search…</p>'
    );

    if (isStaticMode()) {
      var base = getProgramsDataBase();
      loadManifest()
        .then(function (manifest) {
          var rel = manifest.searchForm;
          if (!rel) {
            throw new Error("no searchForm");
          }
          return fetch(base + rel).then(function (r) {
            if (!r.ok) {
              throw new Error("form");
            }
            return r.text();
          });
        })
        .then(function (html) {
          $("#search-container").html(html);
          syncProgramsFormFromUrl();
          tryAutofillPostalFromIp();
          refreshResults(resultsPayloadFromForm(), false);
        })
        .catch(function () {
          $("#search-container").html(
            '<p class="lmc-loading lmc-loading--error">Unable to load static search form.</p>'
          );
        });
      return;
    }

    var initCat = {
      location: "",
      category: "",
      subcategory: "",
      lang: "en-US",
    };
    if (window.location.search) {
      var up = programsUrlParams();
      if (up.has("location")) {
        initCat.location = up.get("location") || "";
      }
      if (up.has("category")) {
        initCat.category = up.get("category") || "";
      }
      if (up.has("subcategory")) {
        initCat.subcategory = up.get("subcategory") || "";
      }
    }

    $.ajax({
      type: "GET",
      url: API_CATEGORIES,
      data: initCat,
      success: function (result) {
        $("#search-container").html(result);
        syncProgramsFormFromUrl();
        tryAutofillPostalFromIp();
        refreshResults(resultsPayloadFromForm(), false);
      },
      error: function () {
        $("#search-container").html(
          '<p class="lmc-loading lmc-loading--error">Unable to load search form.</p>'
        );
      },
    });
  }

  $(function () {
    bindDelegatedUi();
    loadMapSvg();
    initCategoriesAndResults();

    $(window).on("popstate", function () {
      if (!$("#program-subcategory").length) {
        return;
      }
      syncProgramsFormFromUrl(true);
      refreshResults(resultsPayloadFromForm(), false);
    });
  });
})(jQuery);
