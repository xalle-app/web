import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

// Лёгкая санитизация: разбираем готовый HTML и оставляем только
// безопасные теги/атрибуты. Так пользовательский Markdown не сможет
// протащить <script>, onerror=, javascript:-ссылки и т.п.
const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "DEL", "CODE", "PRE",
  "BLOCKQUOTE", "UL", "OL", "LI", "A", "H1", "H2", "H3", "H4",
  "HR", "SPAN", "DIV",
]);

// Токенизатор текста: #теги, @упоминания и спойлеры ||текст||
const TAG_MENTION_RE = /(^|\s)([#@][\wа-яёА-ЯЁ]+)/gu;
const SPOILER_RE = /\|\|([^|]+)\|\|/g;

function linkifyPlain(text, doc) {
  const out = [];
  let last = 0;
  text.replace(TAG_MENTION_RE, (m, pre, token, idx) => {
    const start = idx + pre.length;
    if (start > last) out.push(doc.createTextNode(text.slice(last, start)));
    const a = doc.createElement("a");
    if (token[0] === "#") { a.className = "hashtag"; a.setAttribute("data-tag", token); }
    else { a.className = "mention"; a.setAttribute("data-mention", token.slice(1)); }
    a.textContent = token;
    out.push(a);
    last = start + token.length;
    return m;
  });
  if (last < text.length) out.push(doc.createTextNode(text.slice(last)));
  return out;
}

function linkifyTokens(textNode, doc) {
  const text = textNode.nodeValue;
  if (!text) return [textNode.cloneNode(true)];
  const hasSpoiler = text.includes("||");
  const hasToken = /[#@][\wа-яёА-ЯЁ]/u.test(text);
  if (!hasSpoiler && !hasToken) return [textNode.cloneNode(true)];

  const out = [];
  let last = 0;
  if (hasSpoiler) {
    text.replace(SPOILER_RE, (m, inner, idx) => {
      if (idx > last) linkifyPlain(text.slice(last, idx), doc).forEach((n) => out.push(n));
      const span = doc.createElement("span");
      span.className = "spoiler";
      span.setAttribute("data-spoiler", "1");
      linkifyPlain(inner, doc).forEach((n) => span.appendChild(n));
      out.push(span);
      last = idx + m.length;
      return m;
    });
    if (last < text.length) linkifyPlain(text.slice(last), doc).forEach((n) => out.push(n));
    return out;
  }
  return linkifyPlain(text, doc);
}

function sanitizeNode(node, doc) {
  // Текстовые узлы: подсвечиваем хештеги и упоминания
  if (node.nodeType === 3) {
    const parts = linkifyTokens(node, doc);
    if (parts.length === 1) return parts[0];
    const frag = doc.createDocumentFragment();
    parts.forEach((p) => frag.appendChild(p));
    return frag;
  }
  if (node.nodeType !== 1) return null;

  const tag = node.tagName;
  const target =
    ALLOWED_TAGS.has(tag) ? doc.createElement(tag.toLowerCase()) : doc.createDocumentFragment();

  if (target.nodeType === 1 && tag === "A") {
    const href = node.getAttribute("href") || "";
    if (/^(https?:|mailto:|\/)/i.test(href)) {
      target.setAttribute("href", href);
      target.setAttribute("target", "_blank");
      target.setAttribute("rel", "noopener noreferrer nofollow");
    }
  }

  if (target.nodeType === 1) {
    if (tag === "CODE" || tag === "PRE" || tag === "DIV" || tag === "SPAN") {
      const cls = node.getAttribute("class");
      if (cls) target.setAttribute("class", cls);
    }
  }


  for (const child of Array.from(node.childNodes)) {
    const clean = sanitizeNode(child, doc);
    if (clean) target.appendChild(clean);
  }
  return target;
}

// Callout pattern: > [!type] text
const CALLOUT_RE = /^\[!(info|warning|success|error)\]\s*/i;

function processCallouts(node, doc) {
  if (node.nodeType !== 1 || node.tagName !== "BLOCKQUOTE") return node;
  const text = (node.textContent || "").trim();
  const match = text.match(CALLOUT_RE);
  if (!match) return node;
  const type = match[1].toLowerCase();
  const icons = { info: "ℹ", warning: "⚠", success: "✓", error: "✕" };
  const wrapper = doc.createElement("div");
  wrapper.className = `md-callout md-callout-${type}`;
  const iconEl = doc.createElement("span");
  iconEl.className = "md-callout-icon";
  iconEl.textContent = icons[type] || "•";
  wrapper.appendChild(iconEl);
  const content = doc.createElement("div");
  content.className = "md-callout-body";
  // Walk into child nodes, strip [!type] marker from first text node found
  let stripped = false;
  function stripAndCopy(src, dest) {
    for (const child of Array.from(src.childNodes)) {
      if (!stripped && child.nodeType === 3) {
        const val = child.nodeValue;
        if (!val.trim()) continue; // skip whitespace-only nodes between block elements
        const clean = val.replace(/^\s*\[!(info|warning|success|error)\]\s*/i, "");
        if (clean) dest.appendChild(doc.createTextNode(clean));
        stripped = true;
      } else if (!stripped && child.nodeType === 1) {
        const el = doc.createElement(child.tagName.toLowerCase());
        stripAndCopy(child, el);
        dest.appendChild(el);
      } else {
        dest.appendChild(child.cloneNode(true));
      }
    }
  }
  stripAndCopy(node, content);
  wrapper.appendChild(content);
  return wrapper;
}

export function renderMarkdown(src = "") {
  if (typeof src !== "string") src = Array.isArray(src) ? src.join("") : String(src ?? "");
  const preprocessed = src
    .replace(/^~~~$/gm, '\n\n<div class="md-hr-dashed"></div>\n\n')
    .replace(/^---$/gm, '\n\n<hr>\n\n');
  const raw = marked.parse(preprocessed);
  // В браузере есть DOMParser — используем его для безопасного разбора
  if (typeof window !== "undefined" && window.DOMParser) {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    const out = document.createElement("div");
    for (const child of Array.from(doc.body.childNodes)) {
      let clean = sanitizeNode(child, document);
      if (clean) {
        clean = processCallouts(clean, document);
        out.appendChild(clean);
      }
    }
    return out.innerHTML;
  }
  return raw;
}
