(function () {
  "use strict";

  const STORAGE_KEY = "fixshot.lang";
  const SUPPORTED = ["en", "ja"];
  // Site is fixshot.JP — Japanese is the default route. EN visitors land on /en/...
  const DEFAULT_LANG = "ja";
  const EN_PREFIX = "/en";

  function pathStartsWithEn(pathname) {
    return pathname === EN_PREFIX
      || pathname === EN_PREFIX + "/"
      || pathname.startsWith(EN_PREFIX + "/");
  }

  function detectInitialLang() {
    // 1. URL path /en/... is authoritative — the URL is the source of truth.
    if (pathStartsWithEn(window.location.pathname)) return "en";

    // 2. Legacy ?lang= query param (kept for backward compatibility / external links).
    try {
      const url = new URL(window.location.href);
      const queryLang = url.searchParams.get("lang");
      if (queryLang && SUPPORTED.includes(queryLang)) return queryLang;
    } catch (_) { /* ignore */ }

    // 3. Stored preference (e.g. user toggled before).
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (_) { /* ignore */ }

    // 4. Browser language for first-time visitors at the JA root.
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("en")) return "en";

    return DEFAULT_LANG;
  }

  function persistLang(lang) {
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignore */ }
  }

  function basePath() {
    const scripts = document.querySelectorAll("script[src*='i18n.js']");
    if (scripts.length) {
      const src = scripts[scripts.length - 1].getAttribute("src") || "";
      return src.replace(/assets\/js\/i18n\.js.*$/, "");
    }
    return "./";
  }

  async function loadDictionary(lang) {
    const url = `${basePath()}assets/i18n/${lang}.json`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }
    return response.json();
  }

  function applyDictionary(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] != null) {
        if (el.dataset.i18nHtml === "1") {
          el.innerHTML = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      const spec = el.getAttribute("data-i18n-attr") || "";
      spec.split(",").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s && s.trim());
        if (!attr || !key) return;
        if (dict[key] != null) el.setAttribute(attr, dict[key]);
      });
    });
  }

  function syncToggle(lang) {
    document.querySelectorAll(".lang-toggle").forEach((toggle) => {
      toggle.querySelectorAll("[data-lang]").forEach((btn) => {
        const target = btn.getAttribute("data-lang");
        btn.classList.toggle("is-active", target === lang);
        btn.setAttribute("aria-pressed", target === lang ? "true" : "false");
      });
    });
  }

  /**
   * Build the URL to navigate to when switching to `targetLang`.
   * Strips/adds the /en prefix and preserves search/hash.
   */
  function buildSwitchUrl(targetLang) {
    const path = window.location.pathname || "/";
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const onEn = pathStartsWithEn(path);

    // Strip any legacy ?lang= so the URL stays clean once we switch via path.
    const searchParams = new URLSearchParams(search);
    searchParams.delete("lang");
    const cleanSearch = searchParams.toString() ? "?" + searchParams.toString() : "";

    if (targetLang === "en") {
      if (onEn) return path + cleanSearch + hash;
      const nextPath = path === "/" ? EN_PREFIX + "/" : EN_PREFIX + path;
      return nextPath + cleanSearch + hash;
    }

    // targetLang === "ja"
    if (!onEn) return path + cleanSearch + hash;
    let stripped = path.slice(EN_PREFIX.length); // "/foo" or "/" or ""
    if (stripped === "") stripped = "/";
    return stripped + cleanSearch + hash;
  }

  async function applyLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
    try {
      const dict = await loadDictionary(lang);
      applyDictionary(dict);
      document.documentElement.lang = lang;
      persistLang(lang);
      syncToggle(lang);
      window.dispatchEvent(new CustomEvent("fixshot:langChange", { detail: { lang } }));
    } catch (err) {
      console.warn("[i18n] could not load dictionary", err);
    }
  }

  function bindToggleClicks() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("[data-lang]");
      if (!btn) return;
      const lang = btn.getAttribute("data-lang");
      if (!SUPPORTED.includes(lang)) return;
      event.preventDefault();
      // If already on the target language, do nothing.
      if (document.documentElement.lang === lang) return;
      // Persist preference before navigation so the new page picks it up
      // even before its own i18n.js runs.
      persistLang(lang);
      window.location.assign(buildSwitchUrl(lang));
    });
  }

  const initial = detectInitialLang();
  document.documentElement.lang = initial;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindToggleClicks();
      applyLang(initial);
    }, { once: true });
  } else {
    bindToggleClicks();
    applyLang(initial);
  }

  window.FixShotI18n = {
    setLang: applyLang,
    getLang: () => document.documentElement.lang || initial,
    switchUrl: buildSwitchUrl
  };
})();
