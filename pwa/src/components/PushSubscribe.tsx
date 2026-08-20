import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import type { Settings } from "../hooks/useSettings";
import { useTranslation } from "react-i18next";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export interface PushSubscribeHandle {
  syncSettings: (settings: Settings) => Promise<void>;
}

export const PushSubscribe = forwardRef<PushSubscribeHandle, { settings: Settings }>(({ settings }, ref) => {
  const { t } = useTranslation();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    syncSettings: async (newSettings: Settings) => {
      if (!isSubscribed || !isSupported) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const subJson = sub.toJSON();
          await fetch("/api/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
              minMagnitude: newSettings.minMagnitude,
              regions: newSettings.regions,
            }),
          });
        }
      } catch (e) {
        console.error("Sync error", e);
      }
    }
  }));

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      VAPID_PUBLIC_KEY.length > 0;

    setIsSupported(supported);

    if (supported) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      });
    }
  }, []);

  const toggleSubscription = async () => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      const reg = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setIsSubscribed(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
        });

        const subJson = sub.toJSON();
        await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
            minMagnitude: settings.minMagnitude,
            regions: settings.regions,
          }),
        });

        setIsSubscribed(true);
      }
    } catch (err) {
      console.error("Push subscription error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) return null;

  return (
    <div className="push-toggle" id="tour-push">
      <input
        type="checkbox"
        className="push-toggle__switch"
        checked={isSubscribed}
        onChange={toggleSubscription}
        disabled={isLoading}
        id="push-toggle"
      />
      <label htmlFor="push-toggle" className="push-toggle__label">
        {isSubscribed ? `🔔 ${t("sidebar.active_notifications")}` : `🔕 ${t("push.enable")}`}
      </label>
    </div>
  );
});
