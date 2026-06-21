import { useState, useEffect, useCallback } from "react";
import { Fingerprint, LogOut } from "lucide-react";
import { authenticate } from "../../lib/biometric.js";
import { useT } from "../../contexts/I18nContext.jsx";

export default function BiometricLock({ onUnlock, onLogout }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const tryAuth = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await authenticate(t("biometric.lock.reason"));
      onUnlock();
    } catch (e) {
      if (e?.message?.includes("cancel") || e?.code === "userCancel") {
        setError(null);
      } else {
        setError(t("biometric.lock.failed"));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, onUnlock, t]);

  useEffect(() => {
    const timer = setTimeout(tryAuth, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="biolock-overlay">
      <div className="biolock-card">
        <div className="biolock-icon">
          <Fingerprint size={52} />
        </div>
        <div className="biolock-title">{t("biometric.lock.title")}</div>
        <div className="biolock-sub">{t("biometric.lock.sub")}</div>

        {error && <div className="biolock-error">{error}</div>}

        <button
          className="btn accent biolock-btn"
          onClick={tryAuth}
          disabled={busy}
        >
          <Fingerprint size={16} />
          {busy ? t("biometric.lock.checking") : t("biometric.lock.btn")}
        </button>

        <button className="btn ghost biolock-logout" onClick={onLogout}>
          <LogOut size={14} />
          {t("biometric.lock.logout")}
        </button>
      </div>
    </div>
  );
}
