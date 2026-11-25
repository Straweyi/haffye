export interface SnapCallbacks {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
}

export interface SnapApi {
  pay(token: string, callbacks: SnapCallbacks): void;
}

declare global {
  interface Window {
    snap?: SnapApi;
  }
}

let loading: Promise<SnapApi> | null = null;

/** Loads Midtrans Snap.js once (client key is public by design). */
export function loadSnap(): Promise<SnapApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (window.snap) return Promise.resolve(window.snap);
  if (loading) return loading;

  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
  if (!clientKey) return Promise.reject(new Error("NEXT_PUBLIC_MIDTRANS_CLIENT_KEY is not set"));
  const prod = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";

  loading = new Promise<SnapApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = prod
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    s.setAttribute("data-client-key", clientKey);
    s.async = true;
    s.onload = () => (window.snap ? resolve(window.snap) : reject(new Error("Snap unavailable")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Failed to load Midtrans Snap"));
    };
    document.body.appendChild(s);
  });
  return loading;
}
