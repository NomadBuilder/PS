/**
 * About Grief header/footer chrome.
 * Cross-origin <iframe src="https://aboutgrief.ca/..."> is blocked (X-Frame-Options: SAMEORIGIN),
 * so we fetch the programs page, extract the real header/footer HTML, absolutize asset URLs,
 * and render inside Shadow DOM so About Grief’s bundled CSS applies without overriding the widget.
 */
(function () {
  var AG_ORIGIN = "https://aboutgrief.ca";
  var AG_PROGRAMS = AG_ORIGIN + "/programs-and-services/";
  var AG_CSS_PRELOAD =
    AG_ORIGIN + "/Assets/build/css/grief-topic-preload-924ff6d2d0.min.css?v=4";
  var AG_CSS_MAIN =
    AG_ORIGIN + "/Assets/build/css/grief-topic-e87e1565f5.min.css";

  function absolutizeAboutGriefHtml(html) {
    if (!html) {
      return html;
    }
    return (
      html
        .replace(/(\b(?:href|src))="\/(?!\/)/g, '$1="' + AG_ORIGIN + "/")
        .replace(/\baction="\/(?!\/)/g, 'action="' + AG_ORIGIN + "/")
        .replace(/url\(\/(?!\/)/g, "url(" + AG_ORIGIN + "/")
    );
  }

  function injectShadow(host, innerMarkup) {
    if (!host || host.dataset.lmcChromeInjected === "1") {
      return;
    }
    host.dataset.lmcChromeInjected = "1";
    var links =
      '<link rel="stylesheet" href="' +
      AG_CSS_PRELOAD +
      '" />' +
      '<link rel="stylesheet" href="' +
      AG_CSS_MAIN +
      '" />';
    var shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = links + innerMarkup;
  }

  function loadAboutGriefChrome() {
    var headerHost = document.getElementById("lmc-chrome-header");
    var footerHost = document.getElementById("lmc-chrome-footer");
    if (!headerHost || !footerHost) {
      return;
    }

    fetch(AG_PROGRAMS, { mode: "cors", credentials: "omit", cache: "no-store" })
      .then(function (r) {
        if (!r.ok) {
          throw new Error("chrome");
        }
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var next = doc.querySelector("#__next");
        if (!next) {
          throw new Error("parse");
        }

        var hDesktop = next.querySelector(".header-desktop");
        var hMobile = next.querySelector(".header-mobile");
        var fBg = next.querySelector(".main-footer-bg");
        var fMain = next.querySelector(".main-footer");

        var headerWrap =
          '<div class="-grief-site-bg lmc-chrome-grief-root"><div class="main -grief-site">' +
          (hDesktop ? absolutizeAboutGriefHtml(hDesktop.outerHTML) : "") +
          (hMobile ? absolutizeAboutGriefHtml(hMobile.outerHTML) : "") +
          "</div></div>";

        var footerWrap =
          '<div class="-grief-site-bg lmc-chrome-grief-root"><div class="main -grief-site">' +
          (fBg ? absolutizeAboutGriefHtml(fBg.outerHTML) : "") +
          (fMain ? absolutizeAboutGriefHtml(fMain.outerHTML) : "") +
          "</div></div>";

        injectShadow(headerHost, headerWrap);
        injectShadow(footerHost, footerWrap);

        headerHost.removeAttribute("aria-busy");
        footerHost.removeAttribute("aria-busy");
      })
      .catch(function () {
        headerHost.removeAttribute("aria-busy");
        footerHost.removeAttribute("aria-busy");
        headerHost.innerHTML =
          '<p class="lmc-chrome-fallback">' +
          '<a href="' +
          AG_PROGRAMS +
          '">About Grief — Programs &amp; services</a> (header could not be loaded)</p>';
        footerHost.innerHTML =
          '<p class="lmc-chrome-fallback">' +
          '<a href="' +
          AG_PROGRAMS +
          '">About Grief</a> (footer could not be loaded)</p>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAboutGriefChrome);
  } else {
    loadAboutGriefChrome();
  }
})();
