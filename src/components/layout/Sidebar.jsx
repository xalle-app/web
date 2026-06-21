import { useState } from "react";
import { createPortal } from "react-dom";
import { UsersRound, BookAlert, CalendarDays, Lightbulb, Shield, Sparkles, Settings2, House, User, LogOut, MessageCircle, ChevronDown, Plus, UserCheck, Trash2, Music, Flame, X, AlertCircle, Phone } from "lucide-react";
import Tip from "../shared/Tip.jsx";
import Notifications from "./Notifications.jsx";
import { initials } from "../../lib/format.js";
import { removeAccount } from "../../lib/accounts.js";
import { useT } from "../../contexts/I18nContext.jsx";
import { useConfirm } from "../shared/ui.jsx";
import { assetUrl } from "../../lib/config.js";

const ICONS = {
  feed: <House />,
  profile: <User />,
  settings: <Settings2 />,
  logout: <LogOut />,
  reports: <BookAlert />,
  feedback: <Lightbulb />,
  collabs: <UsersRound />,
  messages: <MessageCircle />,
  plus: <Sparkles />,
  dates: <CalendarDays />,
  modpanel: <Shield />,
  music: <Music />,
};

const NAV_KEYS = [["feed", "nav.feed"], ["collabs", "nav.collabs"], ["messages", "nav.messages"], ["music", "nav.music"], ["dates", "nav.planner"], ["profile", "nav.profile"], ["settings", "nav.settings"], ["plus", "nav.plus"]];

