(function () {
  "use strict";

  const STORAGE_KEY = "fixshot.lang";

  /**
   * Locale registry — extend this when adding new languages.
   * `prefix` is the URL path prefix; "" means root (default locale).
   * Order here drives the dropdown menu order.
   */
  const LOCALES = [
    { code: "ja", label: "日本語", prefix: "" },
    { code: "en", label: "English", prefix: "/en" }
    // future:
    // { code: "zh", label: "中文",   prefix: "/zh" },
    // { code: "ko", label: "한국어", prefix: "/ko" }
  ];
  const DEFAULT_LANG = "ja";
  const SUPPORTED = LOCALES.map((l) => l.code);

  function localeOf(code) {
    return LOCALES.find((l) => l.code === code);
  }

  function pathStartsWithPrefix(pathname, prefix) {
    if (!prefix) return false;
    return pathname === prefix
      || pathname === prefix + "/"
      || pathname.startsWith(prefix + "/");
  }

  function detectLocaleFromPath(pathname) {
    // Longest prefix wins so "/zh/en-something" doesn't accidentally match "/en".
    const matches = LOCALES.filter((l) => pathStartsWithPrefix(pathname, l.prefix));
    matches.sort((a, b) => b.prefix.length - a.prefix.length);
    return matches[0] || null;
  }

  function detectInitialLang() {
    // 1. URL path is authoritative.
    const fromPath = detectLocaleFromPath(window.location.pathname);
    if (fromPath) return fromPath.code;

    // 2. Legacy ?lang= for backward compatibility.
    try {
      const url = new URL(window.location.href);
      const queryLang = url.searchParams.get("lang");
      if (queryLang && SUPPORTED.includes(queryLang)) return queryLang;
    } catch (_) { /* ignore */ }

    // 3. Stored preference.
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (_) { /* ignore */ }

    // 4. Browser navigator.
    const nav = (navigator.language || "").toLowerCase();
    const match = LOCALES.find((l) => nav.startsWith(l.code));
    if (match) return match.code;

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
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    return response.json();
  }

  function applyDictionary(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] != null) {
        if (el.dataset.i18nHtml === "1") el.innerHTML = dict[key];
        else el.textContent = dict[key];
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

  /**
   * Build the URL for navigating to `targetLang` from the current page.
   * Handles arbitrary prefix swap so adding /zh/, /ko/ etc. just works.
   */
  function buildSwitchUrl(targetLang) {
    const targetLocale = localeOf(targetLang);
    if (!targetLocale) return window.location.pathname;

    const path = window.location.pathname || "/";
    const search = new URLSearchParams(window.location.search);
    search.delete("lang"); // strip legacy query param
    const cleanSearch = search.toString() ? "?" + search.toString() : "";
    const hash = window.location.hash || "";

    // Strip any existing prefix.
    const current = detectLocaleFromPath(path);
    let bare = path;
    if (current && current.prefix) {
      bare = path.slice(current.prefix.length) || "/";
    }

    // Apply target prefix.
    let next;
    if (!targetLocale.prefix) {
      next = bare;
    } else if (bare === "/") {
      next = targetLocale.prefix + "/";
    } else {
      next = targetLocale.prefix + bare;
    }
    return next + cleanSearch + hash;
  }

  let currentDict = null;
  let currentLang = null;

  async function applyLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
    try {
      const dict = await loadDictionary(lang);
      currentDict = dict;
      currentLang = lang;
      applyDictionary(dict);
      document.documentElement.lang = lang;
      persistLang(lang);
      renderSwitchers(lang);
      window.dispatchEvent(new CustomEvent("fixshot:langChange", { detail: { lang, dict } }));
    } catch (err) {
      console.warn("[i18n] could not load dictionary", err);
    }
  }

  function t(key, fallback = "") {
    if (currentDict && currentDict[key] != null) return currentDict[key];
    return fallback;
  }

  /* ---- Dropdown switcher rendering & behavior ---- */

  function renderSwitchers(activeLang) {
    document.querySelectorAll(".lang-switcher").forEach((root) => {
      // Build menu lazily on first render.
      let trigger = root.querySelector(".lang-switcher-trigger");
      let menu = root.querySelector(".lang-switcher-menu");
      if (!trigger) {
        trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "lang-switcher-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        trigger.innerHTML = `
          <i class="ri-global-line lang-switcher-globe" aria-hidden="true"></i>
          <span class="lang-switcher-current"></span>
          <i class="ri-arrow-down-s-line lang-switcher-caret" aria-hidden="true"></i>
        `;
        root.appendChild(trigger);
      }
      if (!menu) {
        menu = document.createElement("ul");
        menu.className = "lang-switcher-menu";
        menu.setAttribute("role", "listbox");
        menu.hidden = true;
        LOCALES.forEach((loc) => {
          const li = document.createElement("li");
          li.className = "lang-switcher-option";
          li.setAttribute("role", "option");
          li.setAttribute("data-lang", loc.code);
          li.tabIndex = 0;
          li.textContent = loc.label;
          menu.appendChild(li);
        });
        root.appendChild(menu);
      }

      // Update active state on trigger label and option marks.
      const active = localeOf(activeLang) || LOCALES[0];
      const currentEl = trigger.querySelector(".lang-switcher-current");
      if (currentEl) currentEl.textContent = active.label;

      menu.querySelectorAll(".lang-switcher-option").forEach((li) => {
        const isActive = li.getAttribute("data-lang") === active.code;
        li.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    });
  }

  function bindSwitcherClicks() {
    // Toggle menu open/closed via trigger.
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest(".lang-switcher-trigger");
      if (trigger) {
        const root = trigger.closest(".lang-switcher");
        if (!root) return;
        const menu = root.querySelector(".lang-switcher-menu");
        if (!menu) return;
        const isOpen = !menu.hidden;
        menu.hidden = isOpen;
        trigger.setAttribute("aria-expanded", isOpen ? "false" : "true");
        event.preventDefault();
        return;
      }

      const option = target.closest(".lang-switcher-option");
      if (option) {
        const lang = option.getAttribute("data-lang");
        if (!lang || !SUPPORTED.includes(lang)) return;
        event.preventDefault();
        // Same as current — just close.
        if (lang === currentLang) {
          closeAllSwitchers();
          return;
        }
        persistLang(lang);
        window.location.assign(buildSwitchUrl(lang));
        return;
      }

      // Click outside — close any open menus.
      if (!target.closest(".lang-switcher")) {
        closeAllSwitchers();
      }
    });

    // Esc key closes menus.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAllSwitchers();
    });
  }

  function closeAllSwitchers() {
    document.querySelectorAll(".lang-switcher").forEach((root) => {
      const menu = root.querySelector(".lang-switcher-menu");
      const trigger = root.querySelector(".lang-switcher-trigger");
      if (menu) menu.hidden = true;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  /* ---- Init ---- */

  const initial = detectInitialLang();
  document.documentElement.lang = initial;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindSwitcherClicks();
      applyLang(initial);
    }, { once: true });
  } else {
    bindSwitcherClicks();
    applyLang(initial);
  }

  window.FixShotI18n = {
    setLang: applyLang,
    getLang: () => currentLang || initial,
    switchUrl: buildSwitchUrl,
    locales: () => LOCALES.slice(),
    t
  };
})();
