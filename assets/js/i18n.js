(function () {
  "use strict";

  const STORAGE_KEY = "fixshot.lang";
  const DEFAULT_LANG = "en";
  const SUPPORTED = ["en", "ja"];

  function detectInitialLang() {
    try {
      const url = new URL(window.location.href);
      const queryLang = url.searchParams.get("lang");
      if (queryLang && SUPPORTED.includes(queryLang)) return queryLang;
    } catch (_) { /* ignore */ }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (_) { /* ignore */ }

    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("ja")) return "ja";
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

  async function setLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
    try {
      const dict = await loadDictionary(lang);
      applyDictionary(dict);
      document.documentElement.lang = lang;
      persistLang(lang);
      syncToggle(lang);
      window.dispatchEvent(new CustomEvent("fixshot:langChange", { detail: { lang } }));
    } catch (err) {
      // If loading fails, log but don't break the page.
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
      setLang(lang);
    });
  }

  const initial = detectInitialLang();
  document.documentElement.lang = initial;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindToggleClicks();
      setLang(initial);
    }, { once: true });
  } else {
    bindToggleClicks();
    setLang(initial);
  }

  window.FixShotI18n = { setLang, getLang: () => document.documentElement.lang || initial };
})();
