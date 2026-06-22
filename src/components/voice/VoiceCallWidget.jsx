import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, PhoneOff, ChevronDown, ChevronUp, Copy, Phone, PhoneIncoming, Monitor, MonitorOff, X, Maximize2, Minimize2 } from "lucide-react";
import { useT } from "../../contexts/I18nContext.jsx";
import { useToast } from "../shared/ui.jsx";
import { assetUrl } from "../../lib/config.js";

function MemberAvatar({ member, speaking, muted }) {
  const initials = (member?.name || "?")[0];
  return (
    <div className={`vc-member${speaking ? " vc-speaking" : ""}`}>
      {member?.avatar
        ? <img src={assetUrl(member.avatar)} className="vc-av" alt={member.name} />
        : <div className="vc-av vc-av-letter">{initials}</div>}
      {muted && <div className="vc-muted-icon"><MicOff size={9} /></div>}
      <div className="vc-member-name">{member?.name?.split(" ")[0] || "@" + member?.handle}</div>
    </div>
  );
}

// ── Join/Create dialog ─────────────────────────────────────────
export function VoiceCallDialog({ onClose, voiceCall }) {
  const t = useT();
  const [tab, setTab] = useState("create");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const doCreate = async () => {
    setLoading(true);
    const ok = await voiceCall.startCall();
    setLoading(false);
    if (ok) onClose();
  };

  const doJoin = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    const ok = await voiceCall.joinCall(c);
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <div className="vc-dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vc-dialog pop-in">
        <div className="vc-dialog-head">
          <Phone size={16} />
          <span>{t("vcall.dialog.title")}</span>
          <button className="vc-dialog-close" onClick={onClose}>✕</button>
        </div>
        <div className="vc-dialog-tabs">
          <button className={`vc-dialog-tab${tab === "create" ? " active" : ""}`} onClick={() => setTab("create")}>
            {t("vcall.dialog.create")}
          </button>
          <button className={`vc-dialog-tab${tab === "join" ? " active" : ""}`} onClick={() => setTab("join")}>
            {t("vcall.dialog.join")}
          </button>
        </div>
        {tab === "create" ? (
          <div className="vc-dialog-body">
            <p className="vc-dialog-hint">{t("vcall.dialog.create.hint")}</p>
            <button className="btn accent" style={{ width: "100%" }} onClick={doCreate} disabled={loading}>
              {loading ? t("common.loading") : t("vcall.dialog.create.btn")}
            </button>
          </div>
        ) : (
          <div className="vc-dialog-body">
            <input
              className="vc-dialog-input"
              placeholder={t("vcall.dialog.code.placeholder")}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && doJoin()}
              autoFocus
              maxLength={8}
            />
            <button className="btn accent" style={{ width: "100%", marginTop: 10 }}
              onClick={doJoin} disabled={loading || !code.trim()}>
              {loading ? t("common.loading") : t("vcall.dialog.join.btn")}
            </button>
          </div>
        )}
        {voiceCall.error && (
          <div className="vc-dialog-error">
            {voiceCall.error === "mic_denied" ? t("vcall.error.mic_denied")
              : voiceCall.error === "mic_unavailable" ? t("vcall.error.mic_unavailable")
              : voiceCall.error === "not_found" ? t("vcall.error.not_found")
              : voiceCall.error === "full" ? t("vcall.error.full")
              : t("vcall.error.generic")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable screen share PiP window ─────────────────────────
function ScreenSharePip({ stream, sharerName, onClose }) {
  const t = useT();
  const videoRef = useRef(null);
  const pipRef = useRef(null);
  const dragRef = useRef(null);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 420, y: 60 });

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  const onMouseDown = useCallback((e) => {
    if (fullscreen) return;
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    const onMove = (ev) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 340, ev.clientX - startX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - startY)),
      });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pos, fullscreen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && pipRef.current) {
      pipRef.current.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return createPortal(
    <div
      ref={pipRef}
      className={`vc-pip${minimized ? " vc-pip-mini" : ""}${fullscreen ? " vc-pip-fs" : ""}`}
      style={fullscreen ? undefined : { left: pos.x, top: pos.y }}
    >
      <div className="vc-pip-header" onMouseDown={onMouseDown}>
        <span className="vc-pip-label">
          <Monitor size={13} />
          <span>{sharerName || t("vcall.screen.someone")} — {t("vcall.screen.sharing")}</span>
        </span>
        <div className="vc-pip-controls" onMouseDown={e => e.stopPropagation()}>
          <button className="vc-pip-btn" onClick={() => setMinimized(v => !v)} title={minimized ? t("vcall.screen.expand") : t("vcall.screen.minimize")}>
            {minimized ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button className="vc-pip-btn" onClick={toggleFullscreen} title={fullscreen ? t("vcall.screen.exitFs") : t("vcall.screen.fullscreen")}>
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button className="vc-pip-btn vc-pip-close" onClick={onClose} title={t("vcall.screen.close")}>
            <X size={13} />
          </button>
        </div>
      </div>
      {!minimized && (
        <video ref={videoRef} className="vc-pip-video" autoPlay playsInline muted />
      )}
    </div>,
    document.body
  );
}

// ── Incoming call notification ─────────────────────────────────
export function IncomingCallBanner({ voiceCall }) {
  const t = useT();
  const { incomingCall, joinCall, declineIncomingCall } = voiceCall;
  if (!incomingCall) return null;

  const { callerName, callerAvatar, code } = incomingCall;

  const accept = async () => {
    await joinCall(code);
    declineIncomingCall();
  };

  return createPortal(
    <div className="vc-incoming">
      <div className="vc-incoming-avatar">
        {callerAvatar
          ? <img src={assetUrl(callerAvatar)} alt={callerName} />
          : <div className="vc-incoming-letter">{(callerName || "?")[0]}</div>}
        <div className="vc-incoming-ring" />
        <div className="vc-incoming-ring2" />
      </div>
      <div className="vc-incoming-info">
        <div className="vc-incoming-name">{callerName || t("vcall.incoming.unknown")}</div>
        <div className="vc-incoming-label"><Phone size={11} />{t("vcall.incoming.label")}</div>
      </div>
      <div className="vc-incoming-actions">
        <button className="vc-incoming-btn vc-incoming-accept" onClick={accept} title={t("vcall.incoming.accept")}>
          <Phone size={18} />
        </button>
        <button className="vc-incoming-btn vc-incoming-decline" onClick={declineIncomingCall} title={t("vcall.incoming.decline")}>
          <PhoneOff size={18} />
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Active call floating widget ────────────────────────────────
export function VoiceCallWidget({ voiceCall, myUserId }) {
  const t = useT();
  const toast = useToast();
  const [minimized, setMinimized] = useState(false);
  const [screenHidden, setScreenHidden] = useState(false);
  const {
    active, muted, speaking, callCode, members, peers, speakingMap,
    sharing, remoteSharingUserId, remoteScreenStream,
    leaveCall, toggleMute, startScreenShare, stopScreenShare,
  } = voiceCall;

  // Reset hidden state when a new sharer starts
  useEffect(() => {
    if (remoteSharingUserId) setScreenHidden(false);
  }, [remoteSharingUserId]);

  if (!active) return null;

  const copyCode = () => {
    navigator.clipboard?.writeText(callCode);
    toast(t("vcall.code.copied"), { type: "success" });
  };

  const myMember = members.find(m => m.id === myUserId);
  const sharingMember = remoteSharingUserId ? members.find(m => m.id === remoteSharingUserId) : null;

  return createPortal(
    <>
      {/* Floating PiP screen share window */}
      {remoteSharingUserId && !screenHidden && (
        <ScreenSharePip
          stream={remoteScreenStream?.current}
          sharerName={sharingMember?.name}
          onClose={() => setScreenHidden(true)}
        />
      )}

      {/* Pill to re-open hidden screen */}
      {remoteSharingUserId && screenHidden && (
        <button className="vc-screen-pill" onClick={() => setScreenHidden(false)}>
          <Monitor size={13} /> {t("vcall.screen.show")}
        </button>
      )}

      <div className={`vc-widget${minimized ? " vc-widget-mini" : ""}`}>
        <div className="vc-widget-head" onClick={() => setMinimized(v => !v)}>
          <div className="vc-widget-title">
            <span className="vc-live-dot" />
            <span>{t("vcall.widget.title")}</span>
            {callCode && (
              <button className="vc-code-btn" onClick={e => { e.stopPropagation(); copyCode(); }}>
                {callCode} <Copy size={10} />
              </button>
            )}
          </div>
          <button className="vc-widget-toggle">
            {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {!minimized && (
          <>
            <div className="vc-widget-members">
              {myMember && <MemberAvatar member={myMember} speaking={speaking} muted={muted} />}
              {(Array.isArray(peers) ? peers : []).filter(id => id !== myUserId).map(uid => {
                const member = members.find(m => m.id === uid);
                return member ? (
                  <MemberAvatar key={uid} member={member} speaking={speakingMap?.get(uid)} muted={false} />
                ) : null;
              })}
            </div>

            {sharing && (
              <div className="vc-sharing-bar">
                <Monitor size={12} /> {t("vcall.screen.youSharing")}
              </div>
            )}

            <div className="vc-widget-actions">
              <button className={`vc-btn${muted ? " vc-btn-muted" : ""}`} onClick={toggleMute} title={muted ? t("vcall.unmute") : t("vcall.mute")}>
                {muted ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
              <button
                className={`vc-btn${sharing ? " vc-btn-sharing" : ""}`}
                onClick={sharing ? stopScreenShare : startScreenShare}
                title={sharing ? t("vcall.screen.stop") : t("vcall.screen.share")}
              >
                {sharing ? <MonitorOff size={15} /> : <Monitor size={15} />}
              </button>
              <button className="vc-btn vc-btn-leave" onClick={leaveCall} title={t("vcall.leave")}>
                <PhoneOff size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}
