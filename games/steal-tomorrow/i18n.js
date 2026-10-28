(() => {
  "use strict";

  const LANGS = ["zh", "ja", "en"];
  const STORAGE_KEY = "steal-tomorrow-lang";
  const DEFAULT_META = {
    zh: "零依赖浏览器系统化劫案：在零点封锁前，从档案馆、铸造庭与玻璃园带走任意两件明日遗物，再抵达南码头。",
    ja: "依存ライブラリ不要のブラウザ強盗。零時の封鎖までに、文書館・鋳造院・ガラス園から明日の遺物を 2 つ持ち出し、南埠頭へ。",
    en: "A zero-dependency browser heist: take any two relics of tomorrow from the Archive, the Foundry and the Glass Garden before midnight, then reach the South Dock."
  };

  const table = window.I18N_TABLE || {};
  const maps = { ja: new Map(), en: new Map() };
  for (const rawKey of Object.keys(table)) {
    const pair = table[rawKey];
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const key = rawKey.trim();
    maps.ja.set(key, pair[0]);
    maps.en.set(key, pair[1]);
  }

  function detect() {
    let fromUrl = "";
    try { fromUrl = new URLSearchParams(location.search).get("lang") || ""; } catch {}
    if (LANGS.includes(fromUrl)) return fromUrl;
    let saved = "";
    try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch {}
    if (LANGS.includes(saved)) return saved;
    return "zh";
  }

  let lang = detect();

  function tr(text) {
    if (!text) return text;
    const trimmed = String(text).trim();
    if (!trimmed) return text;
    const map = maps[lang];
    if (!map) return text;
    const hit = map.get(trimmed);
    if (hit === undefined) return text;
    return hit;
  }

  function keyOf(quasis) {
    let out = "";
    for (let index = 0; index < quasis.length; index++) {
      out += quasis[index];
      if (index < quasis.length - 1) out += "{" + index + "}";
    }
    return out;
  }

  function t(value, ...values) {
    if (typeof value === "string") return tr(value);
    const key = keyOf(value);
    const map = maps[lang];
    const tpl = (map && map.get(key)) || key;
    if (!values.length) return tpl;
    return tpl.replace(/\{(\d+)\}/g, (match, index) => {
      const v = values[Number(index)];
      return v === undefined || v === null ? match : String(v);
    });
  }

  const SKIP_ROOT = "[data-i18n-skip], script, style, noscript";
  const ATTRS = ["aria-label", "title", "placeholder", "alt"];

  function isSkipped(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return !!(element && element.closest && element.closest(SKIP_ROOT));
  }

  function translateTextNode(node) {
    if (!node.nodeValue || !node.nodeValue.trim()) return;
    if (node.__i18nSource === undefined) node.__i18nSource = node.nodeValue;
    const source = node.__i18nSource;
    const leading = source.match(/^\s*/)[0];
    const trailing = source.match(/\s*$/)[0];
    const core = source.slice(leading.length, source.length - trailing.length);
    const hit = tr(core);
    const next = leading + (hit === core ? core : hit) + trailing;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function translateAttributes(element) {
    for (const name of ATTRS) {
      if (!element.hasAttribute || !element.hasAttribute(name)) continue;
      const store = element.__i18nAttrs || (element.__i18nAttrs = {});
      if (store[name] === undefined) store[name] = element.getAttribute(name);
      const source = store[name];
      const hit = tr(source);
      if (hit !== source && element.getAttribute(name) !== hit) element.setAttribute(name, hit);
    }
  }

  function apply(root = document) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isSkipped(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) translateTextNode(node);

    const elements = root.querySelectorAll ? [root, ...root.querySelectorAll("*")] : [];
    for (const element of elements) {
      if (!element || element.nodeType !== 1 || isSkipped(element)) continue;
      translateAttributes(element);
    }
  }

  function syncPicker() {
    document.querySelectorAll("[data-lang]").forEach(button => {
      const active = button.dataset.lang === lang;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("active", active);
    });
  }

  function syncMeta() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", DEFAULT_META[lang]);
  }

  function setLang(next, options = {}) {
    if (!LANGS.includes(next)) return;
    const changed = next !== lang;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    syncMeta();
    apply();
    syncPicker();
    if (changed) {
      window.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang } }));
    }
    if (options.announce) {
      const label = { zh: "语言：中文", ja: "言語：日本語", en: "Language: English" }[lang];
      document.documentElement.setAttribute("data-lang-active", lang);
      document.documentElement.setAttribute("aria-label", label);
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest && event.target.closest("[data-lang]");
    if (!button) return;
    setLang(button.dataset.lang, { announce: true });
  });

  syncMeta();
  apply();
  syncPicker();
  document.addEventListener("DOMContentLoaded", () => {
    syncMeta();
    apply();
    syncPicker();
  });

  window.I18N = { lang, t, translate: tr, setLang, apply, languages: LANGS.slice() };
  Object.defineProperty(window.I18N, "lang", { get: () => lang, enumerable: true });
})();
