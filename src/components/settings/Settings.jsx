import { useRef, useState, useEffect } from "react";
import { Settings2, LogOut, Search, X, ChevronRight, Menu, Smartphone, Monitor, ArrowLeftRight, ArrowRight, ArrowLeft } from "lucide-react";
import Tip from "../shared/Tip.jsx";
import Security from "../profile/Security.jsx";
import { useToast, useConfirm } from "../shared/ui.jsx";
import { ACCENTS, BG_TONES, DEFAULT_SETTINGS, DEFAULT_NOTIFS, initials } from "../../lib/format.js";
import { api } from "../../lib/api.js";
import { API_BASE, assetUrl, IS_CAPACITOR } from "../../lib/config.js";
import { checkBiometryAvailable } from "../../lib/biometric.js";
import { useLocale, useT } from "../../contexts/I18nContext.jsx";

const Toggle = ({ on, onClick }) => (<div className={`toggle ${on ? "on" : ""}`} onClick={onClick} role="switch" aria-checked={on} />);

const Row = ({ label, sub, right }) => (
  <div className="sets-row">
    <div className="sets-row-text">
      <div className="sets-row-label">{label}</div>
      {sub && <div className="sets-row-sub">{sub}</div>}
    </div>
    <div className="sets-row-right">{right}</div>
  </div>
);

