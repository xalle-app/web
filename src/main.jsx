import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/base.css";
import "./styles/animations.css";
import "./styles/ui.css";
import "./styles/layout.css";
import "./styles/composer.css";
import "./styles/emoji.css";
import "./styles/feed.css";
import "./styles/settings.css";
import "./styles/profile.css";
import "./styles/misc.css";
import "./styles/music.css";

async function initCapacitor() {
  if (!window.Capacitor?.isNativePlatform()) return;

  const [{ StatusBar, Style }, { Keyboard }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/keyboard"),
  ]);

  const isDark = document.documentElement.classList.contains("dark");
  await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
  await StatusBar.setBackgroundColor({ color: isDark ? "#1a1815" : "#faf7f2" }).catch(() => {});
  Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});

  const observer = new MutationObserver(() => {
    const dark = document.documentElement.classList.contains("dark");
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: dark ? "#1a1815" : "#faf7f2" }).catch(() => {});
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

initCapacitor();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
