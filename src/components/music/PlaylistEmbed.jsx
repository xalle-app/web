import { useState, useEffect } from "react";
import { Play, ListMusic } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import * as Player from "../../lib/player.js";
import { useT } from "../../contexts/I18nContext.jsx";

function trackWord(n, t) {
  const m10 = Math.abs(n) % 10, m100 = Math.abs(n) % 100;
  if (m100 >= 11 && m100 <= 19) return t("music.track.nMany");
  if (m10 === 1) return t("music.track.n1");
  if (m10 >= 2 && m10 <= 4) return t("music.track.n234");
  return t("music.track.nMany");
}

export default function PlaylistEmbed({ shareToken, token }) {
  const t = useT();
  const [pl, setPl] = useState(null);

  useEffect(() => {
    api(`/playlists/by-token/${shareToken}`, { token })
      .then(d => setPl(d))
      .catch(() => {});
  }, [shareToken, token]);

  if (!pl) return null;

  const playAll = (e) => {
    e.stopPropagation();
    if (!pl.tracks?.length) return;
    Player.play(pl.tracks, 0);
  };

  const count = pl.track_count ?? pl.tracks?.length ?? 0;

  return (
    <div className="playlist-embed" onClick={e => e.stopPropagation()}>
      <div className="playlist-embed-cover">
        {pl.cover_url
          ? <img src={assetUrl(pl.cover_url)} alt={pl.title} />
          : <div className="playlist-embed-cover-empty"><ListMusic size={18} /></div>
        }
      </div>
      <div className="playlist-embed-info">
        <div className="playlist-embed-title">{pl.title}</div>
        <div className="playlist-embed-meta">{count} {trackWord(count, t)}</div>
      </div>
      {pl.tracks?.length > 0 && (
        <button className="playlist-embed-play" onClick={playAll} title={t("music.playlist.play")}>
          <Play size={15} />
        </button>
      )}
    </div>
  );
}
