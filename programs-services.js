(function ($) {
  var API_PAGE = "https://aboutgrief.ca/programs-and-services/";
  var API_CATEGORIES =
    "https://aboutgrief.ca/umbraco/Surface/GriefContent/UpdateCategories";
  var ABOUT_GRIEF_ORIGIN = "https://aboutgrief.ca";
  var INDIGENOUS_SUBCATEGORY = "Indigenous";

  var manifestPromise = null;
  var indigenousManifestPromise = null;

  function getProgramsScriptEl() {
    return document.querySelector("script[src*='programs-services.js']");
  }

  /** Dedicated Indigenous listing: same data as aboutgrief.ca ?subcategory=Indigenous (no search UI; redundant audience labels stripped). */
  function isIndigenousOnlyMode() {
    if (typeof window.LMC_PROGRAMS_MODE === "string") {
      if ($.trim(window.LMC_PROGRAMS_MODE).toLowerCase() === "indigenous-only") {
        return true;
      }
    }
    var el = getProgramsScriptEl();
    if (el) {
      var m = el.getAttribute("data-lmc-programs-mode");
      if (m && $.trim(m).toLowerCase() === "indigenous-only") {
        return true;
      }
    }
    return false;
  }

  function lockedSubcategory() {
    return isIndigenousOnlyMode() ? INDIGENOUS_SUBCATEGORY : null;
  }

  function indigenousNationalPayload() {
    return {
      location: "",
      category: "",
      subcategory: INDIGENOUS_SUBCATEGORY,
      radius: "0",
      postalCode: "",
    };
  }

  /** Indigenous-only: province (map-linked), postal code, and distance — audience always Indigenous. */
  function indigenousSearchPayloadFromForm() {
    return {
      location: $("#program-location").val() || "",
      category: "",
      subcategory: INDIGENOUS_SUBCATEGORY,
      radius: $("#program-radius").val() || "0",
      postalCode: $.trim($("input#postalCode").val() || ""),
    };
  }

  function injectIndigenousSearchForm() {
    var provinces =
      '<option value="">Canada</option>' +
      '<option value="Alberta">Alberta</option>' +
      '<option value="British Columbia">British Columbia</option>' +
      '<option value="Manitoba">Manitoba</option>' +
      '<option value="New Brunswick">New Brunswick</option>' +
      '<option value="Newfoundland and Labrador">Newfoundland and Labrador</option>' +
      '<option value="Prince Edward Island">Prince Edward Island</option>' +
      '<option value="Nova Scotia">Nova Scotia</option>' +
      '<option value="Quebec">Quebec</option>' +
      '<option value="Ontario">Ontario</option>' +
      '<option value="Saskatchewan">Saskatchewan</option>' +
      '<option value="Yukon">Yukon</option>' +
      '<option value="Northwest Territories">Northwest Territories</option>' +
      '<option value="Nunavut">Nunavut</option>';

    $("#search-container").html(
      '<div class="program-service__form lmc-indigenous-search-form">' +
        '<form id="programs-services-form" action="#">' +
        '<input type="hidden" id="program-category" name="category" value="" />' +
        '<select id="program-subcategory" name="subcategory" hidden aria-hidden="true" tabindex="-1">' +
        '<option value="' +
        INDIGENOUS_SUBCATEGORY +
        '" selected>' +
        INDIGENOUS_SUBCATEGORY +
        "</option></select>" +
        '<div class="form-block">' +
        '<div class="form-block__item">' +
        '<label for="program-location">Province/Territory</label>' +
        '<div class="input-block">' +
        '<select class="form-select form-input js-provinces item-code" id="program-location" name="location">' +
        provinces +
        "</select></div></div>" +
        '<div class="form-block__item">' +
        '<label for="postalCode">Postal Code</label>' +
        '<div class="input-block">' +
        '<input id="postalCode" name="postalCode" type="text" placeholder="code" class="form-input js-provinces item-code" autocomplete="postal-code" />' +
        "</div></div>" +
        '<div class="form-block__item">' +
        '<label for="program-radius">Distance</label>' +
        '<select class="form-select" id="program-radius" name="radius">' +
        '<option value="20">20 km</option>' +
        '<option value="50">50 km</option>' +
        '<option value="100">100 km</option>' +
        '<option value="250">250 km</option>' +
        '<option selected="selected" value="0">Full Prov/Terr</option>' +
        "</select></div>" +
        '<div class="form-block__item lmc-indigenous-search-form__btn">' +
        '<span class="lmc-indigenous-search-form__btn-label" aria-hidden="true">&nbsp;</span>' +
        '<div class="input-block">' +
        '<button id="submit" type="submit" class="form-submit">Search&nbsp;<i class="fas fa-angle-right"></i></button>' +
        "</div></div>" +
        '<div class="form-block__item lmc-indigenous-search-form__btn">' +
        '<span class="lmc-indigenous-search-form__btn-label" aria-hidden="true">&nbsp;</span>' +
        '<div class="input-block">' +
        '<button id="reset" type="button" class="program-reset">Reset</button>' +
        "</div></div></div></form></div>"
    );
  }

  /** Legacy: hide audience/type if an About Grief form fragment was injected. */
  function applyIndigenousOnlySearchFormLock() {
    if (!isIndigenousOnlyMode()) {
      return;
    }
    $("#program-category")
      .closest(".form-block__item")
      .addClass("lmc-indigenous-hide-field")
      .attr("aria-hidden", "true");
    var $sub = $("#program-subcategory");
    if (!$sub.length) {
      return;
    }
    $sub.val(INDIGENOUS_SUBCATEGORY);
    $sub.closest(".form-block__item")
      .addClass("lmc-indigenous-hide-field")
      .attr("aria-hidden", "true");
    $("#search-container label").each(function () {
      var t = $.trim($(this).text());
      if (/who\s+is\s+it\s+for|^type$/i.test(t)) {
        $(this)
          .closest(".form-block__item")
          .addClass("lmc-indigenous-hide-field")
          .attr("aria-hidden", "true");
      }
    });
  }

  /** @deprecated use injectIndigenousSearchForm */
  function injectIndigenousSearchStub() {
    $("#search-container").html(
      '<form id="programs-services-form" class="lmc-indigenous-stub-form" aria-hidden="true" tabindex="-1">' +
        '<input type="hidden" id="program-location" name="location" value="" />' +
        '<input type="hidden" id="program-category" name="category" value="" />' +
        '<select id="program-subcategory" name="subcategory" hidden>' +
        '<option value="' +
        INDIGENOUS_SUBCATEGORY +
        '" selected>' +
        INDIGENOUS_SUBCATEGORY +
        "</option>" +
        "</select>" +
        '<select id="program-radius" name="radius" hidden>' +
        '<option value="0" selected>0</option>' +
        "</select>" +
        '<input type="hidden" id="postalCode" name="postalCode" value="" />' +
        "</form>"
    );
  }

  /**
   * Server HTML repeats audience under each service type (h4 "Indigenous"). For this view the page is already scoped to Indigenous.
   */
  function postProcessIndigenousOnlyResultsHtml() {
    var $c = $("#results-container");
    if (!$c.length) {
      return;
    }
    $c.find(".faq__items-sub > h4").each(function () {
      var t = $.trim($(this).text());
      if (t.toLowerCase() === INDIGENOUS_SUBCATEGORY.toLowerCase()) {
        $(this).remove();
      }
    });
    var $intro = $c.find("p.mb-20").first();
    if ($intro.length && /showing results/i.test($intro.text())) {
      var loc = $.trim($("#program-location").val() || "");
      var pc = $.trim($("input#postalCode").val() || "");
      var rad = $("#program-radius").val() || "0";
      var place = loc
        ? " in <b>" + $("<span/>").text(loc).html() + "</b>"
        : " across <b>Canada</b>";
      var msg = "Indigenous programs and services" + place;
      if (pc && rad && rad !== "0") {
        msg += " within <b>" + $("<span/>").text(rad).html() + " km</b> of <b>" + $("<span/>").text(pc).html() + "</b>";
      } else if (pc) {
        msg += " near <b>" + $("<span/>").text(pc).html() + "</b>";
      }
      $intro.html("<i>" + msg + ".</i>");
    }
    $c.find(".click-text.display-grief").remove();
  }

  /** Close every category and listing accordion after results HTML is injected. */
  function collapseAllResultsAccordions() {
    var $c = $("#results-container");
    $c.find(".faq__item-accordion, .faq__item-icon").removeClass("-active");
    $c.find(".faq__item-info").hide();
  }

  /** True when a category block has at least one program listing title. */
  function categoryWrapperHasListings($wrapper) {
    return $wrapper.find(".program-item-title").length > 0;
  }

  /**
   * About Grief sometimes omits the category accordion when a province has one listing
   * (e.g. Alberta, New Brunswick). Insert a header so listings sit behind a closed accordion.
   */
  function repairOrphanCategoryAccordions() {
    var $c = $("#results-container");
    $c.find(".program-service-block .faq > .faq__items").each(function () {
      var $items = $(this);
      if ($items.children(".faq__item-accordion").length) {
        return;
      }
      var $wrapper = $items.children(".faq__items-wrapper").first();
      if (!$wrapper.length || !categoryWrapperHasListings($wrapper)) {
        $items.addClass("lmc-category-empty").hide();
        return;
      }
      var label = "Programs and services";
      var $acc = $(
        '<div class="faq__item-accordion lmc-synthetic-category">' +
          '<h3 class="h3"></h3>' +
          '<span class="faq__item-icon">' +
          '<i class="fas fa-plus"></i>' +
          '<i class="fas fa-minus"></i>' +
          "</span></div>"
      );
      $acc.find(".h3").text(label);
      $items.prepend($acc);
    });
  }

  /** Hide category rows with no listings; note when a province block is empty. */
  function pruneEmptyCategoryAccordions() {
    var $c = $("#results-container");

    $c.find(".faq__item-accordion").each(function () {
      var $acc = $(this);
      var $items = $acc.closest(".faq__items");
      var $wrapper = $acc.next(".faq__items-wrapper");
      if ($wrapper.length && categoryWrapperHasListings($wrapper)) {
        return;
      }
      $items.addClass("lmc-category-empty").hide();
    });

    $c.find(".program-service-block .faq > .faq__items").each(function () {
      var $items = $(this);
      if ($items.is(":hidden")) {
        return;
      }
      if ($items.children(".faq__item-accordion").length) {
        return;
      }
      var $wrapper = $items.children(".faq__items-wrapper").first();
      if (!$wrapper.length || !categoryWrapperHasListings($wrapper)) {
        $items.addClass("lmc-category-empty").hide();
      }
    });

    $c.find(".program-service-block").each(function () {
      var $block = $(this);
      $block.find(".lmc-province-empty-msg").remove();
      if ($block.find(".program-item-title").length) {
        return;
      }
      var province = $.trim(
        $block.prevAll(".program-service__title").first().text()
      );
      var place = province ? " for " + province : "";
      $block.find(".faq").first().append(
        '<p class="lmc-province-empty-msg">No Indigenous programs are listed' +
          place +
          ".</p>"
      );
    });
  }

  function normalizeIndigenousResultsAccordions() {
    if (!isIndigenousOnlyMode()) {
      return;
    }
    repairOrphanCategoryAccordions();
    pruneEmptyCategoryAccordions();
    collapseAllResultsAccordions();
  }

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

  function getIndigenousProgramsDataBase() {
    var w = window.LMC_INDIGENOUS_PROGRAMS_DATA_BASE;
    if (w && typeof w === "string" && $.trim(w) !== "") {
      return w.replace(/\/?$/, "/");
    }
    var el = getProgramsScriptEl();
    if (el) {
      var b = el.getAttribute("data-lmc-indigenous-programs-static-base");
      if (b && $.trim(b) !== "") {
        return b.replace(/\/?$/, "/");
      }
    }
    return null;
  }

  function useStaticIndigenousProgramsData() {
    return isIndigenousOnlyMode() && getIndigenousProgramsDataBase() !== null;
  }

  /** Static Indigenous snapshots: province/national browse at Full Prov/Terr (postal is display-only). Live API for distance radius. */
  function indigenousResultsCanUseStaticSnapshot(data) {
    if (data.page) {
      return false;
    }
    var rad = data.radius || "0";
    if (rad && rad !== "0") {
      return false;
    }
    return true;
  }

  function useStaticProgramsData() {
    return isStaticMode() && !isIndigenousOnlyMode();
  }

  function loadIndigenousManifest() {
    var base = getIndigenousProgramsDataBase();
    if (!base) {
      return Promise.reject(new Error("no indigenous base"));
    }
    if (indigenousManifestPromise) {
      return indigenousManifestPromise;
    }
    indigenousManifestPromise = fetch(
      base + "indigenous-programs-manifest.json"
    ).then(function (r) {
      if (!r.ok) {
        throw new Error("indigenous manifest");
      }
      return r.json();
    });
    return indigenousManifestPromise;
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

  function renderResultsHtml(html, scrollToResults) {
    $("#results-container").html(html);
    if (isIndigenousOnlyMode()) {
      postProcessIndigenousOnlyResultsHtml();
      normalizeIndigenousResultsAccordions();
    } else {
      enhanceNationalDefaultView();
    }
    if (scrollToResults) {
      scrollResultsIntoView();
    }
  }

  function fetchStaticResultsFragment(base, manifest, loc) {
    var fr = manifest.fragments || {};
    if (!Object.prototype.hasOwnProperty.call(fr, loc)) {
      return Promise.reject(new Error("no fragment"));
    }
    return fetch(base + fr[loc]).then(function (r) {
      if (!r.ok) {
        throw new Error("fragment");
      }
      return r.text();
    });
  }

  /** Map widget payload to About Grief Umbraco POST names. */
  function toAboutGriefPostData(data) {
    data = data || {};
    var loc = typeof data.location === "string" ? data.location : "";
    var cat = typeof data.category === "string" ? data.category : "";
    var sub = typeof data.subcategory === "string" ? data.subcategory : "";
    var rad =
      data.radius != null && data.radius !== "" ? String(data.radius) : "0";
    var pc = typeof data.postalCode === "string" ? $.trim(data.postalCode) : "";
    var payload;
    /* Browse (Full Prov/Terr): dual keys match About Grief province breakdown. */
    if (rad === "0") {
      payload = {
        SelectedLocation: loc,
        SelectedCategory: cat,
        SelectedSubcategory: sub,
        SelectedRadius: rad,
        postalCode: pc,
        location: loc,
        category: cat,
        subcategory: sub,
        radius: rad,
      };
    } else {
      /* Distance filter: legacy duplicate keys cause HTTP 500 on Umbraco POST. */
      payload = {
        SelectedLocation: loc,
        SelectedCategory: cat,
        SelectedSubcategory: sub,
        SelectedRadius: rad,
        postalCode: pc,
      };
    }
    if (data.page) {
      payload.page = data.page;
    }
    return payload;
  }

  function isProgramsPostFragmentEmpty(fragment) {
    if (fragment == null) {
      return true;
    }
    var s = String(fragment);
    if (!$.trim(s)) {
      return true;
    }
    return (
      s.indexOf("program-service__lists") < 0 &&
      s.indexOf("program-service__title") < 0
    );
  }

  /** Full-page POST omits list markup for national + audience unless we send location=Canada. */
  function payloadForCrossOriginFallback(postData) {
    var o = $.extend({}, postData);
    var sub = $.trim(o.subcategory || o.SelectedSubcategory || "");
    var loc = $.trim(o.location || o.SelectedLocation || "");
    if (sub !== "" && loc === "") {
      o.location = "Canada";
      o.SelectedLocation = "Canada";
    }
    return o;
  }

  function programsPostFetch(postData, withXHRHeader) {
    var headers = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    };
    if (withXHRHeader) {
      headers["X-Requested-With"] = "XMLHttpRequest";
    }
    return fetch(API_PAGE, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: headers,
      body: $.param(postData, true),
    }).then(function (response) {
      if (!response.ok) {
        var err = new Error("http");
        err.status = response.status;
        return response.text().then(function (text) {
          err.responseText = text;
          throw err;
        });
      }
      return response.text();
    });
  }

  function fetchResultsFromAboutGriefApi(data, scrollToResults) {
    var postData = toAboutGriefPostData(data);
    var didFallbackAttempt = false;

    function showProgramsAjaxError() {
      $("#results-container").html(
        '<p class="lmc-loading lmc-loading--error">Unable to load results. Try again later.</p>'
      );
    }

    function trySimplePostFallback() {
      if (didFallbackAttempt) {
        showProgramsAjaxError();
        return;
      }
      didFallbackAttempt = true;
      programsPostFetch(payloadForCrossOriginFallback(postData), false)
        .then(function (result) {
          var fragment = extractResultsFragment(result);
          if (fragment === null || isProgramsPostFragmentEmpty(fragment)) {
            showProgramsAjaxError();
            return;
          }
          renderResultsHtml(
            absolutizeAboutGriefMediaInHtml(fragment),
            scrollToResults
          );
        })
        .catch(showProgramsAjaxError);
    }

    programsPostFetch(postData, true)
      .then(function (result) {
        var fragment = extractResultsFragment(result);
        if (fragment === null) {
          trySimplePostFallback();
          return;
        }
        if (isProgramsPostFragmentEmpty(fragment)) {
          trySimplePostFallback();
          return;
        }
        renderResultsHtml(
          absolutizeAboutGriefMediaInHtml(fragment),
          scrollToResults
        );
      })
      .catch(function (err) {
        if (
          err.status === 500 &&
          err.responseText &&
          err.responseText.indexOf("Google Geolocation API key") >= 0
        ) {
          window.alert(
            "Please check the validity of Google Geolocation API key."
          );
        }
        trySimplePostFallback();
      });
  }

  window.refreshResults = function (data, scrollToResults) {
    scrollToResults = !!scrollToResults;
    data = data ? $.extend({}, data) : {};
    if (lockedSubcategory()) {
      data.subcategory = lockedSubcategory();
    }

    $("#results-container").html(
      '<p class="lmc-loading" role="status">Loading programs…</p>'
    );

    if (useStaticProgramsData()) {
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
          renderResultsHtml(
            absolutizeAboutGriefMediaInHtml(applyResultsFragmentText(text)),
            scrollToResults
          );
        })
        .catch(function () {
          $("#results-container").html(
            '<p class="lmc-loading lmc-loading--error">Unable to load static program data. Check the manifest and fragment URLs.</p>'
          );
        });
      return;
    }

    if (
      useStaticIndigenousProgramsData() &&
      indigenousResultsCanUseStaticSnapshot(data)
    ) {
      var indBase = getIndigenousProgramsDataBase();
      var indLoc = typeof data.location === "string" ? data.location : "";
      loadIndigenousManifest()
        .then(function (manifest) {
          return fetchStaticResultsFragment(indBase, manifest, indLoc);
        })
        .then(function (text) {
          renderResultsHtml(
            absolutizeAboutGriefMediaInHtml(applyResultsFragmentText(text)),
            scrollToResults
          );
        })
        .catch(function () {
          fetchResultsFromAboutGriefApi(data, scrollToResults);
        });
      return;
    }

    fetchResultsFromAboutGriefApi(data, scrollToResults);
  };

  window.refreshCategories = function (data) {
    data = data ? $.extend({}, data) : {};
    if (lockedSubcategory()) {
      data.subcategory = lockedSubcategory();
    }

    if (isIndigenousOnlyMode()) {
      var indLoc =
        typeof data.location === "string" ? data.location : "";
      $("#program-location").val(indLoc);
      updateQueryString("location", indLoc || "");
      updateQueryString("subcategory", INDIGENOUS_SUBCATEGORY);
      refreshResults(indigenousSearchPayloadFromForm(), true);
      return;
    }

    if (useStaticProgramsData()) {
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
        applyIndigenousOnlySearchFormLock();

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

  function syncStubFieldsFromUrl() {
    if (!isIndigenousOnlyMode()) {
      return;
    }
    try {
      var q = new URLSearchParams(window.location.search || "");
      var loc = q.get("location");
      if (loc !== null && $("#program-location").length) {
        $("#program-location").val(loc);
      }
      var cat = q.get("category");
      if (cat !== null && $("#program-category").length) {
        $("#program-category").val(cat);
      }
      var pc = q.get("postalCode");
      if (pc !== null && $("input#postalCode").length) {
        $("input#postalCode").val(pc);
      }
      var rad = q.get("radius");
      if (rad !== null && rad !== "" && $("#program-radius").length) {
        $("#program-radius").val(rad);
      }
    } catch (err) {}
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

      if (isIndigenousOnlyMode()) {
        updateQueryString("subcategory", INDIGENOUS_SUBCATEGORY);
        refreshResults(indigenousSearchPayloadFromForm(), true);
        return;
      }

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
      if (isIndigenousOnlyMode()) {
        updateQueryString("location", "");
        updateQueryString("category", "");
        updateQueryString("subcategory", INDIGENOUS_SUBCATEGORY);
        updateQueryString("radius", "0");
        updateQueryString("postalCode", "");
        $("#program-location").val("");
        $("#program-category").val("");
        $("#program-subcategory").val(INDIGENOUS_SUBCATEGORY);
        $("#program-radius").val("0");
        $("input#postalCode").val("");
        refreshResults(indigenousNationalPayload(), true);
        return;
      }
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
        var $wrapper = $acc.next(".faq__items-wrapper");
        if (!$wrapper.length) {
          return;
        }
        $wrapper.find(".lmc-category-empty-msg").remove();
        if (
          $acc.hasClass("-active") &&
          !categoryWrapperHasListings($wrapper)
        ) {
          $wrapper.append(
            '<p class="lmc-category-empty-msg">No programs are listed in this category.</p>'
          );
        }
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
    if (isIndigenousOnlyMode()) {
      injectIndigenousSearchForm();
      syncStubFieldsFromUrl();
      tryAutofillPostalFromIp();
      updateQueryString("subcategory", INDIGENOUS_SUBCATEGORY);
      var payload = indigenousSearchPayloadFromForm();
      updateQueryString("location", payload.location || "");
      updateQueryString("radius", payload.radius || "0");
      updateQueryString("postalCode", payload.postalCode || "");
      refreshResults(payload, false);
      return;
    }

    $("#search-container").html(
      '<p class="lmc-loading" role="status">Loading search…</p>'
    );

    if (useStaticProgramsData()) {
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
