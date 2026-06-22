import { useEffect, useState, useCallback, useRef } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { api } from "./lib/api.js";
import { WS_BASE, API_BASE } from "./lib/config.js";
import { registerFcmToken } from "./lib/fcm.js";
import { DEFAULT_SETTINGS, applySettings, initials, fullDate } from "./lib/format.js";
import Tip from "./components/shared/Tip.jsx";
import { Name } from "./components/shared/icons.jsx";
import Auth from "./components/pages/Auth.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import Notifications from "./components/layout/Notifications.jsx";
import Composer from "./components/composer/Composer.jsx";
import Post from "./components/feed/Post.jsx";
import Settings from "./components/settings/Settings.jsx";
import MarkdownHelp from "./components/modals/MarkdownHelp.jsx";
import DocModal from "./components/modals/DocModal.jsx";
import UserProfile from "./components/profile/UserProfile.jsx";
import ReportsPanel from "./components/admin/ReportsPanel.jsx";
import FeedbackPanel from "./components/admin/FeedbackPanel.jsx";
import CollabPanel from "./components/collab/CollabPanel.jsx";
import XallePlus from "./components/settings/XallePlus.jsx";
import MemorableDates from "./components/pages/MemorableDates.jsx";
import Planner from "./components/pages/Planner.jsx";
import Changelog from "./components/pages/Changelog.jsx";
import ModPanelPage from "./components/admin/ModPanelPage.jsx";
import UpdateNotification from "./components/layout/UpdateNotification.jsx";
import MentionHover from "./components/layout/MentionHover.jsx";
import FeedbackModal from "./components/modals/FeedbackModal.jsx";
import Messages from "./components/messages/Messages.jsx";
import FullProfile from "./components/profile/FullProfile.jsx";
import MusicView from "./components/music/MusicView.jsx";
import MusicPlayer from "./components/music/MusicPlayer.jsx";
import ListenRoom from "./components/music/ListenRoom.jsx";
import * as Player from "./lib/player.js";
import DmNotification from "./components/layout/DmNotification.jsx";
import { UIProvider, useToast } from "./components/shared/ui.jsx";
import { saveAccount, removeAccount, getAccounts, markAccountExpired, markAccountValid } from "./lib/accounts.js";
import { I18nProvider } from "./contexts/I18nContext.jsx";
import { useT } from "./contexts/I18nContext.jsx";
import { useVoiceCall } from "./lib/useVoiceCall.js";
import { VoiceCallWidget, VoiceCallDialog, IncomingCallBanner } from "./components/voice/VoiceCallWidget.jsx";
import { IS_CAPACITOR } from "./lib/config.js";
import { checkBiometryAvailable } from "./lib/biometric.js";
import BiometricLock from "./components/shared/BiometricLock.jsx";
import MobileWall from "./components/shared/MobileWall.jsx";

function streakDayWord(n, t) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 19) return t("app.streak.days.n");
  if (mod10 === 1) return t("app.streak.days.1");
  if (mod10 >= 2 && mod10 <= 4) return t("app.streak.days.24");
  return t("app.streak.days.n");
}

function SubscriptionExpiryWatcher({ me, token, setSession }) {
  const t = useT();
  const toast = useToast();
  useEffect(() => {
    if (!me?.subscription_expires || !me?.subscription_tier) return;
    const expires = new Date(me.subscription_expires.replace(" ", "T") + "Z");
    const now = new Date();
    const msLeft = expires.getTime() - now.getTime();
    if (msLeft <= 0) return;
    if (msLeft > 7 * 24 * 3600 * 1000) return;
    const timer = setTimeout(async () => {
      try {
        const u = await api("/me", { token });
        if (u?.id) setSession(s => s ? { ...s, user: { ...s.user, ...u } } : s);
        toast(t("app.sub.expired"), { type: "info" });
      } catch {}
    }, msLeft + 1000);
    return () => clearTimeout(timer);
  }, [me?.subscription_expires, me?.subscription_tier, token]);
  return null;
}

function useVersionChecker({ token, intervalSeconds = 300, onNewVersion }) {
  const [currentVersion, setCurrentVersion] = useState(() => localStorage.getItem("xalle.currentVersion") || "1.0.0");
  const intervalRef = useRef(null);
  const notifSentRef = useRef(false);
  const onNewVersionRef = useRef(onNewVersion);

  useEffect(() => { onNewVersionRef.current = onNewVersion; }, [onNewVersion]);

  const isNewerVersion = (latest, current) => {
    if (!latest || !current) return false;
    const parse = (v) => { const p = v.toString().split('.').map(Number); while (p.length < 3) p.push(0); return p; };
    const l = parse(latest), c = parse(current);
    for (let i = 0; i < 3; i++) { if (l[i] > c[i]) return true; if (l[i] < c[i]) return false; }
    return false;
  };

  const checkVersion = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/changelog", { token });
      if (!Array.isArray(data) || !data.length) return;
      const latest = data[0];
      const stored = localStorage.getItem("xalle.currentVersion") || currentVersion;
      if (isNewerVersion(latest.version, stored) && !notifSentRef.current) {
        notifSentRef.current = true;
        localStorage.setItem("xalle.currentVersion", latest.version);
        setCurrentVersion(latest.version);
        onNewVersionRef.current?.(latest);
      } else if (!isNewerVersion(latest.version, stored)) {
        notifSentRef.current = false;
      }
    } catch {}
  }, [token, currentVersion]);

  useEffect(() => {
    if (!token) return;
    notifSentRef.current = false;
    const timer = setTimeout(checkVersion, 1000);
    intervalRef.current = setInterval(checkVersion, intervalSeconds * 1000);
    return () => { clearTimeout(timer); clearInterval(intervalRef.current); };
  }, [token, intervalSeconds, checkVersion]);

  return { currentVersion, checkVersion };
}

