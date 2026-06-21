import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import { API_BASE } from "../../lib/config.js";

export default function QrConfirm({ token: qrToken, onAuth, onShowDoc }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // QrConfirm is shown when user is NOT logged in (scanned from Auth screen)
  // They need to log in first, then confirm
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ handle: "", password: "" });
  const [stage, setStage] = useState("info"); // info | login | confirmed | denied

  useEffect(() => {
    api(`/qr/info/${qrToken}`)
      .then(setInfo)
      .catch(() => setErr("QR-код недействителен или истёк"));
  }, [qrToken]);

  const loginAndConfirm = async () => {
    if (!form.handle || !form.password) { setErr("Введи ник и пароль"); return; }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: form.handle, password: form.password, dataConsent: true }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось войти");
      // Confirm QR with the fresh token
      await api(`/qr/confirm/${qrToken}`, { method: "POST", token: data.token });
      setStage("confirmed");
      // Log in on this device too if user wants
      onAuth?.(data);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const deny = async () => {
    await api(`/qr/deny/${qrToken}`, { method: "POST" }).catch(() => {});
    setStage("denied");
  };

  if (err && !info) {
    return (
      <div className="auth-screen">
        <div className="auth card pop-in">
          <div className="brand">Xalle<span className="dot">.</span></div>
          <div className="qr-confirm-err">{err}</div>
          <div className="switch"><a onClick={() => window.location.reload()}>← Назад</a></div>
        </div>
      </div>
    );
  }

  if (stage === "confirmed") {
    return (
      <div className="auth-screen">
        <div className="auth card pop-in">
          <div className="brand">Xalle<span className="dot">.</span></div>
          <div className="qr-confirm-done">
            <div className="qr-confirm-done-ico">✅</div>
            <div className="qr-confirm-done-title">Вход подтверждён!</div>
            <p>Устройство авторизовано. Можешь вернуться к компьютеру.</p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "denied") {
    return (
      <div className="auth-screen">
        <div className="auth card pop-in">
          <div className="brand">Xalle<span className="dot">.</span></div>
          <div className="qr-confirm-done">
            <div style={{ fontSize: 36 }}>🚫</div>
            <div className="qr-confirm-done-title">Вход отклонён</div>
            <p>Попытка входа с этого QR-кода заблокирована.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth card pop-in">
        <div className="brand">Xalle<span className="dot">.</span></div>
        <div className="tag">Подтверждение входа</div>

        {info && (
          <div className="qr-confirm-info">
            <div className="qr-confirm-info-title">Запрос входа с устройства:</div>
            <div className="qr-confirm-device-row">
              <span className="qr-confirm-device-ico">💻</span>
              <div>
                <div className="qr-confirm-device-name">{info.device} · {info.browser}</div>
                <div className="qr-confirm-device-os">{info.os} · IP: {info.ip || "скрыт"}</div>
              </div>
            </div>
          </div>
        )}

        {err && <div className="err shake">{err}</div>}

        <p className="auth-2fa-hint">Войди в аккаунт, чтобы авторизовать вход на другом устройстве.</p>
        <input placeholder="Ник" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} />
        <input type="password" placeholder="Пароль" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && loginAndConfirm()} />

        <button className="btn accent" onClick={loginAndConfirm} disabled={busy}>{busy ? "Проверяю…" : "Подтвердить вход"}</button>
        <button className="btn ghost" onClick={deny} disabled={busy}>Отклонить</button>
      </div>
    </div>
  );
}
