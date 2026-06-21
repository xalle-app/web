// Global audio player singleton — no React state, just events + callbacks
// so it survives view changes without re-mounting

const _VOL_KEY = "xalle.player.volume";
const _savedVol = parseFloat(localStorage.getItem(_VOL_KEY) ?? "0.8");

const audio = new Audio();
audio.preload = "metadata";
audio.volume = isNaN(_savedVol) ? 0.8 : Math.max(0, Math.min(1, _savedVol));

let _queue = [];
let _idx = 0;
let _repeat = "none"; // "none" | "one" | "all"
let _shuffle = false;
let _listeners = new Set();

function notify() { _listeners.forEach(fn => fn(getState())); }

export function getState() {
  return {
    current: _queue[_idx] || null,
    queue: _queue,
    idx: _idx,
    playing: !audio.paused,
    progress: audio.duration ? audio.currentTime / audio.duration : 0,
    currentTime: audio.currentTime,
    duration: audio.duration || 0,
    volume: audio.volume,
    repeat: _repeat,
    shuffle: _shuffle,
  };
}

audio.addEventListener("timeupdate", notify);
audio.addEventListener("play", () => {
  notify();
  const t = _queue[_idx];
  if (t?.id && t?.public) window.dispatchEvent(new CustomEvent("music:play", { detail: { id: t.id } }));
});
audio.addEventListener("pause", notify);
audio.addEventListener("ended", () => {
  if (_repeat === "one") {
    audio.currentTime = 0; audio.play().catch(() => {}); return;
  }
  if (_queue.length === 0) return;
  if (_shuffle) {
    _idx = Math.floor(Math.random() * _queue.length);
  } else {
    _idx = (_idx + 1) % _queue.length;
    if (_idx === 0 && _repeat !== "all") { notify(); return; }
  }
  _load(true);
});
audio.addEventListener("durationchange", notify);
audio.addEventListener("loadedmetadata", notify);

function _load(autoplay = false) {
  const t = _queue[_idx];
  if (!t) return;
  audio.src = t.src;
  audio.load();
  if (autoplay) audio.play().catch(() => {});
  notify();
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function play(tracks, startIdx = 0) {
  _queue = tracks;
  _idx = startIdx;
  _load(true);
}

export function playOne(track) {
  // If track is in queue, just jump to it; otherwise replace queue
  const i = _queue.findIndex(t => t.id === track.id);
  if (i >= 0) { _idx = i; audio.play().catch(() => {}); notify(); return; }
  _queue = [track];
  _idx = 0;
  _load(true);
}

export function addToQueue(track) {
  _queue = [..._queue, track];
  notify();
}

export function toggle() {
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

export function next() {
  if (_queue.length === 0) return;
  if (_shuffle) _idx = Math.floor(Math.random() * _queue.length);
  else _idx = (_idx + 1) % _queue.length;
  _load(true);
}

export function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (_queue.length === 0) return;
  _idx = (_idx - 1 + _queue.length) % _queue.length;
  _load(true);
}

export function seek(frac) {
  if (audio.duration) audio.currentTime = frac * audio.duration;
}

export function setVolume(v) {
  audio.volume = Math.max(0, Math.min(1, v));
  localStorage.setItem(_VOL_KEY, String(audio.volume));
  notify();
}

export function setRepeat(v) { _repeat = v; notify(); }
export function toggleShuffle() { _shuffle = !_shuffle; notify(); }
export function patchCurrentLiked(liked) {
  if (_queue[_idx]) { _queue[_idx] = { ..._queue[_idx], liked }; notify(); }
}
export function patchCurrentMeta(id, patch) {
  _queue = _queue.map(t => t.id === id ? { ...t, ...patch } : t);
  notify();
}
export function pause() { audio.pause(); }
export function resume() { audio.play().catch(() => {}); }
export function seekToSeconds(sec) { if (!isNaN(sec)) audio.currentTime = sec; }
export function stop() {
  audio.pause();
  audio.src = "";
  _queue = [];
  _idx = 0;
  notify();
}

let _pendingSyncHandler = null;

// Load a track and seek to an exact position once audio is ready.
// Used by Listen Together guests to avoid the 150ms-guess approach.
export function syncToRoom(track, position, playing) {
  if (_pendingSyncHandler) {
    audio.removeEventListener("canplay", _pendingSyncHandler);
    _pendingSyncHandler = null;
  }
  _queue = [track];
  _idx = 0;
  audio.src = track.src;
  audio.load();
  notify();

  const apply = () => {
    if (!isNaN(position) && position > 0) audio.currentTime = position;
    if (playing) audio.play().catch(() => {});
    notify();
  };

  // readyState >= 3 = HAVE_FUTURE_DATA — safe to seek and play
  if (audio.readyState >= 3) {
    apply();
  } else {
    _pendingSyncHandler = () => {
      _pendingSyncHandler = null;
      apply();
    };
    audio.addEventListener("canplay", _pendingSyncHandler, { once: true });
  }
}
