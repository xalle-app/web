self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "Xalle", body: event.data.text() }; }

  const title = data.title || "Xalle";
  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.type === "dm" ? `dm-${data.convId}` : `group-${data.groupId}`,
    renotify: true,
    data: { url: "/", type: data.type, convId: data.convId, groupId: data.groupId },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "notification:click", data: event.notification.data });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
