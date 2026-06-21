import { useEffect } from "react";
import { Info, TriangleAlert, Check, X} from "lucide-react";
import Md from "../shared/Markdown.jsx";

export default function MarkdownHelp({ onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Оформление текста</h3>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <p className="modal-sub">
          Посты и комментарии поддерживают Markdown:
        </p>

        <div className="modal-scroll">
          <div className="md-table">
            <div><code>**жирный**</code><span><b>жирный</b></span></div>
            <div><code>*курсив*</code><span><i>курсив</i></span></div>
            <div><code>~~зачёркнутый~~</code><span><del>зачёркнутый</del></span></div>
            <div><code>`код`</code><span><code>код</code></span></div>

            <div>
              <code># Заголовок</code>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                Заголовок
              </span>
            </div>

            <div>
              <code>&gt; цитата</code>
              <span style={{ borderLeft: "3px solid var(--accent-soft)", paddingLeft: 8, fontStyle: "italic" }}>
                цитата
              </span>
            </div>

            <div><code>#тег</code><span><a className="hashtag">#тег</a></span></div>
            <div><code>@ник</code><span><a className="mention">@ник</a></span></div>
            <div><code>[текст](ссылка)</code><span><a style={{ color: "var(--accent)" }}>текст</a></span></div>
            <div><code>||скрытый текст||</code><span><Md className="body md">||скрытый текст||</Md></span></div>
          </div>

          <p className="modal-sub" style={{ marginTop: 16 }}>
            Блоки-выноски (callouts):
          </p>

          <div className="md-table">
            <div><code>&gt; [!info] текст</code><span className="md-callout md-callout-info" style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 13 }}><Info size={14} />текст</span></div>
            <div><code>&gt; [!warning] текст</code><span className="md-callout md-callout-warning" style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 13 }}><TriangleAlert size={14} />текст</span></div>
            <div><code>&gt; [!success] текст</code><span className="md-callout md-callout-success" style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 13 }}><Check size={14} />текст</span></div>
            <div><code>&gt; [!error] текст</code><span className="md-callout md-callout-error" style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 13 }}><X size={14} />текст</span></div>
          </div>

          <p className="modal-sub" style={{ marginTop: 12 }}>
            Разделители:
          </p>

          <div className="md-table">
            <div><code>---</code><span style={{ color: "var(--ink-faint)", fontSize: 13 }}>──────── сплошная линия</span></div>
            <div><code>~~~</code><span style={{ color: "var(--ink-faint)", fontSize: 13 }}>- - - - - пунктирная линия</span></div>
          </div>
        </div>

        <p className="modal-foot">
          Хештеги и упоминания кликабельны. Горячие клавиши: <b>N</b>, <b>/</b>
        </p>
      </div>
    </div>
  );
}