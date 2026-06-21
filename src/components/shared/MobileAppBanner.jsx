import { useState, useEffect } from "react";
import { Smartphone, X } from "lucide-react";
import { IS_CAPACITOR } from "../../lib/config.js";

const DISMISS_KEY = "xalle.mob_banner_dismissed";
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней

function isMobileBrowser() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export default function MobileAppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show inside Capacitor (already native) or on desktop
    if (IS_CAPACITOR || !isMobileBrowser()) return;
    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts && Date.now() - Number(ts) < DISMISS_TTL) return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mob-banner">
      <div className="mob-banner-icon"><Smartphone size={20} /></div>
      <div className="mob-banner-text">
        <span className="mob-banner-title">Xalle есть в приложении</span>
        <span className="mob-banner-sub">Скачай для Android — быстрее и удобнее</span>
      </div>
      <a
        className="mob-banner-btn"
        href="https://xalle.app/android"
        rel="noopener noreferrer"
      >
        Скачать
      </a>
      <button className="mob-banner-close" onClick={dismiss} aria-label="Закрыть">
        <X size={16} />
      </button>
    </div>
  );
}
