import { t, DATE_LOCALES, getLocale } from "./i18n.js";

export const REACTIONS = ["❤️", "👍", "😄", "🔥", "🎉"];

export const EMOJI_CATEGORIES = [
  { id: "smileys", icon: "😀", name: "Смайлы", emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕".split(" ") },
  { id: "gestures", icon: "👍", name: "Жесты", emojis: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 🖖 👏 🙌 🤝 🙏 ✍️ 💪 🦾 👐 🤲 🫶 🫂 💅 🤳".split(" ") },
  { id: "hearts", icon: "❤️", name: "Сердца", emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 ❤️‍🔥 ❤️‍🩹 💋".split(" ") },
  { id: "animals", icon: "🐱", name: "Животные", emojis: "🐱 🐈 🐈‍⬛ 🐶 🐕 🦮 🐩 🐺 🦊 🦝 🐯 🦁 🐮 🐷 🐗 🐭 🐹 🐰 🐇 🐻 🐻‍❄️ 🐨 🐼 🦥 🦦 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦉 🦄 🐝 🦋 🐌 🐞 🐢 🐙 🐠 🐬 🐳 🌸 🌼 🌻 🌹 🌷 🌱 🌿 🍀 🌳 🌴".split(" ") },
  { id: "food", icon: "🍕", name: "Еда", emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥕 🌽 🌶️ 🍄 🥐 🍞 🥖 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🍙 🍦 🍰 🎂 🍫 🍬 🍭 🍪 ☕ 🍵 🧋 🍺 🍷 🥂".split(" ") },
  { id: "activities", icon: "⚽", name: "Активности", emojis: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🥍 🏏 ⛳ 🎯 🪁 🎮 🕹️ 🎲 🧩 🎸 🎹 🎺 🎻 🥁 🎤 🎧 🎬 🎨 📸 🎭 🏆 🥇 🥈 🥉 🎖️ ✈️ 🚀 🏖️ ⛺ 🎡 🎢".split(" ") },
  { id: "symbols", icon: "✨", name: "Символы", emojis: "✨ ⭐ 🌟 💫 ⚡ 🔥 💥 ☀️ 🌙 ⛅ 🌈 ❄️ 💧 🌊 💯 ✅ ❌ ❓ ❗ 💤 💭 💬 🔔 🔕 🎉 🎊 🎈 🎁 🏷️ 🔖 💡 🔑 🔒 🧲 ⏰ 📌 📍 ♻️ ☑️ 🆗 🆕".split(" ") },
];

export const ACCENTS = ["#c8745a", "#5fa8d3", "#7a9e6e", "#b56db0", "#d99a2b", "#5b6ee0", "#d65f7a", "#3aa99a"];
export const BG_TONES = { "Тёплая": "#faf7f2", "Светлая": "#f7f8fa", "Песочная": "#f6efe2", "Снежная": "#fbfbfb" };

export const SEASONS = {
  winter: { name: "Зима", accent: "#5b8fc7", bg: "#f4f7fb", emoji: "❄️" },
  spring: { name: "Весна", accent: "#7aa86e", bg: "#f4f8ef", emoji: "🌸" },
  summer: { name: "Лето", accent: "#e0a73b", bg: "#fbf6ea", emoji: "☀️" },
  autumn: { name: "Осень", accent: "#c8745a", bg: "#f8efe6", emoji: "🍂" },
};
export function currentSeason(date = new Date()) {
  const m = date.getMonth(); // 0..11
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

export const DEFAULT_NOTIFS = { repost: true, reply: true, mention: true, commentReaction: true, postReaction: true, dmNotif: true };
export const DEFAULT_SETTINGS = {
  accent: "#c8745a", bg: "#faf7f2", dark: false, themeSync: false, seasonalTheme: false,
  menuPos: "right", menuStyle: "text-icons", toastPos: "bottom-center",
  showViews: true, allowReactions: true, allowComments: true, liveTime: true, animations: true,
  showOnline: true, showWhispers: true, showReadTime: true,
  safeMode: false, biometricLock: false, notifs: { ...DEFAULT_NOTIFS },
};

function isDarkHex(hex) {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 40;
}

function lightenHex(hex, amount = 0.08) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const rr = Math.round(r + (255 - r) * amount);
  const gg = Math.round(g + (255 - g) * amount);
  const bb = Math.round(b + (255 - b) * amount);
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

export function applySettings(s) {
  const root = document.documentElement;
  let dark = s.dark;
  if (s.themeSync && window.matchMedia) dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let accent = s.accent, bg = s.bg;
  if (s.seasonalTheme) {
    const se = SEASONS[currentSeason()];
    accent = se.accent; bg = se.bg;
  }
  root.classList.toggle("dark", dark);
  root.style.setProperty("--accent", accent);
  if (dark && isDarkHex(bg) && bg !== "#1a1815") {
    root.style.setProperty("--bg-base", bg);
    root.style.setProperty("--surface-override", lightenHex(bg, 0.07));
    root.style.setProperty("--card-bg-override", lightenHex(bg, 0.12));
    root.setAttribute("data-exclusive-dark", "1");
  } else {
    root.style.setProperty("--bg-base", dark ? "#1a1815" : bg);
    root.style.removeProperty("--surface-override");
    root.style.removeProperty("--card-bg-override");
    root.removeAttribute("data-exclusive-dark");
  }
  if (s.warmGlow) root.setAttribute("data-warm-glow", "1");
  else root.removeAttribute("data-warm-glow");
  document.body.classList.toggle("no-anim", !s.animations);
  document.body.classList.toggle("compact", s.compactMode);
  document.body.classList.toggle("chat-compact", !!s.chatCompact);
  document.body.classList.toggle("chat-always-time", !!s.chatAlwaysTime);
  const chatSize = s.chatFontSize || "normal";
  root.setAttribute("data-chat-size", chatSize);
  const isMobile = window.innerWidth <= 720;
  const rawPos = s.menuPos || "right";
  const effectivePos = isMobile && (rawPos === "top" || rawPos === "bottom") ? "right" : rawPos;
  root.setAttribute("data-menu-pos", effectivePos);
  root.setAttribute("data-menu-style", "text-icons");
}

export const initials = (name = "") => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "·";

function fmtPlural(n, key1, key24, keyN) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 19) return t(keyN);
  if (mod10 === 1) return t(key1);
  if (mod10 >= 2 && mod10 <= 4) return t(key24);
  return t(keyN);
}

export function readTime(body = "", images = 0) {
  const words = (body.trim().match(/\S+/g) || []).length;
  const sec = Math.round((words / 200) * 60) + images * 4;
  if (sec < 10) return t("fmt.read.under10");
  if (sec < 60) return t("fmt.read.secs", { n: Math.round(sec / 5) * 5 });
  const m = Math.round(sec / 60);
  const word = fmtPlural(m, "fmt.min.1", "fmt.min.24", "fmt.min.n");
  return t("fmt.read.mins", { n: m, w: word });
}

export const plural = (n, [one, few, many]) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};

export const timeAgo = (iso) => {
  const d = new Date(iso.replace(" ", "T") + "Z");
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 1) return t("fmt.justNow");
  if (s < 60) return t("fmt.secsAgo", { n: s, w: fmtPlural(s, "fmt.sec.1", "fmt.sec.24", "fmt.sec.n") });
  const m = Math.floor(s / 60);
  if (m < 60) return t("fmt.minsAgo", { n: m, w: fmtPlural(m, "fmt.min.1", "fmt.min.24", "fmt.min.n") });
  const h = Math.floor(m / 60);
  if (h < 24) return t("fmt.hoursAgo", { n: h, w: fmtPlural(h, "fmt.hour.1", "fmt.hour.24", "fmt.hour.n") });
  const days = Math.floor(h / 24);
  if (days < 7) return t("fmt.daysAgo", { n: days, w: fmtPlural(days, "fmt.day.1", "fmt.day.24", "fmt.day.n") });
  const locale = DATE_LOCALES[getLocale()] || "ru-RU";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

export const fullDate = (iso) => {
  const locale = DATE_LOCALES[getLocale()] || "ru-RU";
  return new Date(iso.replace(" ", "T") + "Z").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
};

export const fullDateTime = (iso) => {
  const locale = DATE_LOCALES[getLocale()] || "ru-RU";
  return new Date(iso.replace(" ", "T") + "Z").toLocaleString(locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const lastSeenText = (iso) => {
  if (!iso) return t("fmt.seen.recently");
  const d = new Date(iso.replace(" ", "T") + "Z");
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 90) return t("fmt.seen.justNow");
  const m = Math.floor(s / 60);
  if (m < 60) return t("fmt.seen.minsAgo", { n: m, w: fmtPlural(m, "fmt.min.1", "fmt.min.24", "fmt.min.n") });
  const h = Math.floor(m / 60);
  if (h < 24) return t("fmt.seen.hoursAgo", { n: h, w: fmtPlural(h, "fmt.hour.1", "fmt.hour.24", "fmt.hour.n") });
  const days = Math.floor(h / 24);
  if (days < 7) return t("fmt.seen.daysAgo", { n: days, w: fmtPlural(days, "fmt.day.1", "fmt.day.24", "fmt.day.n") });
  return t("fmt.seen.longAgo");
};
