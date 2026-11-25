"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { saveLocationPrefsAction } from "@/app/actions/customer";
import { DEFAULT_LOCATION } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import type { CartItem, CustomerLocation, CustomerPreferences } from "@/types/domain";

export type RealtimeStatus = "connecting" | "live" | "offline";

let realtimeChannelSeq = 0;

const CART_KEY = "haffye_cart_v1";
const VENDOR_KEY = "haffye_selected_vendor_v1";
const LOC_KEY = "haffye_customer_loc_v1";

interface CartState {
  vendorId: string | null;
  items: CartItem[];
}

interface CustomerContextValue {
  preferences: CustomerPreferences;
  location: CustomerLocation;
  gpsLoading: boolean;
  gpsError: string | null;
  setLocation: (loc: CustomerLocation, persistToDb?: boolean) => void;
  detectGpsLocation: () => void;
  searchRadiusKm: number;
  setSearchRadiusKm: (km: number) => void;
  selectedVendorId: string | null;
  selectVendor: (vendorId: string | null) => void;
  cart: CartState;
  addToCart: (vendorId: string, item: CartItem, replaceIfDifferentVendor?: boolean) => { conflict?: boolean };
  updateCartQty: (lineId: string, delta: number) => void;
  removeCartItem: (lineId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  realtimeStatus: RealtimeStatus;
  nowMs: number;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

function CustomerContextInner({
  initialPreferences,
  children,
}: {
  initialPreferences: CustomerPreferences;
  children: ReactNode;
}) {
  const initialLoc: CustomerLocation =
    initialPreferences.defaultLatitude !== null && initialPreferences.defaultLongitude !== null
      ? {
          lat: initialPreferences.defaultLatitude,
          lng: initialPreferences.defaultLongitude,
          label: "Saved location",
          source: "manual",
        }
      : DEFAULT_LOCATION;

  const [location, setLocationState] = useState<CustomerLocation>(initialLoc);
  const [searchRadiusKm, setSearchRadiusKmState] = useState<number>(
    initialPreferences.searchRadiusKm || 3,
  );
  const [selectedVendorId, setSelectedVendorIdState] = useState<string | null>(null);
  const [cart, setCart] = useState<CartState>({ vendorId: null, items: [] });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const queryClient = useQueryClient();

  // Single Realtime subscription & 5s timestamp ticker for all customer views
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 5000);
    let cancelled = false;
    const supabase = createClient();
    const topic = `haffye-live-vendors-${++realtimeChannelSeq}`;

    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_locations" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["operational-vendors"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendors" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["operational-vendors"] });
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeStatus("offline");
        } else {
          setRealtimeStatus("connecting");
        }
      });

    return () => {
      cancelled = true;
      clearInterval(ticker);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Hydrate client state from localStorage once on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as CartState;
        if (parsed && Array.isArray(parsed.items)) setCart(parsed);
      }
      const savedVendor = localStorage.getItem(VENDOR_KEY);
      if (savedVendor) setSelectedVendorIdState(savedVendor);

      const savedLoc = localStorage.getItem(LOC_KEY);
      if (savedLoc) {
        const parsedLoc = JSON.parse(savedLoc) as CustomerLocation;
        if (typeof parsedLoc.lat === "number" && typeof parsedLoc.lng === "number") {
          setLocationState(parsedLoc);
        }
      }
    } catch {
      // Ignore malformed storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // Ignore quota errors
    }
  }, [cart, hydrated]);

  const setLocation = useCallback(
    (loc: CustomerLocation, persistToDb = true) => {
      setLocationState(loc);
      setGpsError(null);
      try {
        localStorage.setItem(LOC_KEY, JSON.stringify(loc));
      } catch {
        // Ignore
      }
      if (persistToDb) {
        void saveLocationPrefsAction({
          default_latitude: loc.lat,
          default_longitude: loc.lng,
          search_radius_km: searchRadiusKm,
        });
      }
    },
    [searchRadiusKm],
  );

  const setSearchRadiusKm = useCallback(
    (km: number) => {
      setSearchRadiusKmState(km);
      void saveLocationPrefsAction({
        default_latitude: location.lat,
        default_longitude: location.lng,
        search_radius_km: km,
      });
    },
    [location.lat, location.lng],
  );

  const detectGpsLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser. Choose a location manually.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        setLocation(
          {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            label: "Current GPS",
            source: "gps",
            accuracy: Math.round(pos.coords.accuracy),
          },
          true,
        );
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("Location permission denied. Pick a preset or click the map instead.");
        } else if (err.code === err.TIMEOUT) {
          setGpsError("GPS request timed out. Try again or select a location manually.");
        } else {
          setGpsError("Unable to detect GPS location. Select a location manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  }, [setLocation]);

  const selectVendor = useCallback((vendorId: string | null) => {
    setSelectedVendorIdState(vendorId);
    try {
      if (vendorId) localStorage.setItem(VENDOR_KEY, vendorId);
      else localStorage.removeItem(VENDOR_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const addToCart = useCallback(
    (vendorId: string, item: CartItem, replaceIfDifferentVendor = false) => {
      if (cart.vendorId && cart.vendorId !== vendorId && cart.items.length > 0 && !replaceIfDifferentVendor) {
        return { conflict: true };
      }

      setCart((prev) => {
        const isDifferent = prev.vendorId && prev.vendorId !== vendorId && prev.items.length > 0;
        const baseItems = isDifferent ? [] : prev.items;
        const existingIdx = baseItems.findIndex((i) => i.lineId === item.lineId);
        if (existingIdx >= 0) {
          const updated = [...baseItems];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + item.quantity,
          };
          return { vendorId, items: updated };
        }
        return { vendorId, items: [...baseItems, item] };
      });
      selectVendor(vendorId);
      return {};
    },
    [cart.items.length, cart.vendorId, selectVendor],
  );

  const updateCartQty = useCallback((lineId: string, delta: number) => {
    setCart((prev) => {
      const nextItems = prev.items
        .map((i) => (i.lineId === lineId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0);
      return {
        vendorId: nextItems.length > 0 ? prev.vendorId : null,
        items: nextItems,
      };
    });
  }, []);

  const removeCartItem = useCallback((lineId: string) => {
    setCart((prev) => {
      const nextItems = prev.items.filter((i) => i.lineId !== lineId);
      return {
        vendorId: nextItems.length > 0 ? prev.vendorId : null,
        items: nextItems,
      };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({ vendorId: null, items: [] });
  }, []);

  const cartCount = useMemo(
    () => cart.items.reduce((sum, i) => sum + i.quantity, 0),
    [cart.items],
  );
  const cartSubtotal = useMemo(
    () => cart.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [cart.items],
  );

  const value = useMemo<CustomerContextValue>(
    () => ({
      preferences: initialPreferences,
      location,
      gpsLoading,
      gpsError,
      setLocation,
      detectGpsLocation,
      searchRadiusKm,
      setSearchRadiusKm,
      selectedVendorId,
      selectVendor,
      cart,
      addToCart,
      updateCartQty,
      removeCartItem,
      clearCart,
      cartCount,
      cartSubtotal,
      realtimeStatus,
      nowMs,
    }),
    [
      initialPreferences,
      location,
      gpsLoading,
      gpsError,
      setLocation,
      detectGpsLocation,
      searchRadiusKm,
      setSearchRadiusKm,
      selectedVendorId,
      selectVendor,
      cart,
      addToCart,
      updateCartQty,
      removeCartItem,
      clearCart,
      cartCount,
      cartSubtotal,
      realtimeStatus,
      nowMs,
    ],
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function CustomerProvider({
  initialPreferences,
  children,
}: {
  initialPreferences: CustomerPreferences;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CustomerContextInner initialPreferences={initialPreferences}>
        {children}
      </CustomerContextInner>
    </QueryClientProvider>
  );
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer must be used inside CustomerProvider");
  return ctx;
}
