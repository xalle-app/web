// Лёгкое конфетти из эмодзи в точке экрана (бонус для реакции 🎉)
export function burstConfetti(x, y, emojis = ["🎉", "✨", "🎊", "⭐"]) {
  if (document.body.classList.contains("no-anim")) return;
  const N = 14;
  for (let i = 0; i < N; i++) {
    const s = document.createElement("span");
    s.className = "confetti-piece";
    s.textContent = emojis[i % emojis.length];
    s.style.left = x + "px";
    s.style.top = y + "px";
    const angle = (Math.PI * 2 * i) / N + Math.random() * 0.5;
    const dist = 60 + Math.random() * 80;
    s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    s.style.setProperty("--dy", (Math.sin(angle) * dist - 40) + "px");
    s.style.fontSize = 12 + Math.random() * 12 + "px";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}
