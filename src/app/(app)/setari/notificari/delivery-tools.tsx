"use client";

import { useEffect, useState, useTransition } from "react";
import { BellIcon, BellOffIcon, CopyIcon, ExternalLinkIcon, KeyRoundIcon, Loader2Icon, MailIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deletePushSubscription, savePushSubscription, sendTestEmail, sendTestPush } from "./actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function toBase64Url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type PushState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

export function PushDevice({ serverConfigured }: { serverConfigured: boolean }) {
  const [state, setState] = useState<PushState>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const detect = async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return ios && !standalone ? "ios-install" : "unsupported";
      }
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? "on" : "off";
    };
    detect().then((s) => setState(s as PushState));
  }, []);

  function enable() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return void toast.error("Nu ai permis notificările.");
        }
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        const result = await savePushSubscription(subscription.toJSON(), navigator.userAgent);
        if (!result.ok) return void toast.error(result.error);
        setState("on");
        toast.success("Notificările sunt active pe acest dispozitiv.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Nu am putut activa notificările.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
      toast.success("Notificările au fost oprite pe acest dispozitiv.");
    });
  }

  function test() {
    startTransition(async () => {
      const result = await sendTestPush();
      if (result.ok) toast.success(result.data);
      else toast.error(result.error);
    });
  }

  if (!serverConfigured || !VAPID_PUBLIC_KEY) return <VapidGenerator />;

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">Pe acest dispozitiv</p>
          <p className="text-muted-foreground">
            {state === "loading" && "Se verifică…"}
            {state === "on" && "Notificările sunt active."}
            {state === "off" && "Notificările nu sunt active încă."}
            {state === "denied" && "Ai blocat notificările pentru acest site. Le poți permite din setările browserului."}
            {state === "unsupported" && "Browserul ăsta nu suportă notificări push."}
            {state === "ios-install" &&
              "Pe iPhone: apasă Share → „Add to Home Screen”, apoi deschide aplicația de pe ecranul principal și activează notificările de acolo."}
          </p>
        </div>
        <div className="flex gap-2">
          {state === "off" ? (
            <Button size="sm" onClick={enable} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <BellIcon />} Activează pe acest dispozitiv
            </Button>
          ) : null}
          {state === "on" ? (
            <>
              <Button size="sm" variant="outline" onClick={test} disabled={pending}>
                <SendIcon /> Trimite un test
              </Button>
              <Button size="sm" variant="ghost" onClick={disable} disabled={pending}>
                <BellOffIcon /> Oprește
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Pe telefon, instalează întâi aplicația: Android/Chrome → meniu ⋮ → „Instalează aplicația”; iPhone/Safari → Share → „Add to Home
        Screen”.
      </p>
    </div>
  );
}

/** Generează local, în browser, perechea de chei VAPID pentru Web Push. */
function VapidGenerator() {
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);

  async function generate() {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const publicKey = toBase64Url(await crypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    setKeys({ publicKey, privateKey: jwk.d! });
  }

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Copiat"));

  return (
    <div className="grid gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm">
      <p className="font-medium">Notificările push nu sunt configurate încă pe server.</p>
      <p>
        Ai nevoie de o pereche de chei VAPID, adăugată în Vercel → Settings → Environment Variables. Generează-le aici (se creează doar în
        browserul tău, nu se salvează nicăieri):
      </p>
      {!keys ? (
        <Button size="sm" variant="outline" className="w-fit bg-background" onClick={generate}>
          <KeyRoundIcon /> Generează chei VAPID
        </Button>
      ) : (
        <div className="grid gap-2">
          {[
            ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.publicKey],
            ["VAPID_PRIVATE_KEY", keys.privateKey],
            ["VAPID_SUBJECT", "mailto:emailul-tau@domeniu.ro"],
          ].map(([name, value]) => (
            <div key={name} className="grid gap-1">
              <code className="text-xs font-semibold">{name}</code>
              <div className="flex gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{value}</code>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="bg-background"
                  onClick={() => copy(value!)}
                  aria-label={`Copiază ${name}`}
                >
                  <CopyIcon />
                </Button>
              </div>
            </div>
          ))}
          <p className="text-xs">După ce le adaugi în Vercel, fă un redeploy și revino aici ca să activezi notificările pe telefon.</p>
        </div>
      )}
    </div>
  );
}

export function EmailTools({ configured }: { configured: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href="/setari/notificari/email" target="_blank" rel="noreferrer">
          <ExternalLinkIcon /> Previzualizează emailul de azi
        </a>
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !configured}
        onClick={() =>
          startTransition(async () => {
            const result = await sendTestEmail();
            if (result.ok) toast.success(result.data);
            else toast.error(result.error);
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <MailIcon />} Trimite-mi acum emailul
      </Button>
      {!configured ? (
        <span className="text-xs text-muted-foreground">Trimiterea are nevoie de RESEND_API_KEY în Vercel (vezi README).</span>
      ) : null}
    </div>
  );
}