function AppInner({ settings, setSettings, settingsLoaded, setSettingsLoaded, session, setSession, isMobile, otherDeviceSettings, setOtherDeviceSettings, deviceKey, otherKey }) {
  const t = useT();
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [view, setView] = useState(() => {
    const path = window.location.pathname.replace(/^\//, "") || "feed";
    const known = ["feed","profile","settings","plus","collabs","messages","reports","feedback","dates","memorialdates","modpanel","fullprofile","music"];
    return known.includes(path) ? path : "feed";
  });
  const [showHelp, setShowHelp] = useState(false);
  const [commentBump, setCommentBump] = useState(0);
  const [liveConn, setLiveConn] = useState(false);
  const [online, setOnline] = useState(0);
  const [query, setQuery] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [focusPost, setFocusPost] = useState(null);
  const [notifBump, setNotifBump] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [doc, setDoc] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [profileHandle, setProfileHandle] = useState(null);
  const [fullProfileHandle, setFullProfileHandle] = useState(null);
  const [pendingReports, setPendingReports] = useState(0);
  const [reportsBump, setReportsBump] = useState(0);
  const [openFeedback, setOpenFeedback] = useState(0);
  const [highlightCollab, setHighlightCollab] = useState(null);
  const [feedbackBump, setFeedbackBump] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const [dmInitHandle, setDmInitHandle] = useState(null);
  const [collabsBump, setCollabsBump] = useState(0);
  const [feedScope, setFeedScope] = useState("world");
  const [filters, setFilters] = useState({ from: "", mentions: "", sort: "desc" });
  const [showFilters, setShowFilters] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [versionUpdateNotif, setVersionUpdateNotif] = useState(null);
  const [buildUpdateInfo, setBuildUpdateInfo] = useState(null);
  const [achievementToast, setAchievementToast] = useState(null);
  const searchRef = useRef(null);

  // ── Listen Together ──────────────────────────────────────────
  const [listenRoom, setListenRoom] = useState(null); // { code, room, chat } | null
  const [showListenModal, setShowListenModal] = useState(false);
  const [playerState, setPlayerState] = useState(() => Player.getState());
  const listenRoomRef = useRef(null);
  const listenHostPrevRef = useRef({ trackId: null, playing: null });
  const meRef = useRef(null);

  const [biometricLocked, setBiometricLocked] = useState(false);
  const backgroundedAtRef = useRef(null);

  const token = session?.token;
  const me = session?.user;

  const voiceCall = useVoiceCall(me?.id);
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);

  const navigateTo = useCallback((v) => {
    setView(v);
    if (v === "messages") setDmUnread(0);
    const path = v === "feed" ? "/" : `/${v}`;
    if (window.location.pathname !== path) {
      history.pushState({ view: v }, "", path);
    }
  }, []);

  useEffect(() => {
    const path = view === "feed" ? "/" : `/${view}`;
    if (window.location.pathname !== path) {
      history.replaceState({ view }, "", path);
    }
    const onPop = (e) => {
      const v = e.state?.view || window.location.pathname.replace(/^\//, "") || "feed";
      setView(v);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleNewVersion = useCallback((latestVersion) => {
    setVersionUpdateNotif(latestVersion);
  }, []);

  const { currentVersion } = useVersionChecker({ token, intervalSeconds: 300, onNewVersion: handleNewVersion });

  useEffect(() => {
    if (!token) return;
    api("/me", { token }).then((u) => {
      if (u && u.id) setSession((s) => s ? { ...s, user: { ...s.user, ...u } } : s);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || me?.role !== "moderator") return;
    api(`/mod/reports?status=pending`, { token }).then((d) => setPendingReports(d.pending)).catch(() => {});
  }, [token, me?.role, reportsBump]);

  useEffect(() => {
    if (!token || me?.role !== "moderator") return;
    api(`/feedback?status=open`, { token }).then((d) => setOpenFeedback(d.open)).catch(() => {});
  }, [token, me?.role, feedbackBump]);

  useEffect(() => {
    if (!token) return;
    api("/settings", { token }).then((raw) => {
      if (raw) {
        // Migration: existing flat settings → treat as desktop defaults
        const hasBuckets = raw._desktop || raw._mobile;
        const deviceSettings = hasBuckets ? raw[deviceKey] : (isMobile ? null : raw);
        const deviceDefaults = isMobile ? MOBILE_DEFAULTS : DESKTOP_DEFAULTS;
        if (deviceSettings) setSettings({ ...DEFAULT_SETTINGS, ...deviceDefaults, ...deviceSettings });
        setOtherDeviceSettings(hasBuckets ? (raw[otherKey] || null) : (isMobile ? raw : null));
      }
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
  }, [token]);
  useEffect(() => { applySettings(settings); }, [settings]);
  useEffect(() => {
    if (!settings.themeSync || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => applySettings(settings);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [settings.themeSync, settings]);
  useEffect(() => {
    if (!token || !settingsLoaded) return;
    const fullPayload = { [deviceKey]: settings, [otherKey]: otherDeviceSettings };
    const timer = setTimeout(() => {
      sessionStorage.setItem("xalle.settings.saving", "1");
      api("/settings", { method: "PUT", token, body: fullPayload })
        .catch(() => {})
        .finally(() => setTimeout(() => sessionStorage.removeItem("xalle.settings.saving"), 500));
    }, 400);
    return () => clearTimeout(timer);
  }, [settings, otherDeviceSettings, token, settingsLoaded]);

  const hasLoadedRef = useRef(false);
  const load = useCallback((soft = false) => {
    if (!token) return;
    if (feedScope === "recommendations") { setLoading(false); return; }
    if (!soft && !hasLoadedRef.current) setLoading(true);
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (feedScope !== "world") p.set("scope", feedScope);
    if (filters.from.trim()) p.set("from", filters.from.trim());
    if (filters.mentions.trim()) p.set("mentions", filters.mentions.trim());
    if (filters.sort === "asc") p.set("sort", "asc");
    const qs = p.toString();
    api(`/posts${qs ? "?" + qs : ""}`, { token }).then((pp) => { setPosts(pp); setLoading(false); hasLoadedRef.current = true; }).catch(() => setLoading(false));
  }, [token, query, feedScope, filters]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    let ws, retry, alive = true;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = WS_BASE
        ? `${WS_BASE}/ws?token=${encodeURIComponent(token)}`
        : `${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setLiveConn(true); setTimeout(() => load(), 300);
        const prev = listenRoomRef.current;
        if (prev?.code) {
          setTimeout(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: "listen:join", code: prev.code })); }, 300);
        }
      };
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === "hello") {
            const prevHash = localStorage.getItem("xalle.buildHash");
            if (prevHash && prevHash !== m.buildHash) {
              setBuildUpdateInfo({ critical: false, changelog: m.changelog || null });
            }
            localStorage.setItem("xalle.buildHash", m.buildHash);
          }
          else if (m.type === "poll:update") {
            window.dispatchEvent(new CustomEvent("poll:update", { detail: m }));
          }
          else if (m.type === "version:update") {
            setBuildUpdateInfo({ critical: !!m.critical, message: m.message, changelog: m.changelog || null });
          }
          else if (m.type === "posts") load();
          else if (m.type === "reaction:update") {
            setPosts((cur) => cur.map((p) => p.id === m.postId ? { ...p, reactions: { ...p.reactions, counts: m.counts } } : p));
          }
          else if (m.type === "view:update") {
            setPosts((cur) => cur.map((p) => p.id === m.postId ? { ...p, views: m.views } : p));
          }
          else if (m.type === "comments") setCommentBump((n) => n + 1);
          else if (m.type === "online") setOnline(m.count);
          else if (m.type === "notif") { setNotifBump((n) => n + 1); setNotifUnread(n => n + 1); }
          else if (m.type === "reports") setReportsBump((n) => n + 1);
          else if (m.type === "feedback") setFeedbackBump((n) => n + 1);
          else if (m.type === "collabs") setCollabsBump((n) => n + 1);
          else if (m.type === "presence" && !m.hidden) {
            setPosts((cur) => cur.map((p) => {
              const patch = {};
              if (p.user_id === m.userId) { patch.online = m.online; if (!m.online) patch.last_seen = new Date().toISOString().slice(0, 19).replace("T", " "); }
              if (p.original && p.original.user_id === m.userId) patch.original = { ...p.original, online: m.online };
              return Object.keys(patch).length ? { ...p, ...patch } : p;
            }));
          }
          else if (m.type === "subscription:update") {
            api("/me", { token }).then((u) => {
              if (u?.id) setSession((s) => s ? { ...s, user: { ...s.user, ...u } } : s);
            }).catch(() => {});
            window.dispatchEvent(new CustomEvent("subscription:updated"));
          }
          else if (m.type === "dm:new") {
            window.dispatchEvent(new CustomEvent("ws:dm:new", { detail: m }));
            setDmUnread(n => n + 1);
            if (view !== "messages" && m.msg && !m.muted) {
              window.dispatchEvent(new CustomEvent("dm:notification", { detail: { msg: m.msg, conv: m.conv } }));
            }
          }
          else if (m.type === "dm:read") {
            window.dispatchEvent(new CustomEvent("ws:dm:read", { detail: m }));
          }
          else if (m.type === "dm:typing") {
            window.dispatchEvent(new CustomEvent("ws:dm:typing", { detail: m }));
          }
          else if (m.type === "achievement") {
            window.dispatchEvent(new CustomEvent("achievement:new", { detail: m }));
          }
          else if (m.type === "presence") {
            window.dispatchEvent(new CustomEvent("ws:presence:raw", { detail: m }));
          }
          else if (m.type === "dm:conv_deleted") {
            window.dispatchEvent(new CustomEvent("ws:dm:conv_deleted", { detail: m }));
          }
          else if (m.type === "dm:reaction") {
            window.dispatchEvent(new CustomEvent("ws:dm:reaction:raw", { detail: m }));
          }
          else if (m.type === "group:new_message") {
            window.dispatchEvent(new CustomEvent("ws:group:message", { detail: m }));
          }
          else if (m.type === "group:message_deleted") {
            window.dispatchEvent(new CustomEvent("ws:group:message_deleted", { detail: m }));
          }
          else if (m.type === "group:members_updated") {
            window.dispatchEvent(new CustomEvent("ws:group:members_updated", { detail: m }));
          }
          else if (m.type === "group:updated") {
            window.dispatchEvent(new CustomEvent("ws:group:updated", { detail: m }));
          }
          else if (m.type === "group:pin_updated") {
            window.dispatchEvent(new CustomEvent("ws:group:pin_updated", { detail: m }));
          }
          else if (m.type === "group:typing") {
            window.dispatchEvent(new CustomEvent("ws:group:typing", { detail: m }));
          }
          else if (m.type === "group:reaction") {
            window.dispatchEvent(new CustomEvent("ws:group:reaction", { detail: m }));
          }
          else if (m.type === "group:message_edited") {
            window.dispatchEvent(new CustomEvent("ws:group:message_edited", { detail: m }));
          }
          else if (m.type?.startsWith("listen:")) {
            const ROOM_EVENTS = ["listen:joined","listen:play","listen:pause","listen:seek","listen:track","listen:members","listen:settings"];
            const isHost = m.hostId === meRef.current?.id;
            if (ROOM_EVENTS.includes(m.type)) {
              setListenRoom(prev => ({
                code: m.code,
                room: { hostId: m.hostId, members: m.members || [], track: m.track, queue: m.queue || [], playing: m.playing, position: m.position, settings: m.settings || {} },
                chat: prev?.chat || [],
              }));
              // Guest: sync Player from room state
              if (!isHost) {
                const cur = Player.getState();
                if (m.track) {
                  if (cur.current?.src !== m.track.src) {
                    Player.syncToRoom(m.track, m.position || 0, !!m.playing);
                  } else {
                    if (Math.abs(cur.currentTime - (m.position || 0)) > 2) Player.seekToSeconds(m.position || 0);
                    if (m.playing && cur.playing === false) Player.resume();
                    else if (!m.playing && cur.playing) Player.pause();
                  }
                } else {
                  Player.pause();
                }
              }
              // Host joined own room — push current Player state into room if needed
              if (isHost && m.type === "listen:joined") {
                const cur = Player.getState();
                if (cur.current) {
                  const tr = cur.current;
                  const trackPayload = { id: tr.id, title: tr.title, artist: tr.artist, src: tr.src, coverUrl: tr.coverUrl, duration: tr.duration };
                  // Send track if room doesn't have it yet
                  if (!m.track || m.track.src !== tr.src) {
                    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:track", track: trackPayload } }));
                  }
                  // Send play state if player is running but room thinks it's paused
                  if (cur.playing && !m.playing) {
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:play", position: Player.getState().currentTime } }));
                    }, 200);
                  }
                }
              }
            } else if (m.type === "listen:kicked") {
              const isBan = m.reason === "ban";
              toast(isBan ? t("listen.kicked.ban") : t("listen.kicked.kick"), { type: "error" });
              setListenRoom(null);
              setShowListenModal(false);
              window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:leave" } }));
            } else if (m.type === "listen:error") {
              toast(m.message || t("common.error"), { type: "error" });
              setListenRoom(null); setShowListenModal(false);
            } else if (m.type === "listen:chat") {
              setListenRoom(prev => prev ? { ...prev, chat: [...(prev.chat || []), { userId: m.userId, name: m.name, handle: m.handle, avatar: m.avatar, text: m.text, at: m.at }].slice(-200) } : prev);
            }
          }
          else if (m.type === "listen:room_closed") {
            window.dispatchEvent(new CustomEvent("listen:room_closed", { detail: { code: m.code } }));
          }
          else if (m.type?.startsWith("vcall:")) {
            window.dispatchEvent(new CustomEvent("vcall:ws:msg", { detail: m }));
          }
          else if (m.type?.startsWith("playlist:")) {
            window.dispatchEvent(new CustomEvent(m.type, { detail: m }));
          }
          else if (m.type === "role:update") {
            setSession((s) => s ? { ...s, user: { ...s.user, role: m.role } } : s);
          }
          else if (m.type === "user:update") {
            setSession((s) => {
              if (!s.user || s.user.id !== m.userId) return s;
              return { ...s, user: { ...s.user, ...m } };
            });
          }
          else if (m.type === "profile:updated") {
            // Sync profile changes (name/avatar/color/gradient) across all open sessions
            const { type: _, ...patch } = m;
            setSession((s) => s ? { ...s, user: { ...s.user, ...patch } } : s);
          }
          else if (m.type === "settings:updated" && m.settings) {
            // Auto-sync settings from another device of the same user
            const deviceBucket = m.settings[deviceKey];
            if (deviceBucket) {
              // Only apply if it's a different origin (not echoed from this device's own save)
              // We skip the update if sessionStorage flag is set (we just saved)
              if (!sessionStorage.getItem("xalle.settings.saving")) {
                setSettings(s => ({ ...s, ...deviceBucket }));
              }
            }
          }
        } catch (e) {
          console.error("WS error:", e);
        }
      };
      ws.onclose = () => { setLiveConn(false); if (alive) retry = setTimeout(connect, 1500); };
      ws.onerror = () => ws.close();
    };
    connect();
    const handleSendTyping = (e) => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "dm:typing", convId: e.detail.convId }));
    };
    const handleWsSend = (e) => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(e.detail));
    };
    window.addEventListener("dm:send-typing", handleSendTyping);
    window.addEventListener("app:ws:send", handleWsSend);
    return () => {
      alive = false; clearTimeout(retry); ws && ws.close();
      window.removeEventListener("dm:send-typing", handleSendTyping);
      window.removeEventListener("app:ws:send", handleWsSend);
    };
  }, [token, load]);

  useEffect(() => {
    const h = (e) => {
      setAchievementToast(e.detail);
      setTimeout(() => setAchievementToast(null), 5000);
    };
    window.addEventListener("achievement:new", h);
    return () => window.removeEventListener("achievement:new", h);
  }, []);

  // Listen Together effects
  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { listenRoomRef.current = listenRoom; }, [listenRoom]);
  useEffect(() => Player.subscribe(setPlayerState), []);

  useEffect(() => {
    if (!token) return;
    // Веб-пуш (браузер)
    if ("serviceWorker" in navigator && "PushManager" in window) {
      (async () => {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
          const { publicKey } = await api("/push/vapid-public", { token });
          const raw = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
          const uint8 = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: uint8 });
          await api("/push/subscribe", { method: "POST", token, body: sub.toJSON() });
        } catch {}
      })();
    }
    // FCM (нативное приложение)
    registerFcmToken(token);
  }, [token]);

  useEffect(() => {
    const h = () => setShowListenModal(true);
    window.addEventListener("listen:open-modal", h);
    return () => window.removeEventListener("listen:open-modal", h);
  }, []);

  useEffect(() => {
    const h = (e) => {
      const code = e.detail?.code;
      if (!code || !token) return;
      joinListenRoom(code);
      setShowListenModal(true);
    };
    window.addEventListener("listen:join-request", h);
    return () => window.removeEventListener("listen:join-request", h);
  }, [token]);

  // Host: sync Player state → broadcast to room
  useEffect(() => {
    const isHost = listenRoom?.room?.hostId === me?.id;
    if (!listenRoom || !isHost) { listenHostPrevRef.current = { trackId: null, playing: null }; return; }

    const initState = Player.getState();
    listenHostPrevRef.current = { trackId: initState.current?.id ?? null, playing: initState.playing };

    const unsub = Player.subscribe((state) => {
      const prev = listenHostPrevRef.current;
      const trackId = state.current?.id ?? null;
      const trackChanged = trackId !== prev.trackId && !!state.current;
      const playingChanged = state.playing !== prev.playing;

      if (trackChanged) {
        const tr = state.current;
        window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:track", track: { id: tr.id, title: tr.title, artist: tr.artist, src: tr.src, coverUrl: tr.coverUrl, duration: tr.duration } } }));
        listenHostPrevRef.current.trackId = trackId;
      } else if (playingChanged && prev.trackId !== null) {
        if (state.playing) {
          window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:play", position: state.currentTime } }));
        } else {
          window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:pause" } }));
        }
      }
      listenHostPrevRef.current.playing = state.playing;
      if (!trackChanged && trackId) listenHostPrevRef.current.trackId = trackId;
    });

    // Periodic position sync so guests stay in sync
    const syncTick = setInterval(() => {
      const s = Player.getState();
      if (s.playing) window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:seek", position: s.currentTime } }));
    }, 4000);

    return () => { unsub(); clearInterval(syncTick); };
  }, [listenRoom?.room?.hostId, me?.id]);

  const prevSessionRef = useRef(null);
  const [addingAccount, setAddingAccount] = useState(false);
  const [reloginHandle, setReloginHandle] = useState(null);

  const onAuth = (data) => {
    // Capture locale chosen on auth screen BEFORE overwriting settings
    // settings.language is only non-undefined if user explicitly clicked a language button
    const authScreenLang = settings.language;
    localStorage.setItem("xalle.session", JSON.stringify(data));
    setSession(data);
    prevSessionRef.current = null;
    setAddingAccount(false);
    setReloginHandle(null);
    const merged = { ...DEFAULT_SETTINGS, ...(data.user?.settings || {}) };
    if (authScreenLang) merged.language = authScreenLang; // explicit auth-screen choice wins
    setSettings(merged);
    saveAccount(data);
  };
  const logout = () => { localStorage.removeItem("xalle.session"); setSession(null); setSettings(DEFAULT_SETTINGS); };

  useEffect(() => {
    if (!token) return;
    const h = (e) => { fetch(`/api/tracks/${e.detail.id}/play`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {}); };
    window.addEventListener("music:play", h);
    return () => window.removeEventListener("music:play", h);
  }, [token]);

  // Browser tab: show unread count in title
  useEffect(() => {
    const total = (dmUnread || 0) + (notifUnread || 0);
    document.title = total > 0 ? `(${total}) Xalle` : "Xalle";
  }, [dmUnread, notifUnread]);

  const triggerRelogin = (acc) => {
    prevSessionRef.current = session;
    setReloginHandle(acc.handle);
    setAddingAccount(true);
    logout();
  };

  const switchAccount = async (acc) => {
    if (acc.expired) { triggerRelogin(acc); return; }
    try {
      const res = await fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${acc.token}` } });
      if (!res.ok) { markAccountExpired(acc.userId); triggerRelogin(acc); return; }
      const u = await res.json();
      markAccountValid(acc.userId);
      const newSession = { token: acc.token, user: { id: acc.userId, handle: acc.handle, name: u.name || acc.name, avatar_url: u.avatar_url || acc.avatarUrl } };
      localStorage.setItem("xalle.session", JSON.stringify(newSession));
      setSession(newSession);
      setSettings(u.settings ? { ...DEFAULT_SETTINGS, ...u.settings } : DEFAULT_SETTINGS);
    } catch {
      // Network error — switch optimistically
      const newSession = { token: acc.token, user: { id: acc.userId, handle: acc.handle, name: acc.name, avatar_url: acc.avatarUrl } };
      localStorage.setItem("xalle.session", JSON.stringify(newSession));
      setSession(newSession);
      setSettings(DEFAULT_SETTINGS);
    }
  };
  const handleSettingsLogout = (action) => {
    if (action === "add") {
      prevSessionRef.current = session;
      setAddingAccount(true);
      logout();
    } else {
      prevSessionRef.current = null;
      logout();
    }
  };
  const cancelAddAccount = () => {
    const prev = prevSessionRef.current;
    prevSessionRef.current = null;
    setAddingAccount(false);
    setReloginHandle(null);
    if (prev) {
      localStorage.setItem("xalle.session", JSON.stringify(prev));
      setSession(prev);
    }
  };

  // Listen Together callbacks
  const createListenRoom = async () => {
    try {
      const playerCur = Player.getState().current;
      const trackPayload = playerCur ? {
        id: playerCur.id, src: playerCur.src, title: playerCur.title,
        artist: playerCur.artist, coverUrl: playerCur.coverUrl, duration: playerCur.duration,
      } : null;
      const { code } = await api("/listen/rooms", { method: "POST", token, body: { trackId: playerCur?.id || null, track: trackPayload } });
      setListenRoom({ code, room: null, chat: [] });
      window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:join", code } }));
    } catch { toast(t("listen.create.error"), { type: "error" }); }
  };

  const joinListenRoom = (code) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setListenRoom({ code: c, room: null, chat: [] });
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:join", code: c } }));
  };

  const leaveListenRoom = () => {
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:leave" } }));
    setListenRoom(null);
    setShowListenModal(false);
  };

  const sendListenChat = (text) => {
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:chat", text } }));
  };

  const kickFromRoom = (userId) => {
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:kick", userId } }));
  };

  const banFromRoom = (userId) => {
    window.dispatchEvent(new CustomEvent("app:ws:send", { detail: { type: "listen:ban", userId } }));
  };

  const onTag = (tag) => { setQuery(tag); navigateTo("feed"); };
  const onMention = (handle) => { setProfileHandle(handle); };
  const onOpenPost = (postId, commentId) => {
    const found = posts.find((p) => p.id === postId || p.repost_of === postId || p.original?.id === postId);
    const target = found && found.original && found.original.id === postId ? found.original : found;
    if (target) { setFocusPost({ ...target, _focusComment: commentId || null }); }
    else { api(`/posts`, { token }).then((all) => { const f = all.find((p) => p.id === postId); if (f) setFocusPost({ ...f, _focusComment: commentId || null }); }).catch(() => {}); }
  };

  // ── Biometric app lock (Capacitor only) ──────────────────────
  useEffect(() => {
    if (!IS_CAPACITOR || !token) return;
    let listener;
    import("@capacitor/app").then(({ App: CapApp }) => {
      CapApp.addListener("appStateChange", async ({ isActive }) => {
        if (!isActive) {
          backgroundedAtRef.current = Date.now();
        } else {
          const elapsed = backgroundedAtRef.current ? Date.now() - backgroundedAtRef.current : 0;
          if (settings.biometricLock && elapsed > 15000) {
            const available = await checkBiometryAvailable();
            if (available) setBiometricLocked(true);
          }
        }
      }).then(h => { listener = h; });
    }).catch(() => {});
    return () => { listener?.remove?.(); };
  }, [token, settings.biometricLock]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const listenCode = params.get("listen");
    if (!listenCode) return;
    history.replaceState({}, "", window.location.pathname);
    joinListenRoom(listenCode);
    setShowListenModal(true);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const pHandle = params.get("profile");
    if (!pHandle) return;
    history.replaceState({}, "", window.location.pathname);
    setProfileHandle(pHandle);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const groupToken = params.get("group");
    if (!groupToken) return;
    history.replaceState({}, "", window.location.pathname);
    navigateTo("messages");
    window.dispatchEvent(new CustomEvent("messages:open-group-invite", { detail: { token: groupToken } }));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const postId = params.get("post");
    if (!postId) return;
    history.replaceState({}, "", window.location.pathname);
    const id = Number(postId);
    if (!id) return;
    const found = posts.find(p => p.id === id);
    if (found) {
      setFocusPost({ ...found, _highlight: true });
    } else {
      api("/posts", { token }).then(all => {
        const f = all.find(p => p.id === id);
        if (f) setFocusPost({ ...f, _highlight: true });
      }).catch(() => {});
    }
  }, [token]);

  // Deep link: ?playlist=SHARE_TOKEN
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const playlistToken = params.get("playlist");
    if (!playlistToken) return;
    history.replaceState({}, "", window.location.pathname);
    navigateTo("music");
    // Delay so MusicView mounts and registers its event listener before dispatch
    setTimeout(() => window.dispatchEvent(new CustomEvent("music:open-playlist", { detail: { token: playlistToken } })), 200);
  }, [token]);

  // Deep link: ?track=SHARE_TOKEN
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const trackToken = params.get("track");
    if (!trackToken) return;
    history.replaceState({}, "", window.location.pathname);
    navigateTo("music");
    setTimeout(() => window.dispatchEvent(new CustomEvent("music:open-track", { detail: { token: trackToken } })), 200);
  }, [token]);

  useEffect(() => {
    const h = () => { localStorage.removeItem("xalle.session"); setSession(null); };
    window.addEventListener("xalle:session-revoked", h);
    return () => window.removeEventListener("xalle:session-revoked", h);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (view !== "feed") return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  if (!session) return (
    <>
      <Auth onAuth={onAuth} onShowDoc={setDoc} onCancel={addingAccount ? cancelAddAccount : undefined} initialHandle={reloginHandle} />
      {doc && <DocModal doc={doc} onClose={() => setDoc(null)} />}
    </>
  );

  const mineP = (posts || []).filter((p) => p.handle === me.handle);
  const sumReacts = (arr) => arr.reduce((s, p) => s + Object.values(p.reactions?.counts || {}).reduce((a, b) => a + b, 0), 0);
  const viewsGot = mineP.reduce((s, p) => s + (p.views || 0), 0);
  const commentsGot = mineP.reduce((s, p) => s + (p.comments || 0), 0);

  if (biometricLocked) return (
    <BiometricLock
      onUnlock={() => setBiometricLocked(false)}
      onLogout={() => { setBiometricLocked(false); logout(); }}
    />
  );

  return (
    <div className={`layout ${view === "messages" ? "layout-dm" : ""}`}>
      <Sidebar view={view} setView={(v) => { if (v === "settings") { setShowSettings(true); return; } navigateTo(v); if (v === "messages") setDmUnread(0); }} liveConn={liveConn} online={online} onLogout={logout} token={token} notifBump={notifBump} onNotifRead={() => setNotifUnread(0)} onOpenPost={onOpenPost} menuStyle="text-icons" onShowDoc={setDoc} isMod={me?.role === "moderator"} pendingReports={pendingReports} openFeedback={openFeedback} onFeedback={() => setShowFeedback(true)} onGoCollabs={(postId) => { navigateTo("collabs"); setHighlightCollab(postId); setTimeout(() => setHighlightCollab(null), 2500); }} onShowChangelog={() => setShowChangelog(true)} currentVersion={currentVersion} dmUnread={dmUnread} me={me} accounts={getAccounts()} onSwitchAccount={switchAccount} onAddAccount={() => handleSettingsLogout("add")} safeMode={settings.safeMode} onVoiceCall={() => setShowVoiceDialog(true)} voiceCallActive={voiceCall.active} />

      <main className={`wrap ${view === "messages" ? "wrap-messages" : ""}`} style={view === "messages" ? { maxWidth: "100%", padding: 0, overflow: "hidden" } : {}}>
        <div className={`view-swap ${view}`}>
          {view === "feed" && (
            <div className="screen" key="feed">
              <Composer token={token} onPosted={setPosts} onShowHelp={() => setShowHelp(true)} onTag={onTag} onMention={onMention} onCollabCreated={() => { setCollabsBump((n) => n + 1); navigateTo("collabs"); }} />

              <div className="feed-tabs">
                <button className={feedScope === "world" ? "on" : ""} onClick={() => setFeedScope("world")}>{t("app.feed.world")}</button>
                <button className={feedScope === "following" ? "on" : ""} onClick={() => setFeedScope("following")}>{t("app.feed.following")}</button>
                <button className={feedScope === "recommendations" ? "on" : ""} onClick={() => setFeedScope("recommendations")}>{t("app.feed.recommendations")}</button>
              </div>

              {feedScope !== "recommendations" && (
                <div className="search-bar card">
                  <span className="search-ico">⌕</span>
                  <input ref={searchRef} placeholder={t("app.search.placeholder")} value={query} onChange={(e) => setQuery(e.target.value)} />
                  <button className={`filter-btn ${showFilters ? "on" : ""}`} onClick={() => setShowFilters((v) => !v)} title={t("app.filters.btn")}><SlidersHorizontal size={14} /></button>
                  {query && <button className="search-clear" onClick={() => setQuery("")}>✕</button>}
                </div>
              )}

              {showFilters && feedScope !== "recommendations" && (
                <div className="filters card pop-in">
                  <div className="filters-head">
                    <span className="fh-ico"><SlidersHorizontal size={14} /></span>
                    <span className="fh-title">{t("app.filters.title")}</span>
                  </div>
                  <div className="filters-body">
                    <div className="filter-grid">
                      <div className="filter-field">
                        <label>{t("app.filters.from")}</label>
                        <input placeholder={t("app.filters.from.placeholder")} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
                      </div>
                      <div className="filter-field">
                        <label>{t("app.filters.mentions")}</label>
                        <input placeholder={t("app.filters.mentions.placeholder")} value={filters.mentions} onChange={(e) => setFilters((f) => ({ ...f, mentions: e.target.value }))} />
                      </div>
                    </div>
                    <div className="filter-field filter-sort">
                      <label>{t("app.filters.sort")}</label>
                      <div className="seg">
                        <button className={filters.sort === "desc" ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, sort: "desc" }))}>{t("app.filters.sort.new")}</button>
                        <button className={filters.sort === "asc" ? "on" : ""} onClick={() => setFilters((f) => ({ ...f, sort: "asc" }))}>{t("app.filters.sort.old")}</button>
                      </div>
                    </div>
                    {(filters.from || filters.mentions || filters.sort !== "desc") && (
                      <button className="btn ghost filters-reset" onClick={() => setFilters({ from: "", mentions: "", sort: "desc" })}>{t("app.filters.reset")}</button>
                    )}
                  </div>
                </div>
              )}

              <div className="feed">
                {loading ? (
                  <>{[0, 1, 2].map((i) => (
                    <div className="post card skeleton" key={i}>
                      <div className="sk-head"><div className="sk-av" /><div className="sk-lines"><div className="sk-line w40" /><div className="sk-line w20" /></div></div>
                      <div className="sk-line w90" /><div className="sk-line w70" />
                    </div>
                  ))}</>
                ) : (posts || []).length === 0 || feedScope === "recommendations" ? (
                  <div className="empty">{
                    query ? t("app.feed.empty.query", { query })
                    : feedScope === "following" ? t("app.feed.empty.following")
                    : feedScope === "recommendations" ? t("app.feed.empty.recommendations") : t("app.feed.empty")
                  }</div>
                ) : (posts || []).map((p) => (<Post key={p.id} post={p} token={token} me={me} onChange={setPosts} commentBump={commentBump} settings={settings} onTag={onTag} onMention={onMention} onOpenOriginal={setFocusPost} />))}
              </div>
            </div>
          )}

          {view === "profile" && (
            <div className="screen" key="profile">
              <section className="profile card">
                <div className="cover" />
                <div className="pbody">
                  <div className="avatar big">{initials(me.name)}</div>
                  <div className="profile-userName"><Name name={me.name} verified={me.verified} role={me.role} /></div>
                  <div className="phandle">@{me.handle}</div>
                  {me.created_at && <div className="joined">{t("app.profile.joined", { date: fullDate(me.created_at) })}</div>}
                  {me.streak?.streak_days > 0 && (
                    <div className="profile-streak">
                      <span className="streak-flame-lg">🔥</span>
                      <span className="streak-info">
                        <b>{me.streak.streak_days}</b> {streakDayWord(me.streak.streak_days, t)} {t("app.streak.label")}
                        {me.streak.streak_best > me.streak.streak_days && (
                          <span className="streak-best"> {t("app.streak.best", { n: me.streak.streak_best })}</span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="stats">
                    <div><b>{mineP.length}</b><span>{t("app.profile.posts")}</span></div>
                    <div><b>{sumReacts(mineP)}</b><span>{t("app.profile.reactions")}</span></div>
                    <div><b>{commentsGot}</b><span>{t("app.profile.comments")}</span></div>
                    {settings.showViews && <div><b>{viewsGot}</b><span>{t("app.profile.views")}</span></div>}
                  </div>
                </div>
              </section>
              <div className="section-label">{t("app.profile.my.posts")}</div>
              <div className="feed">
                {mineP.length === 0 ? (<div className="empty">{t("app.profile.my.empty")}</div>)
                  : mineP.map((p) => (<Post key={p.id} post={p} token={token} me={me} onChange={setPosts} commentBump={commentBump} settings={settings} onTag={onTag} onMention={onMention} onOpenOriginal={setFocusPost} />))}
              </div>
            </div>
          )}

          {view === "plus" && <XallePlus me={me} token={token} onMeUpdate={(patch) => setSession(s => ({ ...s, user: { ...s.user, ...patch } }))} />}
          {view === "reports" && me?.role === "moderator" && <ReportsPanel token={token} onOpenPost={onOpenPost} onPendingChange={setPendingReports} />}
          {view === "feedback" && me?.role === "moderator" && <FeedbackPanel token={token} onOpenChange={setOpenFeedback} />}
          {view === "collabs" && <CollabPanel token={token} me={me} bump={collabsBump} onTag={onTag} onMention={onMention} highlightId={highlightCollab} />}
          {view === "dates" && <Planner token={token} />}
          {view === "music" && <MusicView token={token} me={me} />}
          {view === "messages" && <Messages token={token} myId={me?.id} me={me} initialHandle={dmInitHandle} onBack={() => navigateTo("feed")} safeMode={settings.safeMode} chatEnterSend={settings.chatEnterSend !== false} voiceCall={voiceCall} />}
          {view === "memorialdates" && <MemorableDates token={token} onMention={onMention} onGoFeed={() => navigateTo("feed")} />}
          {view === "modpanel" && me?.role === "moderator" && <ModPanelPage token={token} />}
          {view === "fullprofile" && fullProfileHandle && (
            <FullProfile
              handle={fullProfileHandle}
              token={token}
              me={me}
              onClose={() => { navigateTo("feed"); setFullProfileHandle(null); }}
              onOpenUser={(h) => setFullProfileHandle(h)}
              onTag={onTag}
              onMention={onMention}
              onOpenPost={(post) => { setFocusPost(post); }}
            />
          )}
        </div>
      </main>

      <MusicPlayer onOpenLibrary={() => navigateTo("music")} token={token}
        onLikeChange={(id, liked, track) => { window.dispatchEvent(new CustomEvent("music:like-change", { detail: { id, liked, track } })); }}
        isListenGuest={!!(listenRoom && listenRoom.room !== null && listenRoom.room?.hostId !== session?.user?.id)} />
      {showHelp && <MarkdownHelp onClose={() => setShowHelp(false)} />}
      {doc && <DocModal doc={doc} onClose={() => setDoc(null)} />}
      {showChangelog && <Changelog onClose={() => setShowChangelog(false)} />}
      {showFeedback && <FeedbackModal token={token} onClose={() => setShowFeedback(false)} />}
      {buildUpdateInfo && (
        <UpdateNotification
          critical={buildUpdateInfo.critical}
          message={buildUpdateInfo.message}
          changelog={buildUpdateInfo.changelog}
          onClose={() => setBuildUpdateInfo(null)}
        />
      )}
      <SubscriptionExpiryWatcher me={me} token={token} setSession={setSession} />
      {achievementToast && (
        <div className="ach-toast pop-in" onClick={() => setAchievementToast(null)}>
          <div className="ach-toast-emoji">{achievementToast.emoji || "✦"}</div>
          <div className="ach-toast-body">
            <div className="ach-toast-title">{t("app.achievement.title")}</div>
            <div className="ach-toast-name">{achievementToast.label || achievementToast.achievementType}</div>
          </div>
        </div>
      )}
      {view !== "messages" && settings?.notifs?.dmNotif !== false && (
        <DmNotification token={token} toastPos={settings.toastPos || "br"}
          onOpen={(conv) => { setDmInitHandle(conv?.other_handle || null); navigateTo("messages"); }} />
      )}
      {profileHandle && <UserProfile handle={profileHandle} token={token} me={me} onClose={() => setProfileHandle(null)} onOpenUser={setProfileHandle} onTag={onTag} onMention={onMention} onOpenFullProfile={(h) => { setFullProfileHandle(h); navigateTo("fullprofile"); setProfileHandle(null); }} onOpenModPanel={(h) => { navigateTo("modpanel"); setProfileHandle(null); setTimeout(() => window.dispatchEvent(new CustomEvent("modpanel:open", { detail: h })), 100); }} onOpenPost={(post) => { setFocusPost(post); setProfileHandle(null); }} />}
      <MentionHover token={token} onOpenUser={setProfileHandle} onMention={onMention} />
      {(settings.menuPos === "top" || settings.menuPos === "bottom") && (
        <footer className="page-footer">
          <div className="foot-links-row">
            <button onClick={() => setDoc("privacy")}>{t("app.footer.privacy")}</button>
            <button onClick={() => setDoc("terms")}>{t("app.footer.terms")}</button>
            <button onClick={() => setDoc("about")}>{t("app.footer.about")}</button>
          </div>
          <div className="foot-copy">{t("app.footer.copy")}</div>
        </footer>
      )}
      {focusPost && (
        <div className="modal-overlay focus-overlay fade-in" onClick={() => setFocusPost(null)}>
          <div className="modal focus-modal pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{focusPost._highlight ? t("app.post.link.title") : t("app.post.original.title")}</h3>
              <button className="btn ghost" onClick={() => setFocusPost(null)}>✕</button>
            </div>
            <div className={focusPost._highlight ? "post-link-highlight" : ""}>
              <Post post={focusPost} token={token} me={me} onChange={() => { setFocusPost(null); load(); }} commentBump={commentBump} settings={settings} focusComment={focusPost._focusComment} onTag={(tag) => { setFocusPost(null); onTag(tag); }} onMention={(h) => { setFocusPost(null); onMention(h); }} />
            </div>
          </div>
        </div>
      )}
      <Tip content={t("app.scroll.top")} pos="left">
        <button className={`scroll-top ${showTop ? "show" : ""}`} onClick={scrollTop} aria-label={t("app.scroll.top")}>↑</button>
      </Tip>

      {showSettings && (
        <div className="settings-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="settings-modal-inner">
            <button className="settings-modal-close" onClick={() => setShowSettings(false)} aria-label={t("common.close")}><X size={16} /></button>
            <Settings settings={settings} setSettings={setSettings} token={token} me={me}
              onMeUpdate={(patch) => setSession(s => ({ ...s, user: { ...s.user, ...patch } }))}
              onSwitch={switchAccount} onLogout={(mode) => { setShowSettings(false); handleSettingsLogout(mode); }}
              isMobile={isMobile}
              otherDeviceSettings={otherDeviceSettings}
              onSyncFromOther={() => { if (otherDeviceSettings) setSettings(s => ({ ...s, ...otherDeviceSettings })); }}
              onSyncToOther={() => setOtherDeviceSettings({ ...settings })} />
          </div>
        </div>
      )}
      <ListenRoom
        listenRoom={listenRoom}
        showModal={showListenModal}
        onOpenModal={() => setShowListenModal(true)}
        onCloseModal={() => setShowListenModal(false)}
        onLeave={leaveListenRoom}
        onCreateRoom={createListenRoom}
        onJoinRoom={joinListenRoom}
        onSendChat={sendListenChat}
        onKick={kickFromRoom}
        onBan={banFromRoom}
        token={token}
        me={me}
        playerState={playerState}
      />
      <VoiceCallWidget voiceCall={voiceCall} myUserId={me?.id} />
      <IncomingCallBanner voiceCall={voiceCall} />
      {showVoiceDialog && (
        <VoiceCallDialog voiceCall={voiceCall} onClose={() => setShowVoiceDialog(false)} />
      )}
    </div>
  );
}

const MOBILE_DEFAULTS = { toastPos: "top-center" };
const DESKTOP_DEFAULTS = { toastPos: "bottom-center", menuPos: "right" };

function isMobileDevice() {
  // Block real mobile browsers; allow desktop with narrow window
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export default function App() {
  const [isMobile] = useState(() => window.matchMedia("(max-width: 800px)").matches);

  // Mobile browsers → show wall, not the app
  if (!IS_CAPACITOR && isMobileDevice()) return <MobileWall />;
  const deviceKey = isMobile ? "_mobile" : "_desktop";
  const otherKey = isMobile ? "_desktop" : "_mobile";
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...(isMobile ? MOBILE_DEFAULTS : DESKTOP_DEFAULTS),
  }));
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [otherDeviceSettings, setOtherDeviceSettings] = useState(null);
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("xalle.session");
    return raw ? JSON.parse(raw) : null;
  });

  return (
    <I18nProvider
      language={settings.language}
      onLocaleChange={(code) => setSettings(s => ({ ...s, language: code }))}
    >
      <UIProvider toastPosition={settings.toastPos}>
        <AppInner
          settings={settings}
          setSettings={setSettings}
          settingsLoaded={settingsLoaded}
          setSettingsLoaded={setSettingsLoaded}
          session={session}
          setSession={setSession}
          isMobile={isMobile}
          otherDeviceSettings={otherDeviceSettings}
          setOtherDeviceSettings={setOtherDeviceSettings}
          deviceKey={deviceKey}
          otherKey={otherKey}
        />
      </UIProvider>
    </I18nProvider>
  );
}
