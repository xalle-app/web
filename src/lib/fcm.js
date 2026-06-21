import { API_BASE } from "./config.js";

export async function registerFcmToken(authToken) {
  if (!window.Capacitor?.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;

    await PushNotifications.register();

    PushNotifications.addListener("registration", async ({ value: fcmToken }) => {
      await fetch(`${API_BASE}/api/push/fcm-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: fcmToken, platform: "android" }),
      }).catch(() => {});
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("FCM registration error:", err);
    });

    // Навигация при тапе на уведомление
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action.notification?.data?.url;
      if (url) window.dispatchEvent(new CustomEvent("xalle:navigate", { detail: { url } }));
    });
  } catch (e) {
    console.warn("FCM init error:", e);
  }
}
