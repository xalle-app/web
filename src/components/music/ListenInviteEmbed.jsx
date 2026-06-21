import { useState, useEffect } from "react";
import { Radio, LogIn, WifiOff } from "lucide-react";
import { api } from "../../lib/api.js";
import { useT } from "../../contexts/I18nContext.jsx";

export default function ListenInviteEmbed({ code, token }) {
  const t = useT();
  // null = loading, true = available, false = unavailable
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (!token) { setAvailable(true); return; }
    api(`/listen/rooms/${code}`, { token })
      .then(() => setAvailable(true))
      .catch(() => setAvailable(false));
  }, [code, token]);

  useEffect(() => {
    const h = (e) => {
      if (e.detail?.code === code) setAvailable(false);
    };
    window.addEventListener("listen:room_closed", h);
    return () => window.removeEventListener("listen:room_closed", h);
  }, [code]);

  const join = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("listen:join-request", { detail: { code } }));
  };

  return (
    <div className={`listen-invite-embed ${available === false ? "lie-unavailable" : ""}`} onClick={e => e.stopPropagation()}>
      <div className="lie-icon">
        {available === false ? <WifiOff size={18} /> : <Radio size={20} />}
      </div>
      <div className="lie-info">
        <div className="lie-title">{t("listen.invite.embed.title")}</div>
        {available === false ? (
          <div className="lie-sub lie-sub-unavail">{t("listen.invite.embed.unavailable")}</div>
        ) : (
          <div className="lie-sub">{t("listen.invite.embed.sub")}</div>
        )}
        <div className="lie-code">{code}</div>
      </div>
      {available !== false && (
        <button className="lie-join-btn" onClick={join} disabled={available === null}>
          <LogIn size={15} />
          {t("listen.invite.embed.join")}
        </button>
      )}
    </div>
  );
}
