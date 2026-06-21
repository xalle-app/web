import { useT } from "../../contexts/I18nContext.jsx";
import { assetUrl } from "../../lib/config.js";

const SHARE_URL_RE = /https?:\/\/[^\s?]*\?(?:track|playlist|listen)=([A-Za-z0-9_-]{4,})/;
const TRACK_ID_URL_RE = /https?:\/\/[^\s]+#track-\d+/;

export default function ReplyQuote({ msg, onClick }) {
  const t = useT();

  let replyImgs = [];
  try { replyImgs = JSON.parse(msg.reply_images || "[]"); } catch {}

  const hasImg = replyImgs.length > 0;
  const body = msg.reply_body || "";
  const isMusic = SHARE_URL_RE.test(body) || TRACK_ID_URL_RE.test(body);
  const isVideo = hasImg && replyImgs.some(a => a?.type === "video" || (typeof a === "string" && /\.(mp4|webm|mov)/i.test(a)));

  const firstThumb = hasImg ? assetUrl(typeof replyImgs[0] === "string" ? replyImgs[0] : replyImgs[0]?.url) : null;

  return (
    <div className="dm-reply-quote dm-reply-quote-clickable" onClick={onClick}>
      <div className="dm-reply-quote-name">{msg.reply_sender_name || t("messages.replyFallback")}</div>

      {hasImg && !isVideo && (
        <div className="dm-reply-quote-media">
          <img src={firstThumb} className="dm-reply-quote-thumb" alt="" />
          {msg.reply_body && <span className="dm-reply-quote-text">{msg.reply_body.slice(0, 50)}</span>}
          {!msg.reply_body && replyImgs.length > 1 && <span className="dm-reply-quote-text">+{replyImgs.length - 1}</span>}
        </div>
      )}

      {isVideo && (
        <div className="dm-reply-quote-media">
          <span className="dm-reply-quote-icon">▶</span>
          <span className="dm-reply-quote-text">Видео</span>
        </div>
      )}

      {isMusic && !hasImg && (
        <div className="dm-reply-quote-media">
          <span className="dm-reply-quote-icon">🎵</span>
          <span className="dm-reply-quote-text">Музыка</span>
        </div>
      )}

      {!hasImg && !isMusic && (
        <div className="dm-reply-quote-text">
          {body ? body.slice(0, 80) : `📎 Вложение`}
        </div>
      )}
    </div>
  );
}
