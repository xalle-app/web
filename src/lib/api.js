import { API_BASE } from "./config.js";

export const api = async (path, { method = "GET", body, token } = {}) => {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      window.dispatchEvent(new CustomEvent("xalle:session-revoked"));
    }
    if (res.status === 403 && data.code === "banned") {
      window.dispatchEvent(new CustomEvent("xalle:session-revoked"));
    }
    throw new Error(data.error || "Что-то пошло не так");
  }
  return data;
};

export const uploadImages = async (files, token) => {
  const fd = new FormData();
  [...files].slice(0, 4).forEach((f) => fd.append("images", f));
  const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Не удалось загрузить");
  return (data.urls || []).map((item) => (typeof item === "string" ? { url: item, type: "image" } : item));
};

export const isVideoUrl = (url) => /\.(mp4|webm|mov)(\?|$)/i.test(url || "");
