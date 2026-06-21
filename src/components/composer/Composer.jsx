import { useState, useRef, useEffect, useCallback } from "react";
import { HelpCircle, Smile, ImagePlus, Eye, EyeOff, BarChart2, CalendarDays, Video, Clock, Link2, Save, Send, PenLine, Users } from "lucide-react";
import { useT, useLocale } from "../../contexts/I18nContext.jsx";
import { DATE_LOCALES } from "../../lib/i18n.js";

const PollToggle = ({ on, onClick, label }) => (
  <div className="poll-toggle-row" onClick={onClick}>
    <span className="poll-toggle-label">{label}</span>
    <div className={`poll-toggle ${on ? "on" : ""}`} />
  </div>
);
import { api, uploadImages, isVideoUrl } from "../../lib/api.js";
import Tip from "../shared/Tip.jsx";
import Md from "../shared/Markdown.jsx";
import EmojiPicker from "./EmojiPicker.jsx";
import MentionField from "./MentionField.jsx";
import { wrapSelection } from "./FormatMenu.jsx";
import FormatMenu from "./FormatMenu.jsx";
import ScheduledPosts from "./ScheduledPosts.jsx";
import DateTimePicker from "./DateTimePicker.jsx";

function getDeviceId() {
  let id = localStorage.getItem("xalle_device_id");
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("xalle_device_id", id); }
  return id;
}
const DEVICE_ID = getDeviceId();
const LOCAL_KEY = `draft_${DEVICE_ID}`;

function loadLocalDraft() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); } catch { return null; }
}
function saveLocalDraft(body, images) {
  if (body || images.length) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ body, images, ts: Date.now() }));
  } else {
    localStorage.removeItem(LOCAL_KEY);
  }
}
function clearLocalDraft() { localStorage.removeItem(LOCAL_KEY); }