function AccountManagerModal({ me, accounts, onSwitchAccount, onAddAccount, onClose }) {
  const [list, setList] = useState(accounts);
  const t = useT();

  const remove = (userId) => {
    removeAccount(userId);
    setList(l => l.filter(a => a.userId !== userId));
  };

  return (
    <div className="accmgr-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="accmgr-modal card pop-in">
        <div className="accmgr-head">
          <h3>{t("nav.profile")} &amp; {t("sidebar.manageAccounts").toLowerCase()}</h3>
          <button className="accmgr-close-btn" onClick={onClose} aria-label={t("common.close")}><X size={16} /></button>
        </div>
        <div className="accmgr-list">
          {list.map(acc => {
            const isCurrent = acc.handle === me?.handle;
            return (
              <div key={acc.userId} className={`accmgr-item ${isCurrent ? "current" : ""} ${acc.expired ? "accmgr-item-expired" : ""}`}>
                {acc.avatarUrl
                  ? <img src={assetUrl(acc.avatarUrl)} className="accsw-av av-img accmgr-av" alt={acc.name} />
                  : <div className="accsw-av accsw-av-letter accmgr-av">{initials(acc.name)}</div>
                }
                <div className="accmgr-info">
                  <div className="accmgr-name">
                    {acc.name}
                    {isCurrent && <span className="accmgr-badge">{t("common.now")}</span>}
                    {!isCurrent && acc.expired && <span className="accmgr-badge accmgr-badge-expired"><AlertCircle size={10} />{t("sidebar.sessionExpired")}</span>}
                  </div>
                  <div className="accmgr-handle">@{acc.handle}</div>
                </div>
                {!isCurrent && (
                  <button className="accmgr-switch-btn" onClick={() => { onSwitchAccount(acc); onClose(); }}>
                    {acc.expired ? t("auth.loginBtn") : t("auth.loginBtn")}
                  </button>
                )}
                {!isCurrent && (
                  <button className="accmgr-remove-btn" onClick={() => remove(acc.userId)} title={t("common.delete")}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="accmgr-footer">
          <button className="btn accent accmgr-add-btn" onClick={() => { onAddAccount(); onClose(); }}>
            <Plus size={15} />
            {t("auth.createAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountSwitcher({ me, accounts, onSwitchAccount, onAddAccount, onLogout, safeMode }) {
  const [open, setOpen] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const t = useT();
  const confirm = useConfirm();
  const others = accounts.filter(a => a.handle !== me?.handle);

  const handleSwitch = async (acc) => {
    if (safeMode) {
      const ok = await confirm({ title: t("sidebar.switchAccount"), message: t("settings.safeMode.switchConfirm"), okText: t("auth.loginBtn") });
      if (!ok) return;
    }
    onSwitchAccount(acc);
    setOpen(false);
  };

  const handleLogout = async () => {
    if (safeMode) {
      const ok = await confirm({ title: t("sidebar.logout"), message: t("settings.safeMode.logoutConfirm"), danger: true, okText: t("sidebar.logout") });
      if (!ok) return;
    }
    onLogout();
    setOpen(false);
  };

  return (
    <div className={`accsw ${open ? "accsw-open" : ""}`}>
      {open && (
        <div className="accsw-menu">
          {others.map(acc => (
            <button key={acc.handle} className={`accsw-item ${acc.expired ? "accsw-item-expired" : ""}`} onClick={() => handleSwitch(acc)}>
              {acc.avatarUrl
                ? <img src={assetUrl(acc.avatarUrl)} className="accsw-av av-img" alt={acc.name} />
                : <div className="accsw-av accsw-av-letter">{initials(acc.name)}</div>
              }
              <div className="accsw-item-info">
                <div className="accsw-item-name">{acc.name}</div>
                <div className="accsw-item-handle">@{acc.handle}{acc.expired && <span className="accsw-expired-tag"><AlertCircle size={10} />{t("sidebar.sessionExpired")}</span>}</div>
              </div>
              {acc.expired ? <AlertCircle size={14} className="accsw-check accsw-check-expired" /> : <UserCheck size={14} className="accsw-check" />}
            </button>
          ))}
          <div className="accsw-divider" />
          <button className="accsw-item accsw-manage" onClick={() => { setOpen(false); setShowManager(true); }}>
            <div className="accsw-av accsw-av-manage"><Settings2 size={14} /></div>
            <span>{t("sidebar.manageAccounts")}</span>
          </button>
          <button className="accsw-item accsw-logout" onClick={handleLogout}>
            <div className="accsw-av accsw-av-out"><LogOut size={14} /></div>
            <span>{t("sidebar.logout")}</span>
          </button>
        </div>
      )}
      {open && <div className="accsw-backdrop" onClick={() => setOpen(false)} />}
      <button className="accsw-trigger" onClick={() => setOpen(v => !v)}>
        {me?.avatar_url
          ? <img src={assetUrl(me.avatar_url)} className="accsw-av av-img" alt={me.name} />
          : <div className="accsw-av accsw-av-letter">{initials(me?.name || "?")}</div>
        }
        <div className="accsw-me">
          <div className="accsw-me-name">{me?.name}</div>
          <div className="accsw-me-handle">@{me?.handle}</div>
        </div>
        <ChevronDown size={14} className={`accsw-arrow ${open ? "accsw-arrow-up" : ""}`} />
      </button>
      {showManager && createPortal(
        <AccountManagerModal
          me={me}
          accounts={accounts}
          onSwitchAccount={onSwitchAccount}
          onAddAccount={onAddAccount}
          onClose={() => setShowManager(false)}
        />,
        document.body
      )}
    </div>
  );
}

export default function Sidebar({ view, setView, liveConn, online, onLogout, token, notifBump, onOpenPost, menuStyle = "text-icons", onShowDoc, isMod, pendingReports = 0, openFeedback = 0, onFeedback, onGoCollabs, onShowChangelog, currentVersion = "1.0.0", dmUnread = 0, me, accounts = [], onSwitchAccount, onAddAccount, safeMode, onVoiceCall, voiceCallActive = false }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAccManager, setShowAccManager] = useState(false);
  const t = useT();
  const confirm = useConfirm();
  const nav = isMod
    ? [...NAV_KEYS, ["reports", "nav.reports"], ["feedback", "nav.feedback"], ["modpanel", "nav.modpanel"]]
    : NAV_KEYS;

  const item = (key, labelKey, extraClass = "") => {
    const label = t(labelKey);
    const showIcon = menuStyle !== "text";
    const showText = menuStyle !== "icons";
    const count = key === "reports" ? pendingReports : key === "feedback" ? openFeedback : key === "messages" ? dmUnread : 0;
    const isPlus = key === "plus";
    const badge = count > 0 ? <span className="nav-badge">{count > 9 ? "9+" : count}</span> : null;
    const btn = (
      <button className={`${view === key ? "on" : ""} ${extraClass} ${isPlus ? "nav-plus" : ""}`} onClick={key === "logout" ? onLogout : () => setView(key)}>
        {showIcon && <span className="nav-ico">{ICONS[key]}{badge}</span>}
        {showText && <span className={`nav-text ${isPlus ? "nav-plus-text" : ""}`}>{label}{!showIcon && badge}</span>}
      </button>
    );
    return menuStyle === "icons" ? <Tip key={key} content={label} pos="right">{btn}</Tip> : <span key={key}>{btn}</span>;
  };

  const go = async (key) => {
    if (key === "logout") {
      if (safeMode) {
        const ok = await confirm({ title: t("sidebar.logout"), message: t("settings.safeMode.logoutConfirm"), danger: true, okText: t("sidebar.logout") });
        if (!ok) return;
      }
      onLogout();
    } else {
      setView(key);
    }
    setMobileOpen(false);
  };

  return (
    <>
      {/* ===== Десктоп / планшет: обычная боковая панель ===== */}
      <aside className="sidebar">
        <div className="brand" onClick={() => setView("feed")} style={{ cursor: "pointer" }}>
          <span className="brand-full">Xalle<span className="dot">.</span></span>
          <span className="brand-mini">XA</span>
        </div>
        <div className="side-top">
          <Tip content={liveConn ? "Соединение активно — обновления в реальном времени" : "Переподключение к серверу…"} pos="bottom">
            <div className="online">
              <i className={`live-dot ${liveConn ? "on" : ""}`} />
              <span className="online-text">{liveConn ? <>онлайн: <b>{online}</b></> : "связь…"}</span>
            </div>
          </Tip>
          <Notifications token={token} bump={notifBump} onOpenPost={onOpenPost} onGoCollabs={onGoCollabs} />
          {onVoiceCall && (
            <Tip content={t("vcall.sidebar.btn")} pos="bottom">
              <button className={`side-voice-btn${voiceCallActive ? " side-voice-btn-active" : ""}`} onClick={onVoiceCall}>
                <Phone size={15} />
                {voiceCallActive && <span className="side-voice-live" />}
              </button>
            </Tip>
          )}
        </div>
        <nav className={`vnav style-${menuStyle}`}>
          {nav.map(([k, l]) => item(k, l))}
        </nav>
        <div className="side-bottom">
          {me?.streak?.streak_days > 0 && (
            <div className="streak-badge" title={t("sidebar.streakTitle", { days: me.streak.streak_days, best: me.streak.streak_best })}>
              <Flame size={14} className="streak-flame" />
              <span className="streak-days">{me.streak.streak_days}</span>
              <span className="streak-label">{t("sidebar.streakDays")}</span>
            </div>
          )}
          {me && (
            <AccountSwitcher me={me} accounts={accounts} onSwitchAccount={onSwitchAccount} onAddAccount={onAddAccount} onLogout={onLogout} safeMode={safeMode} />
          )}
          <footer className="side-footer">
            <button className="feedback-link" onClick={onFeedback}>{t("sidebar.reportBug")}</button>
            <div className="foot-links">
              <button onClick={() => onShowDoc("privacy")}>{t("sidebar.privacy")}</button>
              <button onClick={() => onShowDoc("terms")}>{t("sidebar.terms")}</button>
              <button onClick={() => onShowDoc("about")}>{t("sidebar.about")}</button>
            </div>
            <div className="sidebar-version" onClick={onShowChangelog} style={{ cursor: "pointer" }}>v{currentVersion}</div>
            <div className="foot-copy">© 2026 Xalle</div>
          </footer>
        </div>
      </aside>

      {/* ===== Мобильная верхняя панель с дропдауном ===== */}
      <div className="mobile-top">
        <div className="brand" onClick={() => setView("feed")}>Xalle<span className="dot">.</span></div>
        <div className="mobile-top-right">
          <div className="online mobile-online-wrap">
            <i className={`live-dot ${liveConn ? "on" : ""}`} />
            <span className="mobile-online-count">{liveConn ? online : "—"}</span>
          </div>
          <Notifications token={token} bump={notifBump} onOpenPost={onOpenPost} onGoCollabs={onGoCollabs} />
          {onVoiceCall && (
            <button className={`side-voice-btn${voiceCallActive ? " side-voice-btn-active" : ""}`} onClick={onVoiceCall}>
              <Phone size={15} />
              {voiceCallActive && <span className="side-voice-live" />}
            </button>
          )}
          <button className={`burger ${mobileOpen ? "on" : ""}`} onClick={() => setMobileOpen((v) => !v)} aria-label="Меню">
            <span /><span /><span />
          </button>
        </div>
      </div>
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
      <div className={`mobile-dropdown ${mobileOpen ? "open" : ""}`}>
        {me && (
          <div className="md-account-row">
            <div className="md-account-info">
              {me.avatar_url
                ? <img src={assetUrl(me.avatar_url)} className="accsw-av av-img" alt={me.name} />
                : <div className="accsw-av accsw-av-letter">{initials(me.name || "?")}</div>
              }
              <div>
                <div className="md-account-name">{me.name}</div>
                <div className="md-account-handle">@{me.handle}</div>
              </div>
            </div>
            <button className="md-account-manage-btn" onClick={() => { setMobileOpen(false); setShowAccManager(true); }}>{t("sidebar.manage")}</button>
          </div>
        )}
        {me?.streak?.streak_days > 0 && (
          <div className="md-streak">
            <Flame size={14} className="md-streak-flame" />
            <span className="md-streak-days">{me.streak.streak_days}</span>
            <span className="md-streak-label">{me.streak.streak_days === 1 ? t("sidebar.streakDays1") : me.streak.streak_days >= 2 && me.streak.streak_days <= 4 ? t("sidebar.streakDays2") : t("sidebar.streakDays5")}</span>
          </div>
        )}
        <nav className="md-nav">
          {nav.map(([k, lKey]) => (
            <button key={k} className={view === k ? "on" : ""} onClick={() => go(k)}>
              <span className="nav-ico">{ICONS[k]}</span><span>{t(lKey)}</span>
              {((k === "reports" && pendingReports > 0) || (k === "feedback" && openFeedback > 0) || (k === "messages" && dmUnread > 0)) && <span className="nav-badge md-badge">{(k === "reports" ? pendingReports : k === "feedback" ? openFeedback : dmUnread) > 9 ? "9+" : (k === "reports" ? pendingReports : k === "feedback" ? openFeedback : dmUnread)}</span>}
            </button>
          ))}
          <button className="logout" onClick={() => go("logout")}>
            <span className="nav-ico">{ICONS.logout}</span><span>{t("sidebar.logout")}</span>
          </button>
        </nav>
        <div className="md-docs">
          <button onClick={() => { onFeedback(); setMobileOpen(false); }}>{t("sidebar.reportBug")}</button>
          <button onClick={() => { onShowDoc("privacy"); setMobileOpen(false); }}>{t("sidebar.privacy")}</button>
          <button onClick={() => { onShowDoc("terms"); setMobileOpen(false); }}>{t("sidebar.terms")}</button>
          <button onClick={() => { onShowDoc("about"); setMobileOpen(false); }}>{t("sidebar.about")}</button>
          <div className="md-version" onClick={() => { onShowChangelog?.(); setMobileOpen(false); }}>v{currentVersion}</div>
          <div className="md-copy">© 2026 Xalle</div>
        </div>
      </div>
      {showAccManager && createPortal(
        <AccountManagerModal
          me={me}
          accounts={accounts}
          onSwitchAccount={onSwitchAccount}
          onAddAccount={onAddAccount}
          onClose={() => setShowAccManager(false)}
        />,
        document.body
      )}
    </>
  );
}
