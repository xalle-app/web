import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import { initials, fullDate, lastSeenText } from "../../lib/format.js";
import { Name, PresenceDot } from "../shared/icons.jsx";
import { useToast } from "../shared/ui.jsx";
import Post from "../feed/Post.jsx";
import Achievements from "./Achievements.jsx";
import Md from "../shared/Markdown.jsx";

const FP_SETTINGS = {
  allowReactions: true, allowComments: true, showViews: true, liveTime: true,
  animations: true, showReadTime: true, showWhispers: true, safeMode: false,
  autoCollapse: true, compactMode: false,
};

export default function FullProfile({ handle, token, me, onClose, onOpenUser, onTag, onMention, onOpenPost }) {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pinnedPost, setPinnedPost] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    api(`/profile/${handle}`, { token }).then(setProfile).catch(() => setProfile(false));
  }, [handle, token]);

  useEffect(() => { load(); setTab("posts"); setPosts([]); setList([]); setPinnedPost(null); }, [load]);

  useEffect(() => {
    if (!profile) return;
    api(`/profile/${handle}/pinned`, { token }).then(p => setPinnedPost(p || null)).catch(() => {});
  }, [profile, handle, token]);

  const unpinPost = async () => {
    try {
      await api("/profile/pin", { method: "DELETE", token });
      setPinnedPost(null);
      toast("Пост откреплён", { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  useEffect(() => {
    if (tab === "posts" || tab === "reposts") {
      const qs = tab === "reposts" ? "?type=repost" : "?type=post";
      api(`/profile/${handle}/posts${qs}`, { token }).then(setPosts).catch(() => setPosts([]));
    } else if (tab === "followers" || tab === "following") {
      api(`/profile/${handle}/${tab}`, { token }).then(setList).catch(() => setList([]));
    }
  }, [tab, handle, token]);

  const toggleFollow = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const p = profile.isFollowing
        ? await api(`/follow/${handle}`, { method: "DELETE", token })
        : await api(`/follow/${handle}`, { method: "POST", token });
      setProfile(p);
      toast(p.isFollowing ? `Вы подписались на ${p.name}` : "Вы отписались", { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); } finally { setBusy(false); }
  };

  return (
    <div className="screen fp-screen">
      <button className="btn ghost fp-close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>

      {profile === false ? (
        <div className="empty">Пользователь не найден</div>
      ) : !profile ? (
        <div className="empty">Загрузка…</div>
      ) : (
        <>
          <div className="fp-header card">
            <div className="fp-cover" />
            <div className="fp-main-row">
              <div className="fp-avatar-wrap">
                {profile.avatar_url
                  ? <img src={assetUrl(profile.avatar_url)} className="avatar xl av-img" alt={profile.name} />
                  : <div className="avatar xl">{initials(profile.name)}</div>
                }
                <PresenceDot online={profile.online} lastSeen={profile.last_seen} />
              </div>
              <div className="fp-header-info">
                <div className="fp-name">
                  <Name name={profile.name} verified={profile.verified} role={profile.role}
                    nameColor={profile.name_color} nameGradient={profile.name_gradient} subTier={profile.sub_tier} />
                </div>
                <div className="fp-handle">@{profile.handle}</div>
                <div className="fp-status">{profile.online ? "🟢 сейчас в сети" : lastSeenText(profile.last_seen)}</div>
                {profile.created_at && <div className="fp-joined">на Xalle с {fullDate(profile.created_at)}</div>}
              </div>
              {!profile.isSelf && (
                <button className={`btn ${profile.isFollowing ? "ghost" : "accent"} fp-follow`}
                  onClick={toggleFollow} disabled={busy}>
                  {profile.isFollowing ? "Отписаться" : "Подписаться"}
                </button>
              )}
            </div>
            <div className="fp-stats">
              <div className="fp-stat"><b>{profile.posts}</b><span>постов</span></div>
              <div className="fp-stat"><b>{profile.followers}</b><span>подписчиков</span></div>
              <div className="fp-stat"><b>{profile.following}</b><span>подписок</span></div>
            </div>
          </div>

          <Achievements handle={handle} token={token} />

          {pinnedPost && (
            <div className="up-pinned fp-pinned">
              <div className="up-pinned-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                <span>Закреплённый пост</span>
              </div>
              <div className="up-pinned-body">
                <Md>{pinnedPost.body?.slice(0, 300) + (pinnedPost.body?.length > 300 ? "…" : "")}</Md>
                {pinnedPost.poll && (() => { try { const p = JSON.parse(pinnedPost.poll); return <div className="up-pinned-poll">Голосование: {p.question}</div>; } catch { return null; } })()}
              </div>
              <div className="up-pinned-footer">
                <button className="up-pinned-open" onClick={() => onOpenPost?.(pinnedPost)}>Открыть пост</button>
                {profile.isSelf && <button className="up-pinned-unpin" onClick={unpinPost}>Открепить</button>}
              </div>
            </div>
          )}

          <div className="seg fp-tabs">
            <button className={tab === "posts" ? "on" : ""} onClick={() => setTab("posts")}>Посты</button>
            <button className={tab === "reposts" ? "on" : ""} onClick={() => setTab("reposts")}>Репосты</button>
            <button className={tab === "followers" ? "on" : ""} onClick={() => setTab("followers")}>Подписчики</button>
            <button className={tab === "following" ? "on" : ""} onClick={() => setTab("following")}>Подписки</button>
          </div>

          <div className="fp-content">
            {(tab === "posts" || tab === "reposts") && (
              posts.length === 0
                ? <div className="empty sm">Пусто</div>
                : posts.map(p => (
                  <Post key={p.id} post={p} token={token} me={me} settings={FP_SETTINGS}
                    onChange={() => {}} onTag={onTag} onMention={(h) => { onMention?.(h); }} />
                ))
            )}

            {(tab === "followers" || tab === "following") && (
              list.length === 0
                ? <div className="empty sm">Пусто</div>
                : list.map(u => (
                  <button key={u.handle} className="up-list-item" onClick={() => onOpenUser?.(u.handle)}>
                    {u.avatar_url
                      ? <img src={assetUrl(u.avatar_url)} className="avatar sm av-img" alt={u.name} />
                      : <div className="avatar sm">{initials(u.name)}</div>
                    }
                    <div className="uli-info">
                      <Name className="uli-name" name={u.name} verified={u.verified} role={u.role} />
                      <span className="uli-handle">@{u.handle}</span>
                    </div>
                  </button>
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
