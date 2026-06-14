"use client";

import { useEffect, useState, useTransition } from "react";

import { Card, Button, Alert, MiniButton } from "@/components/ui";

import { subscribePush, unsubscribePush } from "./actions";

/** base64url VAPID key → ArrayBuffer for PushManager.subscribe. */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

/**
 * Web-push opt-in. Requests notification permission, subscribes via the service
 * worker's PushManager, and stores the subscription server-side. Hidden when
 * push isn't configured (no VAPID public key) or unsupported by the browser.
 */
export function PushPanel({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [subscribed, setSubscribed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Derived synchronously (no state) — avoids setState-in-effect.
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!vapidPublicKey;

  // Effect only reads the EXISTING subscription state (async); the lint allows a
  // setState inside an async callback, not synchronously in the effect body.
  useEffect(() => {
    if (!supported) return;
    let active = true;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (active) setSubscribed(!!sub);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [supported]);

  if (!supported) return null;

  function enable() {
    setError(null);
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("Benachrichtigungen wurden nicht erlaubt.");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBuffer(vapidPublicKey),
        });
        const json = sub.toJSON();
        const res = await subscribePush({
          endpoint: sub.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
        });
        if (!res.ok) setError(res.message);
        else setSubscribed(true);
      } catch {
        setError("Konnte Push nicht aktivieren.");
      }
    });
  }

  function disable() {
    setError(null);
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
      } catch {
        setError("Konnte Push nicht deaktivieren.");
      }
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            Push-Benachrichtigungen
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Erhalte eine Push-Nachricht auf diesem Gerät, wenn etwas
            veröffentlicht wird.
          </p>
        </div>
        {subscribed ? (
          <MiniButton
            type="button"
            disabled={pending}
            onClick={disable}
            className="shrink-0"
          >
            Aus
          </MiniButton>
        ) : (
          <div className="shrink-0">
            <Button onClick={enable} disabled={pending} className="w-auto px-4">
              {pending ? "…" : "Aktivieren"}
            </Button>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </Card>
  );
}
