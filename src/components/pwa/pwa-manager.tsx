"use client";

import { useEffect, useState } from "react";
import { Download, Wifi, WifiOff, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "haffye_install_dismissed_v1";

export function PwaManager() {
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    // Network status listeners
    setIsOnline(navigator.onLine);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
    };
    const onOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setJustReconnected(false), 3000);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    // Install prompt listener
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow"
        >
          <WifiOff className="h-3.5 w-3.5" />
          <span>You are offline. Live tracking &amp; payments are paused.</span>
        </div>
      )}

      {isOnline && justReconnected && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow"
        >
          <Wifi className="h-3.5 w-3.5" />
          <span>Back online</span>
        </div>
      )}

      {installPrompt && !dismissed && (
        <div className="fixed bottom-20 right-4 z-50 flex max-w-xs items-center gap-3 rounded-2xl border border-caramel/40 bg-espresso p-3.5 text-cream shadow-soft md:bottom-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-caramel">Install HAFFYE</p>
            <p className="text-[11px] text-cream/85">Quick access to nearby coffee carts.</p>
          </div>
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-caramel px-3 py-1.5 text-xs font-bold text-espresso"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </button>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            onClick={handleDismiss}
            className="text-cream/60 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
