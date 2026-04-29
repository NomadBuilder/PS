(function ($) {
  var API_PAGE = "https://aboutgrief.ca/programs-and-services/";
  var API_CATEGORIES =
    "https://aboutgrief.ca/umbraco/Surface/GriefContent/UpdateCategories";
  var ABOUT_GRIEF_ORIGIN = "https://aboutgrief.ca";

  var manifestPromise = null;

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
      var keyRegex = new RegExp("([?&])" + key + "[^&]*");
      if (urlQueryString.match(keyRegex) !== null) {
        params = urlQueryString.replace(keyRegex, "$1" + newParam);
      } else {
        params = urlQueryString + "&" + newParam;
      }
    }
    window.history.replaceState({}, "", baseUrl + params);
  }

  window.refreshResults = function (data, scrollToResults) {
    scrollToResults = !!scrollToResults;

    $("#results-container").html(
      '<p class="lmc-loading" role="status">Loading programs…</p>'
    );

    if (isStaticMode()) {
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
        next.postalCode = $("input#postalCode").val() || "";
      }

      updateQueryString("category", category || "");
      updateQueryString("subcategory", subcategory || "");

      refreshResults(next, true);
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
          next.postalCode = $("input#postalCode").val() || "";
        }

        updateQueryString("category", category || "");
        updateQueryString("subcategory", subcategory || "");

        refreshResults(next, true);
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
    var postalCode = $("#postalCode").val().trim();
    var province = getProvinceByPostalCode(postalCode);
    if (province) {
      $("#program-location").val(province);
    }
  }

  function tryAutofillPostalFromIp() {
    var postalCodeInput = $("input#postalCode");
    if (!postalCodeInput.length || postalCodeInput.val() !== "") {
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
      var location = $("#program-location").val() || "";
      var category = $("#program-category").val() || "";
      var subcategory = $("#program-subcategory").val() || "";
      var radius = $("#program-radius").val() || "0";
      var postalCode = $("input#postalCode").val() || "";

      updateQueryString("location", location);
      updateQueryString("category", category);
      updateQueryString("subcategory", subcategory);
      updateQueryString("radius", radius);
      updateQueryString("postalCode", postalCode);

      refreshResults(
        {
          location: location,
          category: category,
          subcategory: subcategory,
          radius: radius,
          postalCode: postalCode,
        },
        true
      );
    });

    $(document).on("click", "#reset", function (e) {
      e.preventDefault();
      updateQueryString("location", "");
      updateQueryString("category", "");
      updateQueryString("subcategory", "");
      updateQueryString("radius", "0");
      updateQueryString("postalCode", "");

      $("#program-location").val("");
      $("#program-category").val("");
      $("#program-subcategory").val("");
      $("#program-radius").val("0");
      $("input#postalCode").val("");
      refreshResults(nationalSearchPayload(), true);
    });

    $(document).on("change blur", "#postalCode", function () {
      setProvinceFromPostalCode();
    });

    $(document).on("click", "#pagination_button", function (e) {
      e.preventDefault();
      var page = $(this).attr("data-page");
      updateQueryString("page", page || "");
      refreshResults(
        {
          page: page,
          location: $("#program-location").val() || "",
          category: $("#program-category").val() || "",
          subcategory: $("#program-subcategory").val() || "",
          radius: $("#program-radius").val() || "0",
          postalCode: $("input#postalCode").val() || "",
        },
        true
      );
    });

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
          tryAutofillPostalFromIp();
          refreshResults(nationalSearchPayload());
        })
        .catch(function () {
          $("#search-container").html(
            '<p class="lmc-loading lmc-loading--error">Unable to load static search form.</p>'
          );
        });
      return;
    }

    $.ajax({
      type: "GET",
      url: API_CATEGORIES,
      data: {
        location: "",
        category: "",
        subcategory: "",
        lang: "en-US",
      },
      success: function (result) {
        $("#search-container").html(result);
        tryAutofillPostalFromIp();
      },
      error: function () {
        $("#search-container").html(
          '<p class="lmc-loading lmc-loading--error">Unable to load search form.</p>'
        );
      },
    });

    refreshResults(nationalSearchPayload());
  }

  $(function () {
    bindDelegatedUi();
    loadMapSvg();
    initCategoriesAndResults();
  });
})(jQuery);
