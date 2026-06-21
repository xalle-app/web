import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

const ALL_ACHIEVEMENTS = [
  {
    type: "first_post",
    emoji: "✍️",
    label: "Первопроходец",
    desc: "Опубликовал первый пост на платформе",
    rarity: "common",
    rarityLabel: "Обычное",
  },
  {
    type: "first_comment",
    emoji: "💬",
    label: "Голос в толпе",
    desc: "Оставил первый комментарий",
    rarity: "common",
    rarityLabel: "Обычное",
  },
  {
    type: "first_reaction",
    emoji: "❤️",
    label: "Эмоциональный",
    desc: "Поставил первую реакцию на пост",
    rarity: "common",
    rarityLabel: "Обычное",
  },
  {
    type: "collab_debut",
    emoji: "🤝",
    label: "Соавтор",
    desc: "Участвовал в создании сборного поста",
    rarity: "rare",
    rarityLabel: "Редкое",
  },
  {
    type: "popular_post",
    emoji: "🔥",
    label: "В тренде",
    desc: "Пост набрал 50+ просмотров",
    rarity: "epic",
    rarityLabel: "Эпическое",
  },
];

const RARITY_COLORS = {
  common: { bg: "color-mix(in srgb, var(--line) 50%, transparent)", border: "var(--line)", text: "var(--ink-faint)", glow: "none" },
  rare:   { bg: "color-mix(in srgb, #60a5fa 12%, var(--surface))", border: "#60a5fa55", text: "#60a5fa", glow: "0 0 14px #60a5fa22" },
  epic:   { bg: "color-mix(in srgb, #a78bfa 14%, var(--surface))", border: "#a78bfa55", text: "#a78bfa", glow: "0 0 18px #a78bfa2a" },
  legend: { bg: "color-mix(in srgb, #f59e0b 14%, var(--surface))", border: "#f59e0b55", text: "#f59e0b", glow: "0 0 20px #f59e0b2a" },
};

function AchCard({ ach, unlocked, unlockedAt }) {
  const [hover, setHover] = useState(false);
  const rc = unlocked ? RARITY_COLORS[ach.rarity] : RARITY_COLORS.common;

  return (
    <div
      className={`ach-card ${unlocked ? "ach-unlocked" : "ach-locked"}`}
      style={unlocked ? { background: rc.bg, borderColor: rc.border, boxShadow: hover ? rc.glow : "none" } : {}}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={ach.desc}
    >
      <div className={`ach-card-emoji ${!unlocked ? "ach-emoji-locked" : ""}`}>{ach.emoji}</div>
      <div className="ach-card-info">
        <div className="ach-card-name">{ach.label}</div>
        <div className="ach-card-desc">{ach.desc}</div>
        {unlocked && ach.rarity !== "common" && (
          <div className="ach-card-rarity" style={{ color: rc.text }}>{ach.rarityLabel}</div>
        )}
        {unlocked && unlockedAt && (
          <div className="ach-card-date">{new Date(unlockedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
        )}
      </div>
      {unlocked ? (
        <div className="ach-card-check" style={{ color: rc.text }}>✦</div>
      ) : (
        <div className="ach-card-lock">🔒</div>
      )}
    </div>
  );
}

export default function Achievements({ handle, token }) {
  const [earned, setEarned] = useState(null);
  const [earnedMap, setEarnedMap] = useState({});

  useEffect(() => {
    if (!handle) return;
    api(`/achievements/${handle}`, { token })
      .then((arr) => {
        const map = {};
        arr.forEach(a => { map[a.type] = a.unlocked_at || true; });
        setEarned(new Set(arr.map(a => a.type)));
        setEarnedMap(map);
      })
      .catch(() => { setEarned(new Set()); });
  }, [handle, token]);

  if (earned === null) return null;

  const earnedCount = earned.size;
  const total = ALL_ACHIEVEMENTS.length;
  const pct = Math.round((earnedCount / total) * 100);

  return (
    <div className="achievements-block">
      <div className="ach-header">
        <div className="ach-header-left">
          <span className="ach-title">Достижения</span>
          <span className="ach-count">{earnedCount} / {total}</span>
        </div>
        <div className="ach-progress-wrap">
          <div className="ach-progress-bar">
            <div className="ach-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="ach-pct">{pct}%</span>
        </div>
      </div>

      <div className="ach-grid">
        {ALL_ACHIEVEMENTS.map(ach => (
          <AchCard
            key={ach.type}
            ach={ach}
            unlocked={earned.has(ach.type)}
            unlockedAt={earnedMap[ach.type] !== true ? earnedMap[ach.type] : null}
          />
        ))}
      </div>
    </div>
  );
}
