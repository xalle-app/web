import { useState, useEffect, useCallback, useRef } from "react";
import jsQR from "jsqr";
import { api } from "../../lib/api.js";
import { timeAgo } from "../../lib/format.js";
import { useToast, useConfirm } from "../shared/ui.jsx";
import { Eye, EyeOff, Monitor, Smartphone, MapPin, ShieldCheck, Cloud, Fingerprint, CheckCircle2, Mail, X, XCircle, Camera } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { useT } from "../../contexts/I18nContext.jsx";
import { IS_CAPACITOR } from "../../lib/config.js";

function maskEmail(email) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  const masked = local.slice(0, 2) + "*".repeat(Math.max(2, local.length - 2));
  const [dom, ...ext] = domain.split(".");
  return `${masked}@${dom[0]}${"*".repeat(dom.length - 1)}.${ext.join(".")}`;
}
function maskIp(ip) {
  if (!ip) return "—";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.***.${parts[2]}.*`;
  return ip.slice(0, 4) + "****";
}
function deviceIcon(device) {
  if (!device) return <Monitor size={18} />;
  if (/телефон|mobile|android|iphone/i.test(device)) return <Smartphone size={18} />;
  return <Monitor size={18} />;
}

function Sessions({ token }) {
  const t = useT();
  const [sessions, setSessions] = useState([]);
  const [revealed, setRevealed] = useState(new Set());
  const toast = useToast();
  const confirm = useConfirm();
  const load = useCallback(() => { api("/sessions", { token }).then(setSessions).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);

  const revoke = async (id) => {
    if (!(await confirm({ title: t("sec.session.revoke.title"), message: t("sec.session.revoke.msg"), danger: true, okText: t("sec.session.revoke.btn") }))) return;
    await api(`/sessions/${id}`, { method: "DELETE", token });
    toast(t("sec.session.revoked"), { type: "success" });
    load();
  };
  const revokeOthers = async () => {
    if (!(await confirm({ title: t("sec.session.revokeAll.title"), message: t("sec.session.revokeAll.msg"), danger: true, okText: t("sec.session.revokeAll.btn") }))) return;
    await api("/sessions/revoke-others", { method: "POST", token });
    toast(t("sec.session.revokedAll"), { type: "success" });
    load();
  };
  const toggleReveal = (id) => setRevealed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="card sec-sessions-card">
      <div className="sec-sessions-head">
        <div>
          <h3>{t("sec.sessions.title")}</h3>
          <p className="hint">{t("sec.sessions.hint")}</p>
        </div>
        {sessions.length > 1 && (
          <button className="btn ghost sec-revoke-all-btn" onClick={revokeOthers}>{t("sec.session.revokeAll.other")}</button>
        )}
      </div>
      <div className="sec-session-list">
        {sessions.map((s) => {
          const show = revealed.has(s.id);
          const loc = [s.city, s.country].filter(Boolean).join(", ") || null;
          const deviceLabel = [s.device, s.browser, s.os].filter(Boolean).join(" · ") || t("sec.session.device");
          return (
            <div key={s.id} className={`sec-session-item ${s.current ? "current" : ""}`}>
              <div className="sec-session-device-ico">{deviceIcon(s.device)}</div>
              <div className="sec-session-body">
                <div className="sec-session-top-row">
                  <span className="sec-session-device-label" title={deviceLabel}>{deviceLabel}</span>
                  {s.current && <span className="sec-session-badge">{t("sec.session.current")}</span>}
                </div>
                <div className="sec-session-meta-row">
                  {loc && <span className="sec-session-loc"><MapPin size={10} />{loc}</span>}
                  <span className="sec-session-ip-row">
                    <span>IP: {show ? (s.ip || "—") : maskIp(s.ip)}</span>
                    <button className="sec-reveal-btn" onClick={() => toggleReveal(s.id)}>
                      {show ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </span>
                  <span className="sec-session-time">{timeAgo(s.last_seen)}</span>
                </div>
              </div>
              {!s.current && (
                <button className="btn ghost sec-session-revoke" onClick={() => revoke(s.id)}>{t("sec.session.revoke.btn")}</button>
              )}
            </div>
          );
        })}
        {sessions.length === 0 && <div className="sec-empty">{t("sec.sessions.empty")}</div>}
      </div>
    </div>
  );
}

function TwoFA({ token, onChanged }) {
  const t = useT();
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const toast = useToast();
  const load = useCallback(() => { api("/2fa/status", { token }).then(setStatus).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);

  const begin = async () => { try { setSetup(await api("/2fa/setup", { method: "POST", token })); } catch (e) { toast(e.message, { type: "error" }); } };
  const enable = async () => {
    try {
      const r = await api("/2fa/enable", { method: "POST", token, body: { code } });
      setBackup(r.backupCodes); setSetup(null); setCode(""); load(); onChanged?.();
      toast(t("sec.twofa.enabled.toast"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };
  const disable = async () => {
    if (!disablePassword) return;
    try {
      await api("/2fa/disable", { method: "POST", token, body: { password: disablePassword } });
      setShowDisable(false); setDisablePassword(""); load(); onChanged?.();
      toast(t("sec.twofa.disabled.toast"), { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  return (
    <div className="card twofa-card2">
      {!setup && (
        <div className="sec-card-header">
          <div className={`sec-card-icon-wrap ${status?.enabled ? "sec-card-icon-on" : ""}`}>
            <ShieldCheck size={20} />
          </div>
          <div className="sec-card-info">
            <div className="sec-card-title">
              {t("sec.twofa.title")}
              {status?.enabled && <span className="twofa2-badge">{t("sec.twofa.active")}</span>}
            </div>
            <p className="sec-card-hint">{t("sec.twofa.hint")}</p>
          </div>
          <div className="sec-card-action">
            {status?.enabled ? (
              <CheckCircle2 size={20} className="sec-card-check" />
            ) : status !== null ? (
              <button className="btn accent sec-card-btn" onClick={begin}>{t("sec.twofa.setup.btn")}</button>
            ) : null}
          </div>
        </div>
      )}

      {status?.enabled ? (
        <div className="twofa2-enabled-block">
          <div className="twofa2-backup-row">
            <span className="twofa2-backup-label">{t("sec.twofa.backup.remaining")}</span>
            <span className="twofa2-backup-count">{status.backupRemaining}</span>
          </div>
          {showDisable ? (
            <div className="twofa-disable-form">
              <input type="password" placeholder={t("sec.twofa.disable.placeholder")}
                value={disablePassword} onChange={e => setDisablePassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && disable()} autoFocus />
              <div className="twofa-disable-btns">
                <button className="btn danger" onClick={disable} disabled={!disablePassword}>{t("common.confirm")}</button>
                <button className="btn ghost" onClick={() => { setShowDisable(false); setDisablePassword(""); }}>{t("common.cancel")}</button>
              </div>
            </div>
          ) : (
            <button className="btn ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => setShowDisable(true)}>{t("sec.twofa.disable.btn")}</button>
          )}
        </div>
      ) : setup ? (
        <div className="twofa-setup">
          <div className="twofa-step">
            <span className="step-num">1</span>
            <div className="step-body">
              <div className="step-title">{t("sec.twofa.step1.title")}</div>
              <div className="twofa-qr-frame"><img className="twofa-qr" src={setup.qr} alt="QR" /></div>
              <div className="twofa-secret">{t("sec.twofa.secret.hint")}<br /><code>{setup.secret}</code></div>
            </div>
          </div>
          <div className="twofa-step">
            <span className="step-num">2</span>
            <div className="step-body">
              <div className="step-title">{t("sec.twofa.step2.title")}</div>
              <div className="twofa-confirm">
                <input placeholder="000000" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
                <button className="btn accent" onClick={enable} disabled={code.length < 6}>{t("sec.twofa.enable.btn")}</button>
              </div>
            </div>
          </div>
          <button className="btn ghost" onClick={() => { setSetup(null); setCode(""); }}>{t("common.cancel")}</button>
        </div>
      ) : null}

      {backup && (
        <div className="backup-codes">
          <h4>{t("sec.twofa.backup.title")}</h4>
          <p className="sub">{t("sec.twofa.backup.hint")}</p>
          <div className="codes-grid">{backup.map((c) => <code key={c}>{c}</code>)}</div>
          <button className="btn accent" onClick={() => setBackup(null)}>{t("sec.twofa.backup.saved")}</button>
        </div>
      )}
    </div>
  );
}

function EmailVerification({ token }) {
  const t = useT();
  const [status, setStatus] = useState(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState("idle");
  const [showEmail, setShowEmail] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(() => {
    api("/email/status", { token }).then((s) => { setStatus(s); setEmail(s.email || ""); }).catch(() => {});
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const sendOtp = async () => {
    if (!email.trim()) return;
    try {
      await api("/email/send-otp", { method: "POST", token, body: { email: email.trim() } });
      setStage("sent"); setOtp("");
      toast(t("sec.email.otpSent"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };
  const verifyOtp = async () => {
    try {
      await api("/email/verify-otp", { method: "POST", token, body: { otp } });
      setStage("idle"); setOtp(""); load();
      toast(t("sec.email.verified.toast"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };
  const toggleEmail2fa = async () => {
    try {
      const r = await api("/email/2fa/toggle", { method: "POST", token });
      load(); toast(r.email2fa ? t("sec.email.2fa.on.toast") : t("sec.email.2fa.off.toast"), { type: "success" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };
  const removeEmail = async () => {
    if (!(await confirm({ title: t("sec.email.remove.title"), message: t("sec.email.remove.msg"), danger: true, okText: t("common.delete") }))) return;
    try { await api("/email", { method: "DELETE", token }); load(); toast(t("sec.email.removed.toast"), { type: "info" }); }
    catch (e) { toast(e.message, { type: "error" }); }
  };

  if (!status) return null;

  return (
    <div className="card ev-card">
      <div className="sec-card-header">
        <div className={`sec-card-icon-wrap ${status.verified ? "sec-card-icon-on" : ""}`}>
          <Mail size={20} />
        </div>
        <div className="sec-card-info">
          <div className="sec-card-title">
            {t("sec.email.title")}
            {status.verified && <span className="ev-verified-badge">{t("sec.email.verified.badge")}</span>}
          </div>
          <p className="sec-card-hint">{t("sec.email.desc")}</p>
        </div>
        {status.verified && <CheckCircle2 size={20} className="sec-card-check sec-card-action" />}
      </div>

      {status.email && status.verified ? (
        <div className="ev-verified-section">
          <div className="ev-email-row">
            <div className="ev-email-display">{showEmail ? status.email : maskEmail(status.email)}</div>
            <button className="sec-reveal-btn ev-eye-btn" title={showEmail ? t("sec.email.hide") : t("sec.email.show")} onClick={() => setShowEmail(v => !v)}>
              {showEmail ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>

          <div className="ev-2fa-toggle-row">
            <div className="ev-2fa-info">
              <div className="ev-2fa-label">{t("sec.email.2fa.label")}</div>
              <div className="ev-2fa-sub">{t("sec.email.2fa.sub")}</div>
            </div>
            <div className={`ev-toggle ${status.email2fa ? "on" : ""}`} onClick={toggleEmail2fa} role="switch" aria-checked={status.email2fa} />
          </div>

          <div className="ev-actions-row">
            <button className="btn ghost ev-action-btn" onClick={() => setStage("replace")}>{t("sec.email.change.btn")}</button>
            {!status.email2fa && <button className="btn ghost ev-action-btn" onClick={removeEmail}>{t("sec.email.remove.btn")}</button>}
          </div>

          {(stage === "replace" || stage === "replace-sent") && (
            <div className="ev-form-section">
              <div className="ev-form-label">{t("sec.email.new.label")}</div>
              <div className="ev-input-row">
                <input className="ev-input" placeholder="новый@email.com" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} disabled={stage === "replace-sent"} />
                {stage === "replace" && (
                  <button className="btn accent ev-send-btn" onClick={async () => {
                    try {
                      await api("/email/send-otp", { method: "POST", token, body: { email: email.trim() } });
                      setStage("replace-sent"); setOtp(""); toast(t("sec.email.otpSent"), { type: "success" });
                    } catch (e) { toast(e.message, { type: "error" }); }
                  }}>{t("sec.email.sendCode.btn")}</button>
                )}
              </div>
              {stage === "replace-sent" && (
                <div className="ev-otp-section">
                  <div className="ev-form-label">{t("sec.email.code.label")}</div>
                  <div className="ev-input-row">
                    <input className="ev-input ev-otp-input" autoFocus placeholder="000000" maxLength={6} value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={e => e.key === "Enter" && verifyOtp()} />
                    <button className="btn accent ev-send-btn" onClick={verifyOtp} disabled={otp.length < 6}>{t("common.confirm")}</button>
                  </div>
                </div>
              )}
              <button className="btn ghost" style={{ alignSelf: "flex-start", marginTop: 4 }}
                onClick={() => { setStage("idle"); setEmail(status.email || ""); }}>{t("common.cancel")}</button>
            </div>
          )}
        </div>
      ) : stage === "sent" ? (
        <div className="ev-form-section">
          <div className="ev-sent-hint">{t("sec.email.sentTo", { email })}</div>
          <div className="ev-form-label">{t("sec.email.code.label6")}</div>
          <div className="ev-input-row">
            <input className="ev-input ev-otp-input" autoFocus placeholder="000000" maxLength={6}
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && verifyOtp()} />
            <button className="btn accent ev-send-btn" onClick={verifyOtp} disabled={otp.length < 6}>{t("common.confirm")}</button>
          </div>
          <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setStage("idle")}>{t("common.back")}</button>
        </div>
      ) : (
        <div className="ev-form-section">
          <div className="ev-form-label">{t("sec.email.addr.label")}</div>
          <div className="ev-input-row">
            <input className="ev-input" type="email" placeholder="your@email.com" value={email}
              onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && sendOtp()} />
            <button className="btn accent ev-send-btn" onClick={sendOtp} disabled={!email.trim()}>{t("sec.email.sendCode.btn")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PassKeys({ token }) {
  const t = useT();
  const [keys, setKeys] = useState([]);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const toast = useToast();
  const confirm = useConfirm();
  const load = useCallback(() => { api("/passkey/list", { token }).then(setKeys).catch(() => {}); }, [token]);
  useEffect(() => { load(); }, [load]);

  const register = async () => {
    if (!window.PublicKeyCredential) { toast(t("sec.pk.unsupported"), { type: "error" }); return; }
    setBusy(true);
    try {
      const opts = await api("/passkey/register/options", { method: "POST", token });
      const regResponse = await startRegistration({ optionsJSON: opts });
      await api("/passkey/register/verify", { method: "POST", token, body: { ...regResponse, pkName: newName.trim() || null } });
      toast(t("sec.pk.added.toast"), { type: "success" });
      setNewName(""); setShowNameInput(false);
      load();
    } catch (e) {
      if (e?.name !== "NotAllowedError") toast(e?.message || t("sec.pk.error"), { type: "error" });
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!(await confirm({ title: t("sec.pk.remove.title"), message: t("sec.pk.remove.msg"), danger: true, okText: t("common.delete") }))) return;
    await api(`/passkey/${id}`, { method: "DELETE", token });
    toast(t("sec.pk.removed.toast"), { type: "info" });
    load();
  };

  const rename = async (id) => {
    await api(`/passkey/${id}`, { method: "PATCH", token, body: { name: renameVal.trim() || null } });
    setRenamingId(null);
    load();
  };

  const defaultName = (k) => `${k.device_type === "multiDevice" ? t("sec.pk.synced") : t("sec.pk.device")} PassKey`;

  if (IS_CAPACITOR) {
    return (
      <div className="card pk-card2">
        <div className="sec-card-header">
          <div className="sec-card-icon-wrap"><Fingerprint size={20} /></div>
          <div className="sec-card-info">
            <div className="sec-card-title">{t("sec.pk.title")}</div>
            <p className="sec-card-hint">{t("sec.pk.hint")}</p>
          </div>
        </div>
        <div className="pk2-empty">{t("sec.pk.browser_only")}</div>
      </div>
    );
  }

  return (
    <div className="card pk-card2">
      <div className="sec-card-header">
        <div className="sec-card-icon-wrap">
          <Fingerprint size={20} />
        </div>
        <div className="sec-card-info">
          <div className="sec-card-title">{t("sec.pk.title")}</div>
          <p className="sec-card-hint">{t("sec.pk.hint")}</p>
        </div>
        {!showNameInput && (
          <button className="btn accent sec-card-btn" onClick={() => setShowNameInput(true)}>
            {t("sec.pk.add.btn")}
          </button>
        )}
      </div>
      {keys.length > 0 && (
        <div className="pk2-list">
          {keys.map(k => (
            <div key={k.id} className="pk2-item">
              <div className="pk2-item-icon">
                {k.device_type === "multiDevice" ? <Cloud size={16} /> : <Smartphone size={16} />}
              </div>
              <div className="pk2-item-body">
                {renamingId === k.id ? (
                  <div className="pk-rename-row">
                    <input className="pk-rename-input" value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") rename(k.id); if (e.key === "Escape") setRenamingId(null); }}
                      autoFocus placeholder={defaultName(k)} />
                    <button className="btn accent" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => rename(k.id)}>OK</button>
                    <button className="btn ghost" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setRenamingId(null)}><X size={12} /></button>
                  </div>
                ) : (
                  <div className="pk2-item-name" onClick={() => { setRenamingId(k.id); setRenameVal(k.name || ""); }}
                    title={t("sec.pk.rename.hint")}>
                    {k.name || defaultName(k)} <span className="pk2-rename-hint">✎</span>
                  </div>
                )}
                <div className="pk2-item-meta">
                  {t("sec.pk.added.at", { date: k.created_at?.slice(0, 10) })}
                  {k.backed_up && <span className="pk2-cloud" title={t("sec.pk.synced.tooltip")}><Cloud size={12} /></span>}
                </div>
              </div>
              <button className="pk2-delete-btn" onClick={() => remove(k.id)} title={t("common.delete")}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {showNameInput && (
        <div className="pk2-add-form">
          <input className="pk2-name-input" placeholder={t("sec.pk.name.placeholder")} value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && register()} autoFocus />
          <div className="pk2-add-btns">
            <button className="btn ghost" onClick={() => { setShowNameInput(false); setNewName(""); }}>{t("common.cancel")}</button>
            <button className="btn accent" onClick={register} disabled={busy}>
              {busy ? t("sec.pk.registering") : t("sec.pk.register.btn")}
            </button>
          </div>
        </div>
      )}
      {keys.length === 0 && !showNameInput && (
        <div className="pk2-empty">{t("sec.pk.empty")}</div>
      )}
    </div>
  );
}

function QrLoginModal({ token, onClose }) {
  const t = useT();
  const [qrToken, setQrToken] = useState("");
  const [info, setInfo] = useState(null);
  const [stage, setStage] = useState("input");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [camErr, setCamErr] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (scanRef.current) { cancelAnimationFrame(scanRef.current); scanRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(tr => tr.stop()); streamRef.current = null; }
  }, []);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  const startCamera = async () => {
    setCamErr(""); setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setStage("scan");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          tick();
        }
      }, 100);
    } catch {
      setCamErr(t("sec.qr.cam.error"));
    }
  };

  const tick = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height);
      if (code?.data) {
        const m = code.data.match(/#qr:([a-zA-Z0-9_-]+)/);
        const tok = m ? m[1] : code.data.replace(/^.*#qr:/, "").trim();
        if (tok) { stopCamera(); doLookup(tok); return; }
      }
    }
    scanRef.current = requestAnimationFrame(tick);
  };

  const doLookup = async (tok) => {
    setBusy(true); setErr("");
    try {
      const data = await api(`/qr/info/${tok}`);
      setQrToken(tok);
      setInfo(data);
      setStage("confirm");
    } catch { setErr(t("sec.qr.invalid")); setStage("input"); }
    finally { setBusy(false); }
  };

  const lookup = () => {
    const tok = qrToken.trim();
    if (!tok) { setErr(t("sec.qr.token.error")); return; }
    const m = tok.match(/#qr:([a-zA-Z0-9_-]+)/);
    doLookup(m ? m[1] : tok);
  };

  const confirmQr = async () => {
    setBusy(true); setErr("");
    try {
      await api(`/qr/confirm/${qrToken}`, { method: "POST", token });
      setStage("done");
    } catch (e) { setErr(e.message || t("sec.qr.confirmError")); }
    finally { setBusy(false); }
  };

  const deny = async () => {
    await api(`/qr/deny/${qrToken}`, { method: "POST" }).catch(() => {});
    setStage("denied");
  };

  const headHint = stage === "scan" ? t("sec.qr.scan.head") : t("sec.qr.confirm.head");

  return (
    <div className="qr-login-modal-overlay" onClick={e => { if (e.target === e.currentTarget) { stopCamera(); onClose(); } }}>
      <div className="qr-login-modal card pop-in">
        <div className="qr-login-modal-head">
          <span className="qr-login-modal-ico">{stage === "scan" ? <Camera size={20} /> : <Smartphone size={20} />}</span>
          <div>
            <h3>{headHint}</h3>
            <p className="hint">{t("sec.qr.hint")}</p>
          </div>
          <button className="qr-login-close-btn" onClick={() => { stopCamera(); onClose(); }} aria-label={t("common.close")}><X size={16} /></button>
        </div>

        {stage === "input" && (
          <div className="qr-login-body">
            {camErr ? (
              <>
                <div className="err">{camErr}</div>
                <button className="btn accent" onClick={startCamera}>{t("sec.qr.retry")}</button>
              </>
            ) : (
              <div className="qr-login-starting">{t("sec.qr.starting")}</div>
            )}
            {err && <div className="err">{err}</div>}
            <button className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
          </div>
        )}

        {stage === "scan" && (
          <div className="qr-login-body qr-scan-body">
            <div className="qr-scan-viewport">
              <video ref={videoRef} className="qr-scan-video" playsInline muted autoPlay />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div className="qr-scan-frame" />
            </div>
            <p className="hint" style={{ textAlign: "center" }}>{t("sec.qr.scan.hint")}</p>
            <button className="btn ghost" onClick={() => { stopCamera(); setStage("input"); }}>{t("sec.qr.back")}</button>
          </div>
        )}

        {stage === "confirm" && info && (
          <div className="qr-login-body">
            <div className="qr-confirm-info">
              <div className="qr-confirm-info-title">{t("sec.qr.device.from")}</div>
              <div className="qr-confirm-device-row">
                <span className="qr-login-modal-ico"><Monitor size={18} /></span>
                <div>
                  <div className="qr-confirm-device-name">{info.device} · {info.browser}</div>
                  <div className="qr-confirm-device-os">{info.os} · IP: {info.ip || t("sec.qr.ip.hidden")}</div>
                </div>
              </div>
            </div>
            {err && <div className="err">{err}</div>}
            <button className="btn accent" onClick={confirmQr} disabled={busy}>{busy ? t("sec.qr.confirming") : t("sec.qr.allow")}</button>
            <button className="btn ghost" onClick={deny} disabled={busy} style={{ color: "var(--like)" }}>{t("sec.qr.deny")}</button>
          </div>
        )}

        {stage === "done" && (
          <div className="qr-login-body qr-login-result">
            <CheckCircle2 size={44} className="sec-card-check" />
            <div className="qr-result-title">{t("sec.qr.done.title")}</div>
            <p className="hint">{t("sec.qr.done.hint")}</p>
            <button className="btn accent" onClick={onClose}>{t("common.close")}</button>
          </div>
        )}

        {stage === "denied" && (
          <div className="qr-login-body qr-login-result">
            <XCircle size={44} style={{ color: "var(--like)" }} />
            <div className="qr-result-title">{t("sec.qr.denied.title")}</div>
            <p className="hint">{t("sec.qr.denied.hint")}</p>
            <button className="btn accent" onClick={onClose}>{t("common.close")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Security({ token, onChanged }) {
  const t = useT();
  const [showQrModal, setShowQrModal] = useState(false);
  return (
    <div className="sec-blocks-stack">
      <EmailVerification token={token} />
      <TwoFA token={token} onChanged={onChanged} />
      <PassKeys token={token} />
      <div className="card qr-login-card">
        <div className="qr-login-card-inner">
          <div className="qr-login-card-left">
            <div className="qr-login-card-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="18" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="14" y="18" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/></svg>
            </div>
            <div>
              <h3 className="qr-login-card-title">{t("sec.qr.card.title")}</h3>
              <p className="hint qr-login-card-hint">{t("sec.qr.card.hint")}</p>
            </div>
          </div>
          <button className="btn accent qr-login-open-btn" onClick={() => setShowQrModal(true)}>{t("sec.qr.card.btn")}</button>
        </div>
        {showQrModal && <QrLoginModal token={token} onClose={() => setShowQrModal(false)} />}
      </div>
      <Sessions token={token} />
    </div>
  );
}
