import Md from "./Markdown.jsx";
import TrackEmbed from "../music/TrackEmbed.jsx";
import PlaylistEmbed from "../music/PlaylistEmbed.jsx";
import ListenInviteEmbed from "../music/ListenInviteEmbed.jsx";

// Legacy: full URLs ending with #track-N
const TRACK_ID_RE = /https?:\/\/[^\s]+#track-(\d+)/g;

// Full xalle share URLs: http(s)://host?track=TOKEN etc.
// [^\s?]* = host+path (no whitespace, no literal ?)
const SHARE_RE = /https?:\/\/[^\s?]*\?(?:track|playlist|listen)=([A-Za-z0-9_-]{4,})/g;

function parseSegments(text) {
  const matches = [];

  TRACK_ID_RE.lastIndex = 0;
  SHARE_RE.lastIndex = 0;

  let m;
  while ((m = TRACK_ID_RE.exec(text)) !== null) {
    matches.push({ index: m.index, end: TRACK_ID_RE.lastIndex, type: "track-id", id: parseInt(m[1]) });
  }
  SHARE_RE.lastIndex = 0;
  while ((m = SHARE_RE.exec(text)) !== null) {
    const full = m[0];
    let type = "track-token";
    if (full.includes("?playlist=")) type = "playlist-token";
    else if (full.includes("?listen=")) type = "listen-invite";
    matches.push({ index: m.index, end: SHARE_RE.lastIndex, type, shareToken: m[1] });
  }

  // Sort by position, drop overlaps
  matches.sort((a, b) => a.index - b.index);
  const kept = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.index < cursor) continue;
    kept.push(match);
    cursor = match.end;
  }

  const segments = [];
  let last = 0;
  for (const match of kept) {
    if (match.index > last) segments.push({ type: "text", content: text.slice(last, match.index) });
    segments.push(match);
    last = match.end;
  }
  if (last < text.length) segments.push({ type: "text", content: text.slice(last) });

  return segments;
}

export default function PostBody({ children, token, className, onTag, onMention }) {
  if (typeof children !== "string") return <Md className={className} onTag={onTag} onMention={onMention}>{children}</Md>;

  const segments = parseSegments(children);

  if (segments.length === 1 && segments[0].type === "text") {
    return <Md className={className} onTag={onTag} onMention={onMention}>{children}</Md>;
  }

  return (
    <div className={className}>
      {segments.map((s, i) => {
        if (s.type === "text") return s.content.trim() ? <Md key={i} className="md" onTag={onTag} onMention={onMention}>{s.content}</Md> : null;
        if (s.type === "track-id") return <TrackEmbed key={i} trackId={s.id} token={token} />;
        if (s.type === "track-token") return <TrackEmbed key={i} shareToken={s.shareToken} token={token} />;
        if (s.type === "playlist-token") return <PlaylistEmbed key={i} shareToken={s.shareToken} token={token} />;
        if (s.type === "listen-invite") return <ListenInviteEmbed key={i} code={s.shareToken} token={token} />;
        return null;
      })}
    </div>
  );
}
