import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { renderMarkdown } from "../../markdown.js";

const TRUSTED = ["youtube.com", "youtu.be", "google.com", "github.com", "wikipedia.org", "twitter.com", "x.com", "reddit.com", "stackoverflow.com", "npmjs.com", "developer.mozilla.org", "vk.com", "telegram.org", "t.me"];

function isTrusted(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return TRUSTED.some(d => host === d || host.endsWith("." + d));
  } catch { return false; }
}

function LinkWarnModal({ url, isHttp, onConfirm, onCancel }) {
  return createPortal(
    <div className="link-warn-overlay" onClick={onCancel}>
      <div className="link-warn-modal pop-in" onClick={e => e.stopPropagation()}>
        <div className="link-warn-icon">{isHttp ? "⚠️" : "🔗"}</div>
        <h3 className="link-warn-title">{isHttp ? "Небезопасная ссылка" : "Внешняя ссылка"}</h3>
        {isHttp ? (
          <p className="link-warn-body">
            Эта ссылка использует незащищённый протокол <strong>HTTP</strong>. Мы рекомендуем <strong>не переходить</strong> по ней — ваши данные могут быть перехвачены.
          </p>
        ) : (
          <p className="link-warn-body">
            Вы переходите на внешний сайт. Xalle не несёт ответственности за содержимое внешних ресурсов.
          </p>
        )}
        <div className="link-warn-url">{url}</div>
        <div className="link-warn-actions">
          {!isHttp && (
            <button className="btn accent" onClick={onConfirm}>Перейти</button>
          )}
          <button className="btn ghost" onClick={onCancel}>{isHttp ? "Закрыть" : "Отмена"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Md({ children, className, onTag, onMention }) {
  const ref = useRef(null);
  const [warnLink, setWarnLink] = useState(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => {
      const sp = e.target.closest(".spoiler");
      if (sp && !sp.classList.contains("revealed")) { e.preventDefault(); e.stopPropagation(); sp.classList.add("revealed"); return; }
      const tag = e.target.closest(".hashtag");
      if (tag && onTag) { e.preventDefault(); onTag(tag.getAttribute("data-tag")); return; }
      const men = e.target.closest(".mention");
      if (men && onMention) { e.preventDefault(); onMention(men.getAttribute("data-mention")); return; }
      const a = e.target.closest("a");
      if (a) {
        const href = a.getAttribute("href");
        if (!href || href.startsWith("/") || href.startsWith("#")) return;
        e.preventDefault();
        if (href.startsWith("http://")) { setWarnLink({ url: href, isHttp: true }); return; }
        if (href.startsWith("https://") && isTrusted(href)) { window.open(href, "_blank", "noopener,noreferrer"); return; }
        if (href.startsWith("https://")) { setWarnLink({ url: href, isHttp: false }); return; }
      }
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  });

  return (
    <>
      <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }} />
      {warnLink && (
        <LinkWarnModal
          url={warnLink.url}
          isHttp={warnLink.isHttp}
          onConfirm={() => { window.open(warnLink.url, "_blank", "noopener,noreferrer"); setWarnLink(null); }}
          onCancel={() => setWarnLink(null)}
        />
      )}
    </>
  );
}
