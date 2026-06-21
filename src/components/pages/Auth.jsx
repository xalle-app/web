import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api.js";
import { API_BASE, IS_CAPACITOR } from "../../lib/config.js";
import QrConfirm from "./QrConfirm.jsx";
import { startAuthentication } from "@simplewebauthn/browser";
import { useLocale } from "../../contexts/I18nContext.jsx";
import { QrCode, KeyRound, Smartphone, ArrowLeft } from "lucide-react";

async function passkeyLogin(handle, onAuth, setErr, t) {
  try {
    const opts = await api("/passkey/auth/options", { method: "POST", body: { handle } });
    const assertion = await startAuthentication({ optionsJSON: opts });
    const result = await api("/passkey/auth/verify", { method: "POST", body: { response: assertion } });
    onAuth(result);
  } catch (e) {
    if (e?.name === "NotAllowedError") return;
    setErr(e?.message || "PassKey error");
  }
}

function LangPicker() {
  const { locale, changeLocale, SUPPORTED_LOCALES, LOCALE_NAMES } = useLocale();
  return (
    <div className="auth-lang-picker">
      {SUPPORTED_LOCALES.map(code => (
        <button
          key={code}
          className={`auth-lang-btn ${locale === code ? "active" : ""}`}
          onClick={() => changeLocale(code)}
        >
          {LOCALE_NAMES[code]}
        </button>
      ))}
    </div>
  );
}

