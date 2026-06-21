import { Smartphone, ArrowDown } from "lucide-react";

export default function MobileWall() {
  return (
    <div className="mwall">
      <div className="mwall-inner">
        <div className="mwall-logo">
          <span className="mwall-logo-x">X</span>
          <span className="mwall-logo-name">alle</span>
        </div>
        <div className="mwall-icon"><Smartphone size={42} strokeWidth={1.5} /></div>
        <h1 className="mwall-title">Xalle — только в приложении</h1>
        <p className="mwall-sub">
          Веб-версия недоступна на мобильных устройствах.<br />
          Скачай приложение для Android — это быстрее и удобнее.
        </p>
        <a className="mwall-btn" href="https://xalle.app/android" rel="noopener noreferrer">
          <ArrowDown size={18} />
          Скачать для Android
        </a>
        <p className="mwall-hint">Для доступа к веб-версии открой на компьютере</p>
      </div>
    </div>
  );
}
