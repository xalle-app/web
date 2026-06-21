import { useState, useEffect } from "react";
import { Ghost, Check } from "lucide-react";
import Tip from "./Tip.jsx";
import { timeAgo, fullDateTime, lastSeenText, initials } from "../../lib/format.js";
import { assetUrl } from "../../lib/config.js";

export const CheckBadge = () => (
  <Tip content="Подтверждённый профиль" pos="top">
    <Check className="verified" size={13} />
  </Tip>
);
export const Bubble = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z" strokeLinejoin="round" /></svg>);
export const Eye = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" /></svg>);
export const Repost = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 22l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round"/></svg>);
export const EditIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9" strokeLinecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinejoin="round"/></svg>);
export const TrashIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" strokeLinecap="round"/></svg>);
export const ModTrashIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l7 3v6c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V5l7-3z" strokeLinejoin="round"/><path d="M9 11h6M10 11v4M14 11v4" strokeLinecap="round"/></svg>);
export const FlagIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 22V4M4 4h12l-2 4 2 4H4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
export const Clock = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round"/></svg>);

export function LiveTime({ iso, live, editedAt, className = "when" }) {
  const [, tick] = useState(0);
  useEffect(() => { if (!live) return; const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, [live]);
  const tip = `Опубликовано: ${fullDateTime(iso)}` + (editedAt ? `\nИзменено: ${fullDateTime(editedAt)}` : "");
  return <Tip content={tip} pos="top"><span className={className}>{timeAgo(iso)}{editedAt ? " · изм." : ""}</span></Tip>;
}

export const ModBadge = () => (
  <Tip content="Модератор" pos="top" className="mod-badge" >
    <Ghost size={13} />
  </Tip>
);

// Subscription tier badges
export const SubBadge = ({ tier, grantedAt }) => {
  const configs = {
    1: { icon: "✦", color: "#b0a070", label: "Xalle Plus · Уровень 1", cls: "sub-lv1" },
    2: { icon: "✦✦", color: "#c8a84b", label: "Xalle Plus · Уровень 2", cls: "sub-lv2" },
    3: { icon: "✦✦✦", color: "#e0b84d", label: "Xalle Plus · Уровень 3", cls: "sub-lv3" },
    4: { icon: "✦", label: "Xalle Premium", cls: "sub-premium" },
  };
  const c = configs[tier];
  if (!c) return null;
  const tipText = grantedAt ? `${c.label}\nС ${new Date(grantedAt).toLocaleDateString("ru-RU")}` : c.label;
  return (
    <Tip content={tipText} pos="top">
      <span className={`sub-badge ${c.cls}`}>
        {tier === 4 ? (
          <span style={{
            background: "linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontSize: "15px",
            fontWeight: 800,
            lineHeight: 1,
          }}>✦</span>
        ) : (
          <span style={{ color: c.color, fontSize: "10px", fontWeight: 700, letterSpacing: "-1px" }}>{c.icon}</span>
        )}
      </span>
    </Tip>
  );
};

export const Name = ({ name, verified, role, className, nameColor, nameGradient, subTier, subGrantedAt }) => {
  const isMod = role === "moderator";
  let nameStyle;
  if (nameGradient) {
    nameStyle = { background: nameGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };
  } else if (nameColor) {
    nameStyle = { color: nameColor };
  }

  return (
    <span className={`${className || ""} ${isMod ? "name-mod" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span className={isMod ? "mod-nick" : ""} style={nameStyle}>{name}</span>
      {isMod ? <ModBadge /> : verified ? <CheckBadge /> : null}
      {subTier > 0 && <SubBadge tier={subTier} grantedAt={subGrantedAt} />}
    </span>
  );
};

// Индикатор присутствия: зелёная точка если онлайн, иначе «был в сети …»
export function PresenceDot({ online, lastSeen }) {
  const [, tick] = useState(0);
  useEffect(() => { if (online) return; const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, [online]);
  return (
    <Tip content={online ? "Сейчас в сети" : lastSeenText(lastSeen)} pos="top">
      <i className={`presence-dot ${online ? "online" : "offline"}`} />
    </Tip>
  );
}

export const Avatar = ({ url, name, size = "" }) => url
  ? <img src={assetUrl(url)} className={`avatar ${size} av-img`} alt={name} />
  : <div className={`avatar ${size}`}>{initials(name)}</div>;

/** Universal chat avatar — replaces all inline Av/UserAv/GroupAvatar helpers */
export function Av({ name, avatar, size = 40, tier, isOnline, isGroup }) {
  const cls = `${isGroup ? "grp-av-letter" : "av-letter"}${tier >= 3 ? " av-prem" : ""}`;
  return (
    <div className="av-wrap" style={{ width: size, height: size, flexShrink: 0 }}>
      {avatar
        ? <img src={assetUrl(avatar)} className={`av-img${tier >= 3 ? " av-prem" : ""}`} style={{ width: size, height: size }} alt={name} />
        : <div className={cls} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>{initials(name)}</div>
      }
      {isOnline && <span className="av-dot" />}
    </div>
  );
}