export default function Auth({ onAuth, onShowDoc, onCancel, initialHandle }) {
  const { t, locale } = useLocale();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ handle: initialHandle || "", name: "", password: "" });
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [stage, setStage] = useState("form"); // form | 2fa | email2fa | qr
  const [code, setCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrData, setQrData] = useState(null); // { token, qr, url }
  const [qrStatus, setQrStatus] = useState("pending"); // pending | scanned | confirmed | expired
  const pollRef = useRef(null);
  const [forgotIdent, setForgotIdent] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotPass, setForgotPass] = useState("");
  const [forgotPassConf, setForgotPassConf] = useState("");
  const [forgotDone, setForgotDone] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submitForgot = async () => {
    const id = forgotIdent.trim().replace(/^@/, "");
    if (!id) { setErr("Введи никнейм или email"); return; }
    setBusy(true); setErr("");
    try {
      await api("/auth/forgot-password", { method: "POST", body: id.includes("@") ? { email: id } : { handle: id } });
      setStage("forgot-code");
    } catch (e) { setErr(e.message || "Ошибка"); } finally { setBusy(false); }
  };

  const submitReset = async () => {
    if (forgotCode.length < 6) { setErr("Введи 6-значный код из письма"); return; }
    if (forgotPass.length < 6) { setErr("Пароль минимум 6 символов"); return; }
    if (forgotPass !== forgotPassConf) { setErr("Пароли не совпадают"); return; }
    const id = forgotIdent.trim().replace(/^@/, "");
    setBusy(true); setErr("");
    try {
      await api("/auth/reset-password", { method: "POST", body: id.includes("@") ? { email: id, code: forgotCode, password: forgotPass } : { handle: id, code: forgotCode, password: forgotPass } });
      setForgotDone(true);
    } catch (e) { setErr(e.message || "Ошибка сброса"); } finally { setBusy(false); }
  };

  // Check if opened via QR scan on mobile
  useEffect(() => {
    const hash = window.location.hash;
    const m = hash.match(/^#qr:(.+)$/);
    if (m) {
      window.history.replaceState(null, "", window.location.pathname);
      setStage("qr-confirm");
      setCode(m[1]);
    }
  }, []);

  const startQR = async () => {
    setBusy(true);
    try {
      const data = await api("/qr/init", { method: "POST" });
      setQrData(data);
      setQrStatus("pending");
      setStage("qr");
    } catch { setErr(t("auth.qrCantCreate")); }
    finally { setBusy(false); }
  };

  // Poll QR status
  useEffect(() => {
    if (stage !== "qr" || !qrData) return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await api(`/qr/status/${qrData.token}`);
        if (s.status === "confirmed" && s.sessionToken) {
          clearInterval(pollRef.current);
          const user = await api("/me", { token: s.sessionToken });
          onAuth({ token: s.sessionToken, user });
        } else if (s.status === "expired" || s.status === "denied") {
          clearInterval(pollRef.current);
          setQrStatus(s.status);
        } else {
          setQrStatus(s.status);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [stage, qrData]);

  const submit = async () => {
    setErr("");
    if (mode === "register" && (!agreePrivacy || !agreeTerms)) { setErr(t("auth.agreeRequired")); return; }
    setBusy(true);
    try {
      if (mode === "register") {
        onAuth(await api("/register", { method: "POST", body: { ...form, dataConsent: true, language: locale } }));
      } else {
        const body = { handle: form.handle, password: form.password, dataConsent: true };
        if (stage === "2fa") body.code = code;
        if (stage === "email2fa") body.emailCode = emailCode;
        const res = await fetch(`${API_BASE}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (res.status === 206 && data.need2fa) { setStage("2fa"); setBusy(false); return; }
        if (res.status === 206 && data.needEmail2fa) { setStage("email2fa"); setEmailHint(data.emailHint || ""); setBusy(false); return; }
        if (!res.ok) throw new Error(data.error || t("auth.login") + " error");
        onAuth(data);
      }
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // Mobile QR confirmation screen
  if (stage === "qr-confirm") {
    return <QrConfirm token={code} onAuth={onAuth} onShowDoc={onShowDoc} />;
  }

  return (
    <div className="auth-screen">
      <LangPicker />
      {onCancel && (
        <button className="auth-cancel-btn" onClick={onCancel}><ArrowLeft size={14} />{t("auth.cancel")}</button>
      )}
      <div className="auth card pop-in">
        <div className="brand">Xalle<span className="dot">.</span></div>
        <div className="tag">{t("auth.tagline")}</div>
        {initialHandle && <div className="auth-session-expired-notice">{t("auth.sessionExpiredNotice", { handle: initialHandle })}</div>}
        {err && <div className="err shake">{err}</div>}

        {stage === "forgot" ? (
          forgotDone ? (
            <div className="auth-success">
              <div className="auth-success-icon">✅</div>
              <p>Пароль успешно изменён</p>
              <button className="btn accent" onClick={() => { setStage("form"); setForgotDone(false); setForgotIdent(""); setForgotCode(""); setForgotPass(""); setForgotPassConf(""); setErr(""); }}>
                Войти
              </button>
            </div>
          ) : (
            <>
              <p className="auth-2fa-hint">Укажи никнейм или email — мы пришлём код сброса</p>
              <input autoFocus placeholder="@username или mail@example.com" value={forgotIdent} onChange={e => setForgotIdent(e.target.value)} onKeyDown={e => e.key === "Enter" && submitForgot()} />
              <button className="btn accent" onClick={submitForgot} disabled={busy}>{busy ? "Отправляем..." : "Отправить код"}</button>
              <div className="switch"><a onClick={() => { setStage("form"); setErr(""); }}>← Назад</a></div>
            </>
          )
        ) : stage === "forgot-code" ? (
          forgotDone ? (
            <div className="auth-success">
              <div className="auth-success-icon">✅</div>
              <p>Пароль успешно изменён</p>
              <button className="btn accent" onClick={() => { setStage("form"); setForgotDone(false); setForgotIdent(""); setForgotCode(""); setForgotPass(""); setForgotPassConf(""); setErr(""); }}>
                Войти
              </button>
            </div>
          ) : (
            <>
              <p className="auth-2fa-hint">Введи 6-значный код из письма и новый пароль</p>
              <input autoFocus placeholder="000000" maxLength={6} value={forgotCode} onChange={e => setForgotCode(e.target.value.replace(/\D/g, ""))} />
              <input type="password" placeholder="Новый пароль (минимум 6 символов)" value={forgotPass} onChange={e => setForgotPass(e.target.value)} />
              <input type="password" placeholder="Повтори пароль" value={forgotPassConf} onChange={e => setForgotPassConf(e.target.value)} onKeyDown={e => e.key === "Enter" && submitReset()} />
              <button className="btn accent" onClick={submitReset} disabled={busy}>{busy ? "Сохраняем..." : "Сменить пароль"}</button>
              <div className="switch"><a onClick={() => { setStage("forgot"); setForgotCode(""); setErr(""); }}>← Назад</a></div>
            </>
          )
        ) : stage === "qr" ? (
          <div className="auth-qr">
            <div className="auth-qr-title">{t("auth.qrScan")}</div>
            <p className="auth-qr-hint">{t("auth.qrHint")}</p>
            {qrStatus === "expired" || qrStatus === "denied" ? (
              <div className="auth-qr-expired">
                <div>{qrStatus === "denied" ? t("auth.qrDenied") : t("auth.qrExpired")}</div>
                <button className="btn accent" onClick={startQR}>{t("auth.qrRefresh")}</button>
              </div>
            ) : (
              <>
                <div className="auth-qr-img-wrap">
                  {qrData?.qr && <img src={qrData.qr} className="auth-qr-img" alt="QR code" />}
                  {qrStatus === "scanned" && (
                    <div className="auth-qr-scanned-overlay">
                      <div className="auth-qr-scanned-ico"><Smartphone size={32} /></div>
                      <div>{t("auth.qrPending")}</div>
                    </div>
                  )}
                </div>
                <div className="auth-qr-status">
                  {qrStatus === "pending" && <span className="auth-qr-dot pending" />}
                  {qrStatus === "scanned" && <span className="auth-qr-dot scanned" />}
                  <span>{qrStatus === "scanned" ? t("auth.qrScanned") : t("auth.qrWaiting")}</span>
                </div>
              </>
            )}
            <div className="switch"><a onClick={() => { setStage("form"); setQrData(null); setErr(""); clearInterval(pollRef.current); }}>{t("auth.backToForm")}</a></div>
          </div>
        ) : stage === "2fa" ? (
          <>
            <p className="auth-2fa-hint">{t("auth.2faHint")}</p>
            <input autoFocus placeholder={t("auth.2faPlaceholder")} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            <button className="btn accent" onClick={submit} disabled={busy}>{busy ? t("auth.checking") : t("common.confirm")}</button>
            <div className="switch"><a onClick={() => { setStage("form"); setCode(""); setErr(""); }}>{t("auth.back")}</a></div>
          </>
        ) : stage === "email2fa" ? (
          <>
            <p className="auth-2fa-hint">{t("auth.email2faHint", { hint: emailHint || t("auth.handle") })}</p>
            <input autoFocus placeholder={t("auth.email2faPlaceholder")} maxLength={6} value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && submit()} />
            <button className="btn accent" onClick={submit} disabled={busy || emailCode.length < 6}>{busy ? t("auth.checking") : t("auth.loginBtn")}</button>
            <div className="switch"><a onClick={() => { setStage("form"); setEmailCode(""); setErr(""); }}>{t("auth.back")}</a></div>
          </>
        ) : (
          <>
            {mode === "register" && <input placeholder={t("auth.namePlaceholder")} value={form.name} onChange={set("name")} />}
            <input placeholder={t("auth.handlePlaceholder")} value={form.handle} onChange={set("handle")} />
            <input type="password" placeholder={t("auth.passwordPlaceholder")} value={form.password} onChange={set("password")} onKeyDown={(e) => e.key === "Enter" && submit()} />
            {mode === "register" ? (
              <div className="consent-block">
                <button type="button" className={`consent-card ${agreePrivacy ? "on" : ""}`} onClick={() => setAgreePrivacy((v) => !v)}>
                  <span className="cc-check">{agreePrivacy ? "✓" : ""}</span>
                  <span className="cc-text">
                    {t("auth.agreePrivacy.prefix")}{" "}
                    <b className="cc-link" onClick={(e) => { e.stopPropagation(); onShowDoc?.("privacy"); }}>{t("auth.privacyPolicy")}</b>
                    {" "}{t("auth.agreePrivacy.suffix")}
                  </span>
                </button>
                <button type="button" className={`consent-card ${agreeTerms ? "on" : ""}`} onClick={() => setAgreeTerms((v) => !v)}>
                  <span className="cc-check">{agreeTerms ? "✓" : ""}</span>
                  <span className="cc-text">
                    {t("auth.agreeTerms.prefix")}{" "}
                    <b className="cc-link" onClick={(e) => { e.stopPropagation(); onShowDoc?.("terms"); }}>{t("auth.terms")}</b>
                    {" "}{t("auth.agreeTerms.suffix")}
                  </span>
                </button>
              </div>
            ) : null}
            <button className="btn accent" onClick={submit} disabled={busy}>{busy ? t("auth.loading") : mode === "login" ? t("auth.loginBtn") : t("auth.createAccountBtn")}</button>
            {mode === "login" && (
              <>
                <div className="auth-alt-btns">
                  <button className="btn ghost auth-qr-btn" onClick={startQR} disabled={busy}>
                    <QrCode size={15} /> {t("auth.qrCode")}
                  </button>
                  {!IS_CAPACITOR && (
                    <button className="btn ghost auth-pk-btn" onClick={() => passkeyLogin(form.handle, onAuth, setErr, t)} disabled={busy}>
                      <KeyRound size={15} /> PassKey
                    </button>
                  )}
                </div>
                <div className="switch" style={{ marginTop: 2 }}>
                  <a onClick={() => { setStage("forgot"); setForgotIdent(form.handle); setErr(""); }}>Забыли пароль?</a>
                </div>
              </>
            )}
            <div className="switch">
              {mode === "login" ? <>{t("auth.firstHere")} <a onClick={() => { setMode("register"); setErr(""); }}>{t("auth.createAccount")}</a></>
                : <>{t("auth.alreadyAccount")} <a onClick={() => { setMode("login"); setErr(""); }}>{t("auth.backToLogin")}</a></>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