export default function Settings({ settings, setSettings, token, me, onMeUpdate, onSwitch, onLogout, isMobile, otherDeviceSettings, onSyncFromOther, onSyncToOther }) {
  const upd = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const { SUPPORTED_LOCALES, LOCALE_NAMES, locale, changeLocale } = useLocale();
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const avatarInputRef = useRef(null);
  const [nameEdit, setNameEdit] = useState(false);
  const [nameVal, setNameVal] = useState(me?.name || "");
  const [activeCategory, setActiveCategory] = useState("account");
  const [activeSection, setActiveSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contentRef = useRef(null);

  const setToastPos = (v) => { upd({ toastPos: v }); setTimeout(() => toast(t("settings.toast.notifPreview"), { type: "info" }), 60); };
  const updNotif = (key) => setSettings((s) => ({ ...s, notifs: { ...DEFAULT_NOTIFS, ...s.notifs, [key]: !(s.notifs?.[key] ?? true) } }));

  useEffect(() => { setNameVal(me?.name || ""); }, [me?.name]);

  const NAME_COLORS = [
    { label: t("settings.color.standard"), value: null },
    { label: t("settings.color.rose"), value: "#d65f7a" },
    { label: t("settings.color.sunset"), value: "#c8745a" },
    { label: t("settings.color.amber"), value: "#d99a2b" },
    { label: t("settings.color.emerald"), value: "#5b9e6e" },
    { label: t("settings.color.sapphire"), value: "#5fa8d3" },
    { label: t("settings.color.amethyst"), value: "#b56db0" },
    { label: t("settings.color.lavender"), value: "#7a7ec8" },
    { label: t("settings.color.coral"), value: "#e07a5f" },
  ];

  const GRADIENT_PRESETS = [
    { label: t("settings.grad.none"), value: null },
    { label: t("settings.grad.violetBlue"), value: "linear-gradient(135deg, #a78bfa, #60a5fa)" },
    { label: t("settings.grad.ocean"), value: "linear-gradient(135deg, #06b6d4, #3b82f6)" },
    { label: t("settings.grad.aurora"), value: "linear-gradient(135deg, #34d399, #60a5fa)" },
    { label: t("settings.grad.twilight"), value: "linear-gradient(135deg, #f59e0b, #a78bfa)" },
    { label: t("settings.grad.sakura"), value: "linear-gradient(135deg, #f472b6, #a78bfa)" },
  ];

  const EXCLUSIVE_THEMES = [
    { label: t("settings.excl.disable"), accent: null, bg: null, dark: null },
    { label: "Midnight", accent: "#818cf8", bg: "#0d0d1a", dark: true, warmGlow: true },
    { label: "Deep Sea", accent: "#38bdf8", bg: "#020b18", dark: true, warmGlow: true },
    { label: "Matrix", accent: "#4ade80", bg: "#001a08", dark: true, warmGlow: true },
    { label: "Volcano", accent: "#f97316", bg: "#180800", dark: true, warmGlow: true },
    { label: "Neon", accent: "#22d3ee", bg: "#00111a", dark: true, warmGlow: true },
    { label: "Twilight", accent: "#c084fc", bg: "#120b1e", dark: true, warmGlow: true },
    { label: "Carbon", accent: "#8fa8c8", bg: "#0d0d0d", dark: true },
    { label: "Crimson", accent: "#f43f5e", bg: "#120007", dark: true, warmGlow: true },
    { label: "Amber", accent: "#fbbf24", bg: "#140b00", dark: true, warmGlow: true },
    { label: t("settings.excl.cozy"), accent: "#d98c5a", bg: "#0d0905", dark: true, warmGlow: true },
    { label: "Aurora", accent: "#34d399", bg: "#04141a", dark: true, warmGlow: true },
    { label: "Rose Gold", accent: "#f472b6", bg: "#fff1f2", dark: false, warmGlow: true },
    { label: "Arctic", accent: "#60a5fa", bg: "#f0f9ff", dark: false },
    { label: "Forest", accent: "#34d399", bg: "#f0fdf4", dark: false, warmGlow: true },
    { label: "Sakura", accent: "#f9a8d4", bg: "#fdf2f8", dark: false, warmGlow: true },
    { label: "Lemon", accent: "#f59e0b", bg: "#fffbeb", dark: false },
    { label: "Lavender", accent: "#a78bfa", bg: "#f5f3ff", dark: false, warmGlow: true },
    { label: "Mint", accent: "#10b981", bg: "#ecfdf5", dark: false, warmGlow: true },
    { label: "Sunset", accent: "#f97316", bg: "#fff7ed", dark: false, warmGlow: true },
    { label: "Coral", accent: "#fb7185", bg: "#fff5f5", dark: false, warmGlow: true },
  ];

  const isPremium = (me?.subscription_tier || 0) >= 4 || me?.role === "moderator";
  const isExclusiveActive = EXCLUSIVE_THEMES.some(t => t.accent !== null && settings.accent === t.accent && settings.bg === t.bg);
  const notifs = { ...DEFAULT_NOTIFS, ...(settings.notifs || {}) };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const r = await fetch(`${API_BASE}/api/avatar`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const j = await r.json();
      if (!r.ok) return toast(j.error, { type: "error" });
      onMeUpdate?.({ avatar_url: j.url });
      toast(t("settings.toast.avatarUpdated"), { type: "success" });
    } catch { toast(t("settings.toast.avatarError"), { type: "error" }); }
    e.target.value = "";
  };

  const saveName = async () => {
    if (!nameVal.trim()) return;
    try {
      await api("/profile/name", { method: "PATCH", token, body: { name: nameVal } });
      onMeUpdate?.({ name: nameVal });
      toast(t("settings.toast.nameUpdated"), { type: "success" });
      setNameEdit(false);
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const deleteAvatar = async () => {
    try { await api("/avatar", { method: "DELETE", token }); onMeUpdate?.({ avatar_url: null }); toast(t("settings.toast.avatarDeleted"), { type: "info" }); }
    catch (e) { toast(e.message, { type: "error" }); }
  };

  const saveNameColor = async (color) => {
    try { await api("/profile/name-color", { method: "PATCH", token, body: { color } }); onMeUpdate?.({ name_color: color }); toast(t("settings.toast.nameColorUpdated"), { type: "success" }); }
    catch (e) { toast(e.message, { type: "error" }); }
  };

  const saveNameGradient = async (gradient) => {
    try { await api("/profile/name-gradient", { method: "PATCH", token, body: { gradient } }); onMeUpdate?.({ name_gradient: gradient }); toast(t("settings.toast.gradientUpdated"), { type: "success" }); }
    catch (e) { toast(e.message, { type: "error" }); }
  };

  // ─── Section content definitions (for search) ───────────────────────────
  const ALL_SETTINGS = [
    { cat: "account", sec: "profile", label: t("settings.profile.nameColor"), sub: t("settings.color.standard"), keywords: "avatar photo profile" },
    { cat: "account", sec: "profile", label: t("settings.profile.saveName"), sub: t("settings.cat.account"), keywords: "name handle account" },
    { cat: "account", sec: "profile", label: t("settings.profile.nameColor"), sub: t("settings.profile.nameColor"), keywords: "color name" },
    { cat: "account", sec: "security", label: t("settings.sec.security"), sub: t("settings.section.security"), keywords: "password security sessions" },
    { cat: "appearance", sec: "theme", label: t("settings.theme.dark"), sub: t("settings.theme"), keywords: "dark light theme" },
    { cat: "appearance", sec: "theme", label: t("settings.theme.system"), sub: t("settings.theme.system"), keywords: "sync system theme" },
    { cat: "appearance", sec: "theme", label: t("settings.accent"), sub: t("settings.accent"), keywords: "accent color" },
    { cat: "appearance", sec: "theme", label: t("settings.warmGlow"), sub: t("settings.warmGlow.sub"), keywords: "glow halo" },
    { cat: "appearance", sec: "theme", label: t("settings.language"), sub: t("settings.languageHint"), keywords: "language interface" },
    { cat: "appearance", sec: "exclusive", label: t("settings.sec.exclusive"), sub: t("settings.exclusivePremiumBanner"), keywords: "exclusive themes premium" },
    { cat: "appearance", sec: "interface", label: t("settings.iface.menuPos.label"), sub: t("settings.iface.menuPos.sub"), keywords: "menu position navigation" },
    { cat: "appearance", sec: "interface", label: t("settings.iface.notifPos.label"), sub: t("settings.iface.notifPos.sub"), keywords: "notification position toast" },
    { cat: "notifications", sec: "overview", label: t("settings.notif.messages.label"), sub: t("settings.notif.messages.sub"), keywords: "messages notifications dm" },
    { cat: "notifications", sec: "overview", label: t("settings.notif.replies.label"), sub: t("settings.notif.replies.sub"), keywords: "replies notifications" },
    { cat: "notifications", sec: "overview", label: t("settings.notif.mentions.label"), sub: t("settings.notif.mentions.sub"), keywords: "mentions notifications" },
    { cat: "notifications", sec: "overview", label: t("settings.notif.autoRead.label"), sub: t("settings.notif.autoRead.sub"), keywords: "auto read notifications" },
    { cat: "display", sec: "messages", label: t("settings.msg.compact.label"), sub: t("settings.msg.compact.sub"), keywords: "compact chat messages bubbles" },
    { cat: "display", sec: "messages", label: t("settings.msg.enterSend.label"), sub: t("settings.msg.enterSend.sub"), keywords: "enter send chat messages keyboard" },
    { cat: "display", sec: "messages", label: t("settings.msg.timestamps.label"), sub: t("settings.msg.timestamps.sub"), keywords: "time timestamps chat messages" },
    { cat: "display", sec: "messages", label: t("settings.msg.fontSize.label"), sub: t("settings.msg.fontSize.sub"), keywords: "font size chat text messages" },
    { cat: "display", sec: "messages", label: t("settings.msg.mediaAutoLoad.label"), sub: t("settings.msg.mediaAutoLoad.sub"), keywords: "media images auto load chat" },
    { cat: "display", sec: "feed", label: t("settings.feed.animations.label"), sub: t("settings.feed.animations.sub"), keywords: "animations effects" },
    { cat: "display", sec: "feed", label: t("settings.feed.compact.label"), sub: t("settings.feed.compact.sub"), keywords: "compact spacing" },
    { cat: "display", sec: "feed", label: t("settings.feed.reactions.label"), sub: t("settings.feed.reactions.sub"), keywords: "reactions emoji" },
    { cat: "display", sec: "advanced", label: t("settings.adv.reducedMotion.label"), sub: t("settings.adv.reducedMotion.sub"), keywords: "motion animations accessibility" },
    { cat: "display", sec: "advanced", label: t("settings.adv.onlineDots.label"), sub: t("settings.adv.onlineDots.sub"), keywords: "online dots status" },
    { cat: "privacy", sec: "privacy", label: t("settings.priv.showOnline.label"), sub: t("settings.priv.showOnline.sub"), keywords: "online status privacy" },
    { cat: "privacy", sec: "privacy", label: t("settings.priv.safeMode.label"), sub: t("settings.priv.safeMode.sub"), keywords: "safe mode delete" },
    { cat: "privacy", sec: "privacy", label: t("settings.priv.publicProfile.label"), sub: t("settings.priv.publicProfile.sub"), keywords: "public profile" },
  ];

  const CATEGORIES = [
    { id: "account", label: t("settings.cat.account"), icon: "👤", sections: [
      { id: "profile", label: t("settings.sec.profile") },
      { id: "security", label: t("settings.sec.security") },
    ]},
    { id: "appearance", label: t("settings.cat.appearance"), icon: "🎨", sections: [
      { id: "theme", label: t("settings.sec.theme") },
      { id: "exclusive", label: t("settings.sec.exclusive") },
      { id: "interface", label: t("settings.sec.interface") },
    ]},
    { id: "notifications", label: t("settings.cat.notifications"), icon: "🔔", sections: [
      { id: "overview", label: t("settings.sec.overview") },
      { id: "sounds", label: t("settings.sec.sounds") },
    ]},
    { id: "display", label: t("settings.cat.display"), icon: "🖥", sections: [
      { id: "feed", label: t("settings.sec.feed") },
      { id: "messages", label: t("settings.sec.messages") },
      { id: "advanced", label: t("settings.sec.advanced") },
    ]},
    { id: "privacy", label: t("settings.cat.privacy"), icon: "🔒", sections: [
      { id: "privacy", label: t("settings.sec.privacy") },
    ]},
  ];

  const activeCat = CATEGORIES.find(c => c.id === activeCategory);

  const goSection = (secId) => {
    const el = document.getElementById(`sets-sec-${secId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(secId);
  };

  // Lock body scroll while settings are open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Scroll-spy within content
  useEffect(() => {
    const secs = activeCat?.sections || [];
    if (!secs.length) return;
    const obs = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length) setActiveSection(visible[0].target.id.replace("sets-sec-", ""));
    }, { rootMargin: "-20% 0px -60% 0px" });
    secs.forEach(s => {
      const el = document.getElementById(`sets-sec-${s.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [activeCategory]);

  const handleCatChange = (catId) => {
    setActiveCategory(catId);
    setActiveSection(null);
    setSearchQuery("");
    setMobileNavOpen(false);
    contentRef.current?.scrollTo({ top: 0 });
  };

  // Search results
  const searchResults = searchQuery.trim()
    ? ALL_SETTINGS.filter(s =>
        s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.sub.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.keywords.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // ─── Section renderers ──────────────────────────────────────────
  const renderSection = (secId) => {
    switch (secId) {
      case "profile": return <ProfileSection />;
      case "security": return <SecuritySection />;
      case "theme": return <ThemeSection />;
      case "exclusive": return <ExclusiveSection />;
      case "interface": return <InterfaceSection />;
      case "overview": return <NotifSection />;
      case "sounds": return <SoundsSection />;
      case "feed": return <FeedSection />;
      case "messages": return <MessagesSection />;
      case "advanced": return <AdvancedSection />;
      case "privacy": return <PrivacySection />;
      default: return null;
    }
  };

  // ─── Section components ─────────────────────────────────────────
  function ProfileSection() {
    return (
      <div className="sets-section-body">
        {me && (
          <div className="sets-profile-card">
            <div className="sets-profile-ava-col">
              <div className="spc-ava-wrap" onClick={() => avatarInputRef.current?.click()}>
                {me.avatar_url
                  ? <img src={assetUrl(me.avatar_url)} className="avatar big av-img" alt={me.name} />
                  : <div className="avatar big">{initials(me.name)}</div>
                }
                <div className="spc-ava-overlay"><span>📷</span></div>
              </div>
              {me.avatar_url && <button className="btn ghost" style={{ fontSize: 12, marginTop: 6 }} onClick={deleteAvatar}>{t("settings.profile.deleteAvatar")}</button>}
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={uploadAvatar} />
            </div>
            <div className="sets-profile-info">
              <div className="sets-profile-name-row">
                {nameEdit ? (
                  <>
                    <input className="spc-name-input" value={nameVal} onChange={e => setNameVal(e.target.value)} maxLength={60}
                      onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameEdit(false); setNameVal(me.name); } }} autoFocus />
                    <button className="btn accent" style={{ fontSize: 13 }} onClick={saveName} disabled={!nameVal.trim()}>{t("settings.profile.saveName")}</button>
                    <button className="btn ghost" style={{ fontSize: 13, display: "flex", alignItems: "center" }} onClick={() => { setNameEdit(false); setNameVal(me.name); }}><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="spc-display-name" style={me.name_color ? { color: me.name_color } : {}}>{me.name}</span>
                    <button className="spc-edit-btn" onClick={() => setNameEdit(true)} title={t("settings.profile.editName")}>✎</button>
                  </>
                )}
              </div>
              <div className="spc-handle">@{me.handle}</div>
              <div className="sets-label-sm">{t("settings.profile.nameColor")}</div>
              <div className="spc-colors">
                {NAME_COLORS.map(c => (
                  <button key={c.label} className={`spc-color-dot ${(me.name_color || null) === c.value ? "active" : ""}`} title={c.label}
                    style={{ background: c.value || "var(--ink-faint)" }} onClick={() => saveNameColor(c.value)} />
                ))}
              </div>
              {isPremium ? (
                <div className="spc-gradients">
                  <div className="sets-label-sm">{t("settings.profile.nameGradient")} <span className="sub-premium-tag">Premium</span></div>
                  <div className="spc-gradient-row">
                    {GRADIENT_PRESETS.map(g => (
                      <button key={g.label} className={`spc-gradient-btn ${(me.name_gradient || null) === g.value ? "active" : ""}`} title={g.label}
                        style={g.value ? { background: g.value } : { background: "var(--ink-faint)" }}
                        onClick={() => saveNameGradient(g.value)}>
                        {!g.value && <span style={{ color: "var(--ink)", fontSize: 10 }}>{t("settings.grad.none")}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="spc-premium-hint">{t("settings.profile.premiumHint")} <span className="sub-premium-tag">Premium</span></div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function SecuritySection() {
    return (
      <div className="sets-section-body">
        {token && <Security token={token} />}
        <div className="sets-danger-row">
          <button className="btn ghost" onClick={() => setSettings({ ...DEFAULT_SETTINGS })}>{t("settings.security.reset")}</button>
          {onLogout && <button className="btn ghost sets-logout-btn" onClick={async () => {
            if (settings.safeMode) {
              const ok = await confirm({ title: t("settings.logout"), message: t("settings.safeMode.logoutConfirm"), danger: true, okText: t("settings.logout") });
              if (!ok) return;
            }
            onLogout?.("logout");
          }}><LogOut size={15}/> {t("settings.logout")}</button>}
        </div>
      </div>
    );
  }

  function ThemeSection() {
    const ACCENT_NAMES = {
      "#6366f1": t("settings.accent.indigo"), "#8b5cf6": t("settings.accent.violet"), "#ec4899": t("settings.accent.pink"), "#ef4444": t("settings.accent.red"),
      "#f97316": t("settings.accent.orange"), "#eab308": t("settings.accent.yellow"), "#22c55e": t("settings.accent.green"), "#14b8a6": t("settings.accent.teal"),
      "#3b82f6": t("settings.accent.blue"), "#06b6d4": t("settings.accent.cyan"),
    };
    const BG_NAMES = { ...Object.fromEntries(Object.entries(BG_TONES).map(([k, v]) => [v, k])) };
    return (
      <div className="sets-section-body">
        {isExclusiveActive && (
          <div className="sets-exclusive-active-note">
            {t("settings.exclusiveActive")} <button className="sets-link-btn" onClick={() => { upd({ accent: DEFAULT_SETTINGS.accent, bg: DEFAULT_SETTINGS.bg, dark: DEFAULT_SETTINGS.dark, warmGlow: false }); toast(t("settings.toast.themeReset"), { type: "info" }); }}>{t("settings.exclusiveReset")}</button>
          </div>
        )}

        {/* Live theme preview mini card */}
        <div className="theme-preview-card" style={{ "--preview-accent": settings.accent, "--preview-bg": settings.bg }}>
          <div className="tpc-sidebar">
            <div className="tpc-nav-dot" style={{ background: settings.accent }} />
            <div className="tpc-nav-dot" style={{ opacity: 0.3 }} />
            <div className="tpc-nav-dot" style={{ opacity: 0.2 }} />
          </div>
          <div className="tpc-body">
            <div className="tpc-post">
              <div className="tpc-post-av" style={{ background: settings.accent }} />
              <div className="tpc-post-lines">
                <div className="tpc-line" style={{ width: "70%", background: settings.accent + "30" }} />
                <div className="tpc-line" style={{ width: "50%" }} />
              </div>
            </div>
            <div className="tpc-btn" style={{ background: settings.accent }}>Aa</div>
          </div>
        </div>

        {/* Appearance toggles */}
        <div className="theme-mode-row">
          <button className={`theme-mode-btn ${!settings.dark && !settings.themeSync && !settings.seasonalTheme && !isExclusiveActive ? "active" : ""}`}
            onClick={() => upd({ dark: false, themeSync: false, seasonalTheme: false, ...(isExclusiveActive ? { accent: DEFAULT_SETTINGS.accent, bg: DEFAULT_SETTINGS.bg, warmGlow: false } : {}) })}>
            <span className="theme-mode-icon">☀️</span>
            <span>{t("settings.theme.light")}</span>
          </button>
          <button className={`theme-mode-btn ${settings.dark && !settings.themeSync && !settings.seasonalTheme && !isExclusiveActive ? "active" : ""}`}
            onClick={() => upd({ dark: true, themeSync: false, seasonalTheme: false, ...(isExclusiveActive ? { accent: DEFAULT_SETTINGS.accent, bg: DEFAULT_SETTINGS.bg, warmGlow: false } : {}) })}>
            <span className="theme-mode-icon">🌙</span>
            <span>{t("settings.theme.dark")}</span>
          </button>
          <button className={`theme-mode-btn ${settings.themeSync && !isExclusiveActive ? "active" : ""}`}
            onClick={() => upd({ themeSync: true, seasonalTheme: false, ...(isExclusiveActive ? { accent: DEFAULT_SETTINGS.accent, bg: DEFAULT_SETTINGS.bg, warmGlow: false } : {}) })}>
            <span className="theme-mode-icon">💻</span>
            <span>{t("settings.theme.system")}</span>
          </button>
          <button className={`theme-mode-btn ${settings.seasonalTheme && !isExclusiveActive ? "active" : ""}`}
            onClick={() => upd({ seasonalTheme: true, themeSync: false, ...(isExclusiveActive ? { accent: DEFAULT_SETTINGS.accent, bg: DEFAULT_SETTINGS.bg, warmGlow: false } : {}) })}>
            <span className="theme-mode-icon">🍂</span>
            <span>{t("settings.theme.seasonal")}</span>
          </button>
        </div>

        {/* Accent color grid */}
        <div className="sets-row sets-row-block">
          <div className="sets-row-label">{t("settings.accent")}</div>
          <div className="accent-grid" style={{ marginTop: 10 }}>
            {ACCENTS.map((c) => (
              <Tip key={c} content={ACCENT_NAMES[c] || c} pos="top">
                <button className={`accent-swatch ${settings.accent === c ? "sel" : ""}`}
                  style={{ background: c }} onClick={() => upd({ accent: c })}>
                  {settings.accent === c && <span className="accent-swatch-check">✓</span>}
                </button>
              </Tip>
            ))}
            <Tip content={t("settings.accentCustom")} pos="top">
              <label className="accent-swatch accent-swatch-custom" style={{ background: ACCENTS.includes(settings.accent) ? "transparent" : settings.accent }}>
                {ACCENTS.includes(settings.accent) ? "✎" : <span className="accent-swatch-check">✓</span>}
                <input type="color" value={settings.accent} onChange={(e) => upd({ accent: e.target.value })} />
              </label>
            </Tip>
          </div>
        </div>

        {/* Background tones for light mode */}
        {!settings.dark && !settings.themeSync && (
          <div className="sets-row sets-row-block">
            <div className="sets-row-label">{t("settings.bgTone")}</div>
            <div className="bg-tone-grid" style={{ marginTop: 10 }}>
              {Object.entries(BG_TONES).map(([name, c]) => (
                <Tip key={c} content={name} pos="top">
                  <button className={`bg-tone-swatch ${settings.bg === c ? "sel" : ""}`}
                    style={{ background: c }} onClick={() => upd({ bg: c })}>
                    {settings.bg === c && <span className="bg-tone-check" style={{ color: c < "#888" ? "#fff" : "#333" }}>✓</span>}
                  </button>
                </Tip>
              ))}
            </div>
          </div>
        )}

        <Row label={t("settings.warmGlow")} sub={t("settings.warmGlow.sub")}
          right={<Toggle on={!!settings.warmGlow} onClick={() => upd({ warmGlow: !settings.warmGlow })} />} />

        <div className="sets-row sets-row-block">
          <div className="sets-row-label">{t("settings.language")}</div>
          <div className="sets-row-sub">{t("settings.languageHint")}</div>
          <div className="set-lang-btns" style={{ marginTop: 10 }}>
            {SUPPORTED_LOCALES.map(l => (
              <button key={l} className={`set-lang-btn ${(settings.language || locale) === l ? "active" : ""}`} onClick={() => { upd({ language: l }); changeLocale(l); }}>
                {LOCALE_NAMES[l]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function ExclusiveSection() {
    return (
      <div className="excl-section-wrap">
        {!isPremium && (
          <div className="excl-premium-banner">
            <span className="excl-premium-ico">✦</span>
            <div className="excl-premium-text">
              <strong>Xalle Premium</strong>
              <span>{t("settings.exclusivePremiumBanner")}</span>
            </div>
          </div>
        )}
        <div className="excl-themes-grid2">
          {EXCLUSIVE_THEMES.map(theme => {
            const isDisable = theme.accent === null;
            const isActive = !isDisable && settings.accent === theme.accent && settings.bg === theme.bg;
            const isDark = theme.dark;
            const lineAlpha = isDark ? "rgba(255,255,255," : "rgba(0,0,0,";
            return (
              <button key={theme.label}
                className={`excl-theme-card2 ${!isPremium && !isDisable ? "locked" : ""} ${isActive ? "active" : ""} ${isDisable ? "et-disable-card" : ""}`}
                style={{ "--et-accent": theme.accent || "var(--accent)", "--et-bg": theme.bg || "var(--bg-base)" }}
                onClick={() => {
                  if (isDisable) { upd({ accent: DEFAULT_SETTINGS.accent, bg: DEFAULT_SETTINGS.bg, dark: DEFAULT_SETTINGS.dark, warmGlow: false }); toast(t("settings.toast.exclusiveDisabled"), { type: "info" }); return; }
                  if (!isPremium) { toast(t("settings.exclusivePremiumOnly"), { type: "info" }); return; }
                  upd({ accent: theme.accent, bg: theme.bg, dark: theme.dark, seasonalTheme: false, themeSync: false, warmGlow: !!theme.warmGlow });
                  toast(t("settings.toast.themeApplied", { name: theme.label }), { type: "success" });
                }}>
                <div className="et-swatch2" style={{ background: isDisable ? undefined : theme.bg }}>
                  {!isDisable && (
                    <div className="et-preview-scene">
                      <div className="et-preview-topbar">
                        <div className="et-preview-avatar" style={{ background: theme.accent }} />
                        <div className="et-preview-name" style={{ background: lineAlpha + "0.25)" }} />
                      </div>
                      <div className="et-preview-line" style={{ background: lineAlpha + "0.18)", width: "80%" }} />
                      <div className="et-preview-line short" style={{ background: lineAlpha + "0.12)" }} />
                      <div className="et-preview-btn" style={{ background: theme.accent, opacity: 0.85 }} />
                    </div>
                  )}
                  {isDisable && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22" style={{ opacity: 0.35 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                  )}
                  {!isPremium && !isDisable && (
                    <div className="et-lock2-overlay">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="20" height="20">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <span className="et-lock2-label">Premium</span>
                    </div>
                  )}
                  {isActive && isPremium && (
                    <div className="et-check-overlay">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" width="26" height="26">
                        <path d="M5 12l5 5L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  {isDark && !isDisable && <span className="et-dark-badge">🌙</span>}
                </div>
                <div className="et-label-area">
                  <span className="et-label2">{theme.label}</span>
                  {isActive && isPremium && <span className="et-active-dot" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function InterfaceSection() {
    const MenuPosPreview = ({ pos }) => (
      <div className="menu-pos-preview">
        {pos === "left" ? (
          <>
            <div className="mpp-nav" />
            <div className="mpp-content">
              <div className="mpp-line" />
              <div className="mpp-line" style={{ width: "60%" }} />
            </div>
          </>
        ) : (
          <>
            <div className="mpp-content">
              <div className="mpp-line" />
              <div className="mpp-line" style={{ width: "60%" }} />
            </div>
            <div className="mpp-nav" />
          </>
        )}
      </div>
    );

    const ALL_TOAST_POSITIONS = [
      ["top-left", t("settings.toast.pos.topLeft")],
      ["top-center", t("settings.toast.pos.topCenter")],
      ["top-right", t("settings.toast.pos.topRight")],
      ["bottom-left", t("settings.toast.pos.bottomLeft")],
      ["bottom-center", t("settings.toast.pos.bottomCenter")],
      ["bottom-right", t("settings.toast.pos.bottomRight")],
    ];
    const TOAST_POSITIONS = isMobile
      ? [["top-center", t("settings.toast.pos.topCenter")], ["bottom-center", t("settings.toast.pos.bottomCenter")]]
      : ALL_TOAST_POSITIONS;

    return (
      <div className="sets-section-body">
        {!isMobile && (
          <div className="sets-row sets-row-block">
            <div className="sets-row-label">{t("settings.iface.menuPos.label")}</div>
            <div className="sets-row-sub">{t("settings.iface.menuPos.sub")}</div>
            <div className="menu-pos-visual-row" style={{ marginTop: 12 }}>
              {[["left", t("settings.menu.left")], ["right", t("settings.menu.right")]].map(([v, l]) => (
                <button key={v}
                  className={`menu-pos-visual-btn ${settings.menuPos === v ? "active" : ""}`}
                  onClick={() => upd({ menuPos: v })}>
                  <MenuPosPreview pos={v} />
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="sets-row sets-row-block">
          <div className="sets-row-label">{t("settings.iface.notifPos.label")}</div>
          <div className="sets-row-sub">{t("settings.iface.notifPos.sub")}</div>
          <div className={`toast-pos-grid ${isMobile ? "toast-pos-grid-mobile" : ""}`} style={{ marginTop: 10 }}>
            {TOAST_POSITIONS.map(([v, l]) => (
              <button key={v}
                className={`toast-pos-btn ${settings.toastPos === v ? "active" : ""}`}
                onClick={() => setToastPos(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Device settings sync */}
        <div className="sets-sync-card">
          <div className="sets-sync-devices">
            <div className={`sets-sync-device ${isMobile ? "sets-sync-device-active" : ""}`}>
              <Smartphone size={18} />
              <span>{t("settings.sync.mobile")}</span>
            </div>
            <div className="sets-sync-arrows">
              <ArrowLeftRight size={14} className="sets-sync-icon" />
            </div>
            <div className={`sets-sync-device ${!isMobile ? "sets-sync-device-active" : ""}`}>
              <Monitor size={18} />
              <span>{t("settings.sync.desktop")}</span>
            </div>
          </div>
          <p className="sets-sync-hint">{t("settings.sync.hint")}</p>
          <div className="sets-sync-btns">
            <button className="btn ghost sets-sync-btn" onClick={onSyncToOther}>
              <ArrowRight size={14} />
              {isMobile ? t("settings.sync.copyToDesktop") : t("settings.sync.copyToMobile")}
            </button>
            {otherDeviceSettings && (
              <button className="btn ghost sets-sync-btn" onClick={onSyncFromOther}>
                <ArrowLeft size={14} />
                {isMobile ? t("settings.sync.importFromDesktop") : t("settings.sync.importFromMobile")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function NotifSection() {
    const notifAll = [
      ["dmNotif", t("settings.notif.messages.label"), t("settings.notif.messages.sub")],
      ["reply", t("settings.notif.replies.label"), t("settings.notif.replies.sub")],
      ["mention", t("settings.notif.mentions.label"), t("settings.notif.mentions.sub")],
      ["repost", t("settings.notif.reposts.label"), t("settings.notif.reposts.sub")],
      ["commentReaction", t("settings.notif.commentReaction.label"), t("settings.notif.commentReaction.sub")],
      ["postReaction", t("settings.notif.postReaction.label"), t("settings.notif.postReaction.sub")],
      ["collabBlock", t("settings.notif.collabBlock.label"), t("settings.notif.collabBlock.sub")],
    ];
    return (
      <div className="sets-section-body">
        {notifAll.map(([key, label, sub]) => (
          <Row key={key} label={label} sub={sub} right={<Toggle on={notifs[key]} onClick={() => updNotif(key)} />} />
        ))}
        <Row label={t("settings.notif.autoRead.label")} sub={t("settings.notif.autoRead.sub")}
          right={<Toggle on={settings.autoReadNotifs !== false} onClick={() => upd({ autoReadNotifs: !(settings.autoReadNotifs !== false) })} />} />
      </div>
    );
  }

  function SoundsSection() {
    return (
      <div className="sets-section-body">
        <div className="sets-empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t("settings.sounds.title")}</div>
          <div style={{ opacity: 0.6, fontSize: 14 }}>{t("settings.sounds.hint")}</div>
        </div>
      </div>
    );
  }

  function FeedSection() {
    const featuresAll = [
      ["animations", t("settings.feed.animations.label"), t("settings.feed.animations.sub")],
      ["compactMode", t("settings.feed.compact.label"), t("settings.feed.compact.sub")],
      ["allowReactions", t("settings.feed.reactions.label"), t("settings.feed.reactions.sub")],
      ["allowComments", t("settings.feed.comments.label"), t("settings.feed.comments.sub")],
      ["showViews", t("settings.feed.views.label"), t("settings.feed.views.sub")],
      ["showReadTime", t("settings.feed.readTime.label"), t("settings.feed.readTime.sub")],
      ["showWhispers", t("settings.feed.whispers.label"), t("settings.feed.whispers.sub")],
      ["liveTime", t("settings.feed.liveTime.label"), t("settings.feed.liveTime.sub")],
    ];
    return (
      <div className="sets-section-body">
        {featuresAll.map(([key, label, sub]) => (
          <Row key={key} label={label} sub={sub} right={<Toggle on={settings[key]} onClick={() => upd({ [key]: !settings[key] })} />} />
        ))}
      </div>
    );
  }

  function MessagesSection() {
    const FONT_SIZES = [
      { val: "small",  label: t("settings.msg.fontSize.small") },
      { val: "normal", label: t("settings.msg.fontSize.normal") },
      { val: "large",  label: t("settings.msg.fontSize.large") },
    ];
    return (
      <div className="sets-section-body">
        <Row label={t("settings.msg.compact.label")} sub={t("settings.msg.compact.sub")}
          right={<Toggle on={settings.chatCompact} onClick={() => upd({ chatCompact: !settings.chatCompact })} />} />
        <Row label={t("settings.msg.enterSend.label")} sub={t("settings.msg.enterSend.sub")}
          right={<Toggle on={settings.chatEnterSend !== false} onClick={() => upd({ chatEnterSend: !(settings.chatEnterSend !== false) })} />} />
        <Row label={t("settings.msg.timestamps.label")} sub={t("settings.msg.timestamps.sub")}
          right={<Toggle on={settings.chatAlwaysTime} onClick={() => upd({ chatAlwaysTime: !settings.chatAlwaysTime })} />} />
        <Row label={t("settings.msg.fontSize.label")} sub={t("settings.msg.fontSize.sub")}
          right={
            <div style={{ display: "flex", gap: 6 }}>
              {FONT_SIZES.map(f => (
                <button key={f.val}
                  className={`sets-pill-btn ${(settings.chatFontSize || "normal") === f.val ? "active" : ""}`}
                  onClick={() => upd({ chatFontSize: f.val })}>
                  {f.label}
                </button>
              ))}
            </div>
          } />
        <Row label={t("settings.msg.mediaAutoLoad.label")} sub={t("settings.msg.mediaAutoLoad.sub")}
          right={<Toggle on={settings.chatMediaAutoLoad !== false} onClick={() => upd({ chatMediaAutoLoad: !(settings.chatMediaAutoLoad !== false) })} />} />
      </div>
    );
  }

  function AdvancedSection() {
    return (
      <div className="sets-section-body">
        <div className="sets-experiments-badge">BETA</div>
        <p className="sets-hint">{t("settings.advanced.hint")}</p>
        <Row label={t("settings.adv.collapse.label")} sub={t("settings.adv.collapse.sub")}
          right={<Toggle on={settings.autoCollapse !== false} onClick={() => upd({ autoCollapse: !(settings.autoCollapse !== false) })} />} />
        <Row label={t("settings.adv.reducedMotion.label")} sub={t("settings.adv.reducedMotion.sub")}
          right={<Toggle on={!!settings.reducedMotion} onClick={() => upd({ reducedMotion: !settings.reducedMotion })} />} />
        <Row label={t("settings.adv.onlineDots.label")} sub={t("settings.adv.onlineDots.sub")}
          right={<Toggle on={settings.onlineDotsInFeed !== false} onClick={() => upd({ onlineDotsInFeed: !(settings.onlineDotsInFeed !== false) })} />} />
      </div>
    );
  }

  const toggleBiometric = async () => {
    const next = !settings.biometricLock;
    if (next) {
      const avail = await checkBiometryAvailable();
      if (!avail) { toast(t("settings.priv.biometric.unavailable"), { type: "error" }); return; }
    }
    upd({ biometricLock: next });
  };

  function PrivacySection() {
    return (
      <div className="sets-section-body">
        <Row label={t("settings.priv.showOnline.label")} sub={t("settings.priv.showOnline.sub")}
          right={<Toggle on={settings.showOnline !== false} onClick={() => upd({ showOnline: !(settings.showOnline !== false) })} />} />
        <Row label={t("settings.priv.safeMode.label")} sub={t("settings.priv.safeMode.sub")}
          right={<Toggle on={settings.safeMode} onClick={() => upd({ safeMode: !settings.safeMode })} />} />
        <Row label={t("settings.priv.publicProfile.label")} sub={t("settings.priv.publicProfile.sub")}
          right={<Toggle on={settings.publicProfile !== false} onClick={() => upd({ publicProfile: !(settings.publicProfile !== false) })} />} />
        <Row label={t("settings.priv.readReceipts.label")} sub={t("settings.priv.readReceipts.sub")}
          right={<Toggle on={settings.showReadReceipts !== false} onClick={() => upd({ showReadReceipts: !(settings.showReadReceipts !== false) })} />} />
        {IS_CAPACITOR && (
          <Row label={t("settings.priv.biometric.label")} sub={t("settings.priv.biometric.sub")}
            right={<Toggle on={!!settings.biometricLock} onClick={toggleBiometric} />} />
        )}
      </div>
    );
  }

  // ─── Search result highlight ────────────────────────────────────
  const jumpToResult = (result) => {
    setActiveCategory(result.cat);
    setSearchQuery("");
    setTimeout(() => {
      const el = document.getElementById(`sets-sec-${result.sec}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  return (
    <div className="sets-screen screen">
      <div className="sets-layout">
        {/* ── Left sidebar ── */}
        <aside className={`sets-sidenav ${mobileNavOpen ? "open" : ""}`}>
          <div className="sets-sidenav-head">
            <Settings2 size={16} />
            <span>{t("settings.title")}</span>
            {isMobile && (
              <button className="sets-sidenav-close" onClick={() => setMobileNavOpen(false)} aria-label={t("common.close")}>
                <X size={16} />
              </button>
            )}
          </div>

          <div className="sets-search-wrap">
            <Search size={14} className="sets-search-ico" />
            <input
              className="sets-search"
              placeholder={t("settings.searchPlaceholder")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="sets-search-x" onClick={() => setSearchQuery("")}><X size={12} /></button>
            )}
          </div>

          {!searchQuery && CATEGORIES.map(cat => (
            <div key={cat.id} className={`sets-cat-group ${activeCategory === cat.id ? "active" : ""}`}>
              <button
                className={`sets-cat-btn ${activeCategory === cat.id ? "active" : ""}`}
                onClick={() => handleCatChange(cat.id)}
              >
                <span className="sets-cat-ico">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
              {activeCategory === cat.id && (
                <div className="sets-sub-nav">
                  {cat.sections.map(sec => (
                    <button
                      key={sec.id}
                      className={`sets-sub-btn ${activeSection === sec.id ? "active" : ""}`}
                      onClick={() => { goSection(sec.id); setMobileNavOpen(false); }}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* ── Mobile backdrop ── */}
        {mobileNavOpen && (
          <div className="sets-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
        )}

        {/* ── Right content ── */}
        <div className="sets-content" ref={contentRef}>
          {/* Mobile top bar with hamburger */}
          {isMobile && (
            <div className="sets-mobile-topbar">
              <button className="sets-hamburger-btn" onClick={() => setMobileNavOpen(true)} aria-label="Меню">
                <Menu size={20} />
              </button>
              <span className="sets-mobile-cat-label">
                {activeCat?.icon} {activeCat?.label}
              </span>
            </div>
          )}

          {searchQuery ? (
            /* Search results */
            <div className="sets-search-results">
              <div className="sets-search-results-title">
                {searchResults.length > 0 ? t("settings.searchResults", { n: searchResults.length }) : t("settings.searchEmpty")}
              </div>
              {searchResults.map((r, i) => (
                <button key={i} className="sets-search-result-item" onClick={() => jumpToResult(r)}>
                  <div>
                    <div className="sets-search-result-label">{r.label}</div>
                    <div className="sets-search-result-sub">{r.sub}</div>
                  </div>
                  <div className="sets-search-result-cat">
                    {CATEGORIES.find(c => c.id === r.cat)?.label}
                    <ChevronRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          ) : activeCat ? (
            /* Category content */
            <div key={activeCategory} className="sets-content-inner">
              <div className="sets-content-head">
                <span className="sets-content-cat-ico">{activeCat.icon}</span>
                <span className="sets-content-cat-label">{activeCat.label}</span>
              </div>
              {activeCat.sections.map(sec => (
                <div key={sec.id} id={`sets-sec-${sec.id}`} className="sets-section">
                  <div className="sets-section-title">{sec.label}</div>
                  {renderSection(sec.id)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