export default function Composer({ token, onPosted, onShowHelp, onTag, onMention, onCollabCreated }) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = DATE_LOCALES[locale];
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [preview, setPreview] = useState(false);
  const [whisper, setWhisper] = useState(false);
  const [collab, setCollab] = useState(false);
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollAnon, setPollAnon] = useState(false);
  const [pollMulti, setPollMulti] = useState(false);
  const [pollUnvote, setPollUnvote] = useState(true);
  const [pollExpires, setPollExpires] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleFor, setScheduleFor] = useState("");
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const publishWrapRef = useRef(null);
  const [err, setErr] = useState("");
  const [fmtMenu, setFmtMenu] = useState(null);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const draftTimer = useRef(null);
  const draftSavedTimer = useRef(null);

  const left = 10000 - draft.length;

  // Загружаем черновик при монтировании: сначала локальный (устройство), потом облако
  useEffect(() => {
    if (!token) return;
    const local = loadLocalDraft();
    if (local?.body) {
      setDraft(local.body);
      if (local.images?.length) setImages(local.images);
      setDraftLoaded(true);
    } else {
      // Нет локального — пробуем облачный
      api("/draft", { token }).then((d) => {
        if (d?.body) {
          setDraft(d.body);
          if (d.images?.length) setImages(d.images);
        }
        setDraftLoaded(true);
      }).catch(() => setDraftLoaded(true));
    }
  }, [token]);

  // Авто-сохранение черновика (локально + облако)
  const saveDraft = useCallback((body, imgs) => {
    saveLocalDraft(body, imgs);
    if (!token) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      api("/draft", { method: "PUT", token, body: { body, images: imgs } }).then(() => {
        setDraftSaved(true);
        clearTimeout(draftSavedTimer.current);
        draftSavedTimer.current = setTimeout(() => setDraftSaved(false), 2000);
      }).catch(() => {});
    }, 2000);
  }, [token]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (draft || images.length) saveDraft(draft, images);
    else {
      clearTimeout(draftTimer.current);
      clearLocalDraft();
      if (token) api("/draft", { method: "DELETE", token }).catch(() => {});
    }
  }, [draft, images, draftLoaded]);

  const clearDraft = () => {
    clearTimeout(draftTimer.current);
    clearLocalDraft();
    if (token) api("/draft", { method: "DELETE", token }).catch(() => {});
  };

  const addFiles = async (files) => {
    const media = [...files].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!media.length) return;
    setErr(""); setUploading(true);
    try { const urls = await uploadImages(media, token); setImages((cur) => [...cur, ...urls].slice(0, 4)); }
    catch (e) { setErr(e.message); } finally { setUploading(false); }
  };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); };
  const insertEmoji = (em) => {
    const ta = taRef.current;
    if (!ta) { setDraft((d) => d + em); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    setDraft((d) => d.slice(0, start) + em + d.slice(end));
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + em.length; });
  };

  const buildPoll = () => {
    if (!showPoll || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return undefined;
    return { question: pollQuestion.trim(), options: pollOptions.filter(o => o.trim()), anonymous: pollAnon, multiChoice: pollMulti, allowUnvote: pollUnvote, expiresIn: pollExpires ? Number(pollExpires) : null };
  };

  const resetForm = () => {
    setDraft(""); setImages([]); setPreview(false); setWhisper(false);
    setShowPoll(false); setPollQuestion(""); setPollOptions(["", ""]); setPollAnon(false); setPollMulti(false); setPollUnvote(true); setPollExpires("");
    setShowSchedule(false); setScheduleFor("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const publish = async () => {
    if (!draft.trim() && images.length === 0 && !buildPoll()) return;
    setErr("");
    try {
      const updated = await api("/posts", { method: "POST", token, body: { body: draft, images, whisper, collab, poll: buildPoll() } });
      clearDraft();
      resetForm();
      if (collab && updated?.collab) { setCollab(false); onCollabCreated?.(); }
      else onPosted(updated);
    } catch (e) { setErr(e.message); }
  };

  const publishScheduled = async () => {
    if (!scheduleFor) { setErr(t("composer.noScheduleDate")); return; }
    if (!draft.trim() && images.length === 0 && !buildPoll()) { setErr(t("composer.emptySchedule")); return; }
    setErr("");
    try {
      await api("/posts/schedule", { method: "POST", token, body: { body: draft, images, whisper, poll: buildPoll(), scheduledFor: scheduleFor } });
      clearDraft();
      resetForm();
      setShowScheduledList(true);
    } catch (e) { setErr(e.message); }
  };

  const onContextMenu = (e) => {
    const ta = taRef.current;
    if (!ta || ta.selectionStart === ta.selectionEnd) return;
    e.preventDefault();
    setFmtMenu({ x: e.clientX, y: e.clientY });
  };
  const lpTimer = useRef(null);
  const onTouchStart = (e) => {
    lpTimer.current = setTimeout(() => {
      const ta = taRef.current;
      if (!ta || ta.selectionStart === ta.selectionEnd) return;
      const touch = e.touches?.[0];
      setFmtMenu({ x: touch ? touch.clientX : window.innerWidth / 2, y: touch ? touch.clientY - 50 : 200 });
    }, 500);
  };
  const cancelLong = () => clearTimeout(lpTimer.current);
  const applyFormat = (before, after) => { if (taRef.current) wrapSelection(taRef.current, before, after, setDraft); setFmtMenu(null); };

  useEffect(() => {
    if (!showPublishMenu) return;
    const h = (e) => { if (publishWrapRef.current && !publishWrapRef.current.contains(e.target)) setShowPublishMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showPublishMenu]);

  // Минимальная дата/время для планировщика (сейчас + 1 мин)
  const minDateTime = () => {
    const d = new Date(Date.now() + 60000);
    return d.toISOString().slice(0, 16);
  };

  return (
    <div className={`composer card ${dragOver ? "drag" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      {preview ? (
        <div className="preview-box">
          <Md className="body md" onTag={onTag} onMention={onMention}>{draft || `_${t("composer.previewEmpty")}_`}</Md>
          {showPoll && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2 && (
            <div className="poll-preview-box">
              <div className="poll-preview-q">📊 {pollQuestion}</div>
              {pollOptions.filter(o => o.trim()).map((opt, i) => (
                <div key={i} className="poll-preview-opt">{opt}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <MentionField ref={taRef} value={draft} onChange={setDraft} token={token} maxLength={10000} minRows={3}
          onContextMenu={onContextMenu}
          onTouchStart={onTouchStart} onTouchEnd={cancelLong} onTouchMove={cancelLong}
          placeholder={t("composer.placeholder")}
          hint={t("composer.hint")} />
      )}
      {/* Мобильная панель форматирования */}
      {!preview && (
        <div className="composer-fmt-bar">
          {[
            ["**", "**", <b>B</b>, t("composer.fmt.bold")],
            ["*", "*", <i>I</i>, t("composer.fmt.italic")],
            ["~~", "~~", <s>S</s>, t("composer.fmt.strike")],
            ["`", "`", <code>{"`"}</code>, t("composer.fmt.code")],
            ["> ", "", "❝", t("composer.fmt.quote")],
          ].map(([before, after, icon, title], i) => (
            <button key={i} className="fmt-bar-btn" title={title}
              onMouseDown={(e) => { e.preventDefault(); wrapSelection(taRef.current, before, after, setDraft); }}>
              {icon}
            </button>
          ))}
          <button className="fmt-bar-btn" title={t("composer.fmt.link")}
            onMouseDown={(e) => { e.preventDefault(); setLinkUrl(""); setLinkDialog(true); }}>
            <Link2 size={14} />
          </button>
        </div>
      )}
      {/* Диалог ввода ссылки (мобильный) */}
      {linkDialog && (
        <div className="link-dialog">
          <div className="link-dialog-label">{t("composer.link.label")}</div>
          <div className="link-dialog-row">
            <input className="link-dialog-input" type="url" placeholder="https://example.com" autoFocus
              value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const url = linkUrl.trim() || "url";
                  wrapSelection(taRef.current, "[", `](${url})`, setDraft);
                  setLinkDialog(false);
                }
                if (e.key === "Escape") setLinkDialog(false);
              }} />
            <button className="btn accent" style={{ flexShrink: 0 }} onClick={() => {
              const url = linkUrl.trim() || "url";
              wrapSelection(taRef.current, "[", `](${url})`, setDraft);
              setLinkDialog(false);
            }}>{t("composer.link.insert")}</button>
          </div>
          <button className="btn ghost" style={{ alignSelf: "flex-start", fontSize: 12 }} onClick={() => setLinkDialog(false)}>{t("common.cancel")}</button>
        </div>
      )}
      {dragOver && <div className="drop-hint">{t("composer.drop.hint")}</div>}
      {images.length > 0 && (
        <div className="img-strip">
          {images.map((item, i) => {
            const src = typeof item === "string" ? item : item.url;
            const isVid = typeof item === "string" ? isVideoUrl(item) : item.type === "video";
            return (
              <div className="img-thumb" key={i}>
                {isVid
                  ? <video src={src} className="img-thumb-video" muted playsInline />
                  : <img src={src} alt="" />
                }
                <button className="img-remove" onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      {showPoll && (
        <div className="poll-composer">
          <div className="poll-composer-title">{t("composer.poll.title")}</div>
          <input className="poll-question-input" placeholder={t("composer.poll.question")} value={pollQuestion}
            onChange={e => setPollQuestion(e.target.value)} maxLength={200} />
          {pollOptions.map((opt, i) => (
            <div key={i} className="poll-option-row">
              <input className="poll-option-input" placeholder={t("composer.poll.option", { n: i + 1 })} value={opt}
                onChange={e => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }} maxLength={100} />
              {pollOptions.length > 2 && (
                <button className="poll-opt-rm" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
          {pollOptions.length < 4 && (
            <button className="btn ghost poll-add-opt" onClick={() => setPollOptions([...pollOptions, ""])}>{t("composer.poll.addOption")}</button>
          )}
          <div className="poll-settings">
            <PollToggle on={pollAnon} onClick={() => setPollAnon(v => !v)} label={t("composer.poll.anonymous")} />
            <PollToggle on={pollMulti} onClick={() => setPollMulti(v => !v)} label={t("composer.poll.multiChoice")} />
            <PollToggle on={pollUnvote} onClick={() => setPollUnvote(v => !v)} label={t("composer.poll.cancelVote")} />
            <div className="poll-timer-row">
              <span className="poll-timer-label"><Clock size={13} /> {t("composer.poll.timer")}</span>
              <div className="poll-timer-pills">
                {[["", "∞"], ["60", "1ч"], ["360", "6ч"], ["1440", "24ч"], ["4320", "3д"], ["10080", "7д"]].map(([val, lbl]) => (
                  <button key={val} className={`poll-timer-pill ${pollExpires === val ? "on" : ""}`} onClick={() => setPollExpires(val)}>{lbl}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {showSchedule && (
        <div className="schedule-picker">
          <div className="schedule-picker-head">
            <span className="schedule-label">{t("composer.schedule.date")}</span>
            <button className="btn ghost schedule-cancel" onClick={() => { setShowSchedule(false); setScheduleFor(""); }}>✕</button>
          </div>
          <DateTimePicker value={scheduleFor} onChange={setScheduleFor} minDate={minDateTime()} placeholder={t("composer.schedule.placeholder")} />
          {scheduleFor && (
            <div className="schedule-when-hint">
              {t("composer.schedule.publishIn")} {(() => {
                const d = new Date(scheduleFor);
                const diff = d - Date.now();
                const m = Math.round(diff / 60000);
                const h = Math.round(diff / 3600000);
                const days = Math.round(diff / 86400000);
                if (m < 60) return t("composer.schedule.inMin", { m });
                if (h < 24) return t("composer.schedule.inHours", { h });
                return t("composer.schedule.inDays", { n: days, date: d.toLocaleString(localeStr, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) });
              })()}
            </div>
          )}
        </div>
      )}
      {err && <div className="err shake" style={{ marginTop: 10 }}>{err}</div>}
      <div className="row">
        <div className="row-left">
          <span className={`count ${left < 30 ? "warn" : ""}`}>{left}</span>
          <Tip content={t("composer.formatHelp")} pos="top">
            <button className="tb-btn" onClick={onShowHelp}><HelpCircle size={16} /></button>
          </Tip>
          <div style={{ position: "relative" }} ref={emojiBtnRef}>
            <Tip content={t("composer.emoji")} pos="top">
              <button className={`tb-btn ${showEmoji ? "on" : ""}`} onClick={() => setShowEmoji((v) => !v)}><Smile size={16} /></button>
            </Tip>
            {showEmoji && <EmojiPicker anchorRef={emojiBtnRef} onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
          </div>
          <Tip content={images.length >= 4 ? t("composer.maxImages") : t("composer.attachPhoto")} pos="top">
            <button className="tb-btn" onClick={() => fileRef.current?.click()} disabled={uploading || images.length >= 4}>
              {uploading ? <span className="tb-spin" /> : <ImagePlus size={16} />}
            </button>
          </Tip>
          <Tip content={preview ? t("composer.viewEditor") : t("composer.preview")} pos="top">
            <button className={`tb-btn ${preview ? "on" : ""}`} onClick={() => setPreview((v) => !v)}>
              {preview ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Tip>
          <Tip content={showPoll ? t("composer.removePoll") : t("composer.addPoll")} pos="top">
            <button className={`tb-btn ${showPoll ? "on" : ""}`} onClick={() => setShowPoll(v => !v)}><BarChart2 size={16} /></button>
          </Tip>
          <Tip content={t("composer.scheduledPosts")} pos="top">
            <button className={`tb-btn ${showScheduledList ? "on" : ""}`} onClick={() => setShowScheduledList(v => !v)}><CalendarDays size={16} /></button>
          </Tip>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>
        {draftSaved && (
          <span className="draft-saved-badge">
            <Save size={11} />
            {t("composer.saved")}
          </span>
        )}
        <div className="publish-wrap" ref={publishWrapRef}>
          <button
            className={`btn accent publish-main ${whisper ? "whisper-mode" : ""} ${collab ? "collab-mode" : ""} ${showSchedule ? "schedule-mode" : ""}`}
            onClick={showSchedule ? publishScheduled : publish}
            disabled={!draft.trim() && images.length === 0 && !buildPoll()}
          >
            {showSchedule ? t("composer.btn.schedule") : collab ? t("composer.btn.collab") : whisper ? t("composer.btn.whisper") : t("composer.btn.publish")}
          </button>
          <button className={`btn accent publish-arrow ${whisper ? "whisper-mode" : ""} ${collab ? "collab-mode" : ""}`}
            onClick={() => setShowPublishMenu((v) => !v)} title={t("composer.pubOptions")}>▾</button>
          {showPublishMenu && (
            <div className="publish-menu pop-in">
              <button className={!whisper && !collab && !showSchedule ? "on" : ""} onClick={() => { setWhisper(false); setCollab(false); setShowSchedule(false); setScheduleFor(""); setShowPublishMenu(false); }}>
                <span className="pm-ico"><Send size={15} /></span>
                <span className="pm-label">{t("composer.btn.publish")}</span>
              </button>
              <button className={whisper ? "on" : ""} onClick={() => { setWhisper(true); setCollab(false); setShowSchedule(false); setShowPublishMenu(false); }}>
                <span className="pm-ico"><EyeOff size={15} /></span>
                <span className="pm-label">{t("composer.publish.whisper.label")}<span className="pm-sub">{t("composer.publish.whisper.sub")}</span></span>
              </button>
              <button className={collab ? "on" : ""} onClick={() => { setCollab(true); setWhisper(false); setShowSchedule(false); setShowPublishMenu(false); }}>
                <span className="pm-ico"><PenLine size={15} /></span>
                <span className="pm-label">{t("composer.publish.collab.label")}<span className="pm-sub">{t("composer.publish.collab.sub")}</span></span>
              </button>
              <button className={showSchedule ? "on" : ""} onClick={() => { setShowSchedule(true); setWhisper(false); setCollab(false); setShowPublishMenu(false); }}>
                <span className="pm-ico"><CalendarDays size={15} /></span>
                <span className="pm-label">{t("composer.publish.schedule.label")}<span className="pm-sub">{t("composer.publish.schedule.sub")}</span></span>
              </button>
            </div>
          )}
        </div>
      </div>
      {fmtMenu && <FormatMenu x={fmtMenu.x} y={fmtMenu.y} onPick={applyFormat} onClose={() => setFmtMenu(null)} />}
      {showScheduledList && (
        <ScheduledPosts token={token} onClose={() => setShowScheduledList(false)} />
      )}
    </div>
  );
}